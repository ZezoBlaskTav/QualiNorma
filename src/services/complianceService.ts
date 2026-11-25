import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  clampString,
  FIELD_LIMITS,
  PAC_CODE_REGEX,
  PacDocument,
  PacOrigin,
  PacSeverity,
  PacTask,
  POP_CODE_REGEX,
  PopDocument,
  PopStep,
  UserPublic,
  UserRole,
} from '../types/compliance';

const BOOTSTRAPPED_ADMIN_EMAIL = 'joseluisblaskowskitavares@gmail.com';

function sanitizeSteps(steps: PopStep[]): PopStep[] {
  return steps.slice(0, FIELD_LIMITS.STEPS_MAX).map((step, idx) => ({
    order: idx + 1,
    title: clampString(step.title || `Etapa ${idx + 1}`, FIELD_LIMITS.STEP_TITLE_MAX),
    description: clampString(step.description || '', FIELD_LIMITS.STEP_DESC_MAX),
    criticalControl: Boolean(step.criticalControl),
  }));
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOneYearLaterIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function ensureUserProfile(user: User): Promise<UserPublic> {
  const publicPath = `users_public/${user.uid}`;
  const privatePath = `users_private/${user.uid}`;
  const publicRef = doc(db, 'users_public', user.uid);
  const privateRef = doc(db, 'users_private', user.uid);

  let existingPublic;
  try {
    existingPublic = await getDoc(publicRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, publicPath);
  }

  if (existingPublic.exists()) {
    const data = existingPublic.data() as UserPublic;
    // Garante que o registro privado exista mesmo para perfis migrados
    try {
      const privSnap = await getDoc(privateRef);
      if (!privSnap.exists() && user.email) {
        const batch = writeBatch(db);
        batch.set(privateRef, {
          uid: user.uid,
          email: clampString(user.email, 160),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
    return data;
  }

  const isBootstrapped =
    user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL;
  const initialRole: UserRole = isBootstrapped ? 'admin' : 'leitor';
  const rawName = user.displayName || user.email?.split('@')[0] || 'Usuário';
  const safeName =
    clampString(rawName, FIELD_LIMITS.NAME_MAX).length >= 2
      ? clampString(rawName, FIELD_LIMITS.NAME_MAX)
      : 'Usuário';

  const newPublic: Omit<UserPublic, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid: user.uid,
    displayName: safeName,
    role: initialRole,
    department: 'Garantia da Qualidade',
    jobTitle: isBootstrapped ? 'Administrador do Sistema' : 'Colaborador',
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(publicRef, newPublic);
    batch.set(privateRef, {
      uid: user.uid,
      email: clampString(user.email || `${user.uid}@local.invalid`, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, publicPath);
  }

  return newPublic as unknown as UserPublic;
}

export async function updateUserAccess(
  targetUid: string,
  updates: { role: UserRole; department: string; jobTitle: string; active: boolean },
  currentAdminUid: string
): Promise<void> {
  const path = `users_public/${targetUid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users_public', targetUid), {
      role: updates.role,
      department: clampString(updates.department, FIELD_LIMITS.DEPARTMENT_MAX),
      jobTitle: clampString(updates.jobTitle, 80),
      active: updates.active,
      updatedAt: serverTimestamp(),
    });

    const adminRef = doc(db, 'admins', targetUid);
    if (updates.role === 'admin' && updates.active) {
      batch.set(adminRef, {
        uid: targetUid,
        grantedBy: currentAdminUid,
        createdAt: serverTimestamp(),
      });
    } else if (targetUid !== currentAdminUid) {
      batch.delete(adminRef);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOwnProfile(
  uid: string,
  displayName: string,
  jobTitle: string
): Promise<void> {
  const path = `users_public/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users_public', uid), {
      displayName: clampString(displayName, FIELD_LIMITS.NAME_MAX),
      jobTitle: clampString(jobTitle, 80),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CreatePopInput {
  code: string;
  title: string;
  department: string;
  category: string;
  objective: string;
  scope: string;
  responsibilities: string;
  steps: PopStep[];
  changeSummary: string;
  nextReviewDate: string;
}

export async function createPop(
  input: CreatePopInput,
  actor: UserPublic
): Promise<string> {
  const normalizedCode = clampString(input.code.toUpperCase(), FIELD_LIMITS.CODE_MAX);
  if (!POP_CODE_REGEX.test(normalizedCode)) {
    throw new Error('Código do POP inválido. Utilize o formato POP-XX-001.');
  }

  const popRef = doc(collection(db, 'pops'));
  const approvalRef = doc(collection(db, 'pops', popRef.id, 'approvals'));
  const path = `pops/${popRef.id}`;

  const popPayload = {
    code: normalizedCode,
    title: clampString(input.title, FIELD_LIMITS.TITLE_MAX),
    department: clampString(input.department, FIELD_LIMITS.DEPARTMENT_MAX),
    category: clampString(input.category, FIELD_LIMITS.CATEGORY_MAX),
    currentVersion: 1,
    status: 'rascunho',
    objective: clampString(input.objective, FIELD_LIMITS.OBJECTIVE_MAX),
    scope: clampString(input.scope, FIELD_LIMITS.SCOPE_MAX),
    responsibilities: clampString(
      input.responsibilities || 'Equipe operacional e liderança do setor.',
      FIELD_LIMITS.RESPONSIBILITIES_MAX
    ),
    steps: sanitizeSteps(input.steps),
    changeSummary: clampString(
      input.changeSummary || 'Elaboração inicial do procedimento.',
      FIELD_LIMITS.CHANGE_SUMMARY_MAX
    ),
    ownerId: actor.uid,
    ownerName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
    approverId: '',
    approverName: '',
    effectiveDate: '',
    nextReviewDate: clampString(
      input.nextReviewDate || getOneYearLaterIso(),
      32
    ),
    lastRejectionReason: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(popRef, popPayload);
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: popRef.id,
      versionNumber: 1,
      action: 'criado',
      fromStatus: 'novo',
      toStatus: 'rascunho',
      comment: 'Procedimento criado em fase de elaboração (rascunho).',
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return popRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePopDraft(
  popId: string,
  input: CreatePopInput
): Promise<void> {
  const normalizedCode = clampString(input.code.toUpperCase(), FIELD_LIMITS.CODE_MAX);
  if (!POP_CODE_REGEX.test(normalizedCode)) {
    throw new Error('Código do POP inválido. Utilize o formato POP-XX-001.');
  }
  const path = `pops/${popId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', popId), {
      code: normalizedCode,
      title: clampString(input.title, FIELD_LIMITS.TITLE_MAX),
      department: clampString(input.department, FIELD_LIMITS.DEPARTMENT_MAX),
      category: clampString(input.category, FIELD_LIMITS.CATEGORY_MAX),
      objective: clampString(input.objective, FIELD_LIMITS.OBJECTIVE_MAX),
      scope: clampString(input.scope, FIELD_LIMITS.SCOPE_MAX),
      responsibilities: clampString(
        input.responsibilities,
        FIELD_LIMITS.RESPONSIBILITIES_MAX
      ),
      steps: sanitizeSteps(input.steps),
      changeSummary: clampString(
        input.changeSummary,
        FIELD_LIMITS.CHANGE_SUMMARY_MAX
      ),
      nextReviewDate: clampString(input.nextReviewDate, 32),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitPopForReview(
  pop: PopDocument,
  changeSummary: string,
  actor: UserPublic
): Promise<void> {
  const path = `pops/${pop.id}`;
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));
  const summary = clampString(
    changeSummary || pop.changeSummary || 'Submetido para revisão técnica.',
    FIELD_LIMITS.CHANGE_SUMMARY_MAX
  );

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'em_revisao',
      changeSummary: summary,
      lastRejectionReason: '',
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: pop.currentVersion,
      action: 'submetido',
      fromStatus: pop.status,
      toStatus: 'em_revisao',
      comment: summary,
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function advancePopToApproval(
  pop: PopDocument,
  comment: string,
  actor: UserPublic
): Promise<void> {
  const path = `pops/${pop.id}`;
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'aguardando_aprovacao',
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: pop.currentVersion,
      action: 'revisado',
      fromStatus: pop.status,
      toStatus: 'aguardando_aprovacao',
      comment: clampString(
        comment || 'Revisão técnica validada. Encaminhado para aprovação final.',
        FIELD_LIMITS.REASON_MAX
      ),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function approveAndPublishPop(
  pop: PopDocument,
  comment: string,
  nextReviewDate: string,
  actor: UserPublic
): Promise<void> {
  const path = `pops/${pop.id}`;
  const todayIso = getTodayIso();
  const reviewDate = clampString(
    nextReviewDate || pop.nextReviewDate || getOneYearLaterIso(),
    32
  );
  const versionId = `v${pop.currentVersion}_${Date.now()}`;
  const versionRef = doc(db, 'pops', pop.id, 'versions', versionId);
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'vigente',
      approverId: actor.uid,
      approverName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      effectiveDate: todayIso,
      nextReviewDate: reviewDate,
      lastRejectionReason: '',
      updatedAt: serverTimestamp(),
    });
    batch.set(versionRef, {
      popId: pop.id,
      versionNumber: pop.currentVersion,
      code: pop.code,
      title: pop.title,
      department: pop.department,
      category: pop.category,
      objective: pop.objective,
      scope: pop.scope,
      responsibilities: pop.responsibilities,
      steps: sanitizeSteps(pop.steps),
      changeSummary: pop.changeSummary || `Publicação da versão v${pop.currentVersion}.0`,
      authorId: pop.ownerId,
      authorName: pop.ownerName,
      approvedById: actor.uid,
      approvedByName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      effectiveDate: todayIso,
      createdAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: pop.currentVersion,
      action: 'aprovado',
      fromStatus: pop.status,
      toStatus: 'vigente',
      comment: clampString(
        comment || `Versão v${pop.currentVersion}.0 aprovada e publicada como vigente.`,
        FIELD_LIMITS.REASON_MAX
      ),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rejectPopToDraft(
  pop: PopDocument,
  reason: string,
  actor: UserPublic
): Promise<void> {
  const safeReason = clampString(reason, FIELD_LIMITS.REASON_MAX);
  if (safeReason.length < 3) {
    throw new Error('Informe uma justificativa com pelo menos 3 caracteres para reprovar.');
  }
  const path = `pops/${pop.id}`;
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'rascunho',
      lastRejectionReason: safeReason,
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: pop.currentVersion,
      action: 'reprovado',
      fromStatus: pop.status,
      toStatus: 'rascunho',
      comment: safeReason,
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function startNewPopRevision(
  pop: PopDocument,
  changeSummary: string,
  actor: UserPublic
): Promise<void> {
  const path = `pops/${pop.id}`;
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));
  const nextVersion = pop.currentVersion + 1;
  const summary = clampString(
    changeSummary || `Iniciada revisão para a versão v${nextVersion}.0.`,
    FIELD_LIMITS.CHANGE_SUMMARY_MAX
  );

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'rascunho',
      currentVersion: nextVersion,
      changeSummary: summary,
      lastRejectionReason: '',
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: nextVersion,
      action: 'nova_revisao',
      fromStatus: pop.status,
      toStatus: 'rascunho',
      comment: summary,
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function archivePop(
  pop: PopDocument,
  reason: string,
  actor: UserPublic
): Promise<void> {
  const path = `pops/${pop.id}`;
  const approvalRef = doc(collection(db, 'pops', pop.id, 'approvals'));
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pops', pop.id), {
      status: 'obsoleto',
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pop',
      entityId: pop.id,
      versionNumber: pop.currentVersion,
      action: 'arquivado',
      fromStatus: pop.status,
      toStatus: 'obsoleto',
      comment: clampString(
        reason || 'Procedimento marcado como obsoleto.',
        FIELD_LIMITS.REASON_MAX
      ),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CreatePacInput {
  code: string;
  title: string;
  origin: PacOrigin;
  severity: PacSeverity;
  department: string;
  relatedPopId: string;
  relatedPopCode: string;
  rootCause: string;
  actionPlan: string;
  responsibleId: string;
  responsibleName: string;
  dueDate: string;
  initialTasks: { title: string; assigneeName: string }[];
}

export async function createPac(
  input: CreatePacInput,
  actor: UserPublic
): Promise<string> {
  const normalizedCode = clampString(input.code.toUpperCase(), FIELD_LIMITS.CODE_MAX);
  if (!PAC_CODE_REGEX.test(normalizedCode)) {
    throw new Error('Código do PAC inválido. Utilize o formato PAC-2026-001.');
  }

  const pacRef = doc(collection(db, 'pacs'));
  const approvalRef = doc(collection(db, 'pacs', pacRef.id, 'approvals'));
  const path = `pacs/${pacRef.id}`;

  try {
    const batch = writeBatch(db);
    batch.set(pacRef, {
      code: normalizedCode,
      title: clampString(input.title, FIELD_LIMITS.TITLE_MAX),
      origin: input.origin,
      severity: input.severity,
      department: clampString(input.department, FIELD_LIMITS.DEPARTMENT_MAX),
      relatedPopId: clampString(input.relatedPopId, 128),
      relatedPopCode: clampString(input.relatedPopCode, FIELD_LIMITS.CODE_MAX),
      rootCause: clampString(input.rootCause, FIELD_LIMITS.ROOT_CAUSE_MAX),
      actionPlan: clampString(input.actionPlan, FIELD_LIMITS.ACTION_PLAN_MAX),
      responsibleId: clampString(input.responsibleId || actor.uid, 128),
      responsibleName: clampString(
        input.responsibleName || actor.displayName,
        FIELD_LIMITS.NAME_MAX
      ),
      dueDate: clampString(input.dueDate, 32),
      status: 'aberto',
      verificationNotes: '',
      progressPercent: 0,
      ownerId: actor.uid,
      ownerName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    input.initialTasks.slice(0, 20).forEach((task, idx) => {
      if (!task.title.trim()) return;
      const taskRef = doc(collection(db, 'pacs', pacRef.id, 'tasks'));
      batch.set(taskRef, {
        pacId: pacRef.id,
        order: idx + 1,
        title: clampString(task.title, FIELD_LIMITS.STEP_TITLE_MAX),
        assigneeName: clampString(
          task.assigneeName || input.responsibleName || actor.displayName,
          FIELD_LIMITS.NAME_MAX
        ),
        completed: false,
        evidenceNote: '',
        completedById: '',
        completedByName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    batch.set(approvalRef, {
      entityType: 'pac',
      entityId: pacRef.id,
      action: 'criado',
      fromStatus: 'novo',
      toStatus: 'aberto',
      comment: 'Plano de Ação Corretiva aberto para implantação.',
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return pacRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function startPacExecution(
  pac: PacDocument,
  actor: UserPublic
): Promise<void> {
  const path = `pacs/${pac.id}`;
  const approvalRef = doc(collection(db, 'pacs', pac.id, 'approvals'));
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id), {
      status: 'em_execucao',
      progressPercent: pac.progressPercent,
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pac',
      entityId: pac.id,
      action: 'iniciado',
      fromStatus: pac.status,
      toStatus: 'em_execucao',
      comment: 'Execução e implantação iniciadas.',
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addPacTask(
  pac: PacDocument,
  title: string,
  assigneeName: string,
  currentTasks: PacTask[]
): Promise<void> {
  const taskRef = doc(collection(db, 'pacs', pac.id, 'tasks'));
  const nextOrder =
    currentTasks.length > 0
      ? Math.max(...currentTasks.map((t) => t.order)) + 1
      : 1;
  const totalCount = currentTasks.length + 1;
  const completedCount = currentTasks.filter((t) => t.completed).length;
  const nextProgress = Math.round((completedCount / totalCount) * 100);
  const path = `pacs/${pac.id}/tasks/${taskRef.id}`;

  try {
    const batch = writeBatch(db);
    batch.set(taskRef, {
      pacId: pac.id,
      order: Math.min(nextOrder, 100),
      title: clampString(title, FIELD_LIMITS.STEP_TITLE_MAX),
      assigneeName: clampString(assigneeName || pac.responsibleName, FIELD_LIMITS.NAME_MAX),
      completed: false,
      evidenceNote: '',
      completedById: '',
      completedByName: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pacs', pac.id), {
      status: pac.status === 'aberto' ? 'em_execucao' : pac.status,
      progressPercent: nextProgress,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function togglePacTask(
  pac: PacDocument,
  task: PacTask,
  completed: boolean,
  evidenceNote: string,
  allTasks: PacTask[],
  actor: UserPublic
): Promise<void> {
  const path = `pacs/${pac.id}/tasks/${task.id}`;
  const updatedCompletedCount = allTasks.reduce((acc, item) => {
    const state = item.id === task.id ? completed : item.completed;
    return acc + (state ? 1 : 0);
  }, 0);
  const nextProgress =
    allTasks.length > 0
      ? Math.round((updatedCompletedCount / allTasks.length) * 100)
      : 0;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id, 'tasks', task.id), {
      completed,
      evidenceNote: clampString(evidenceNote, FIELD_LIMITS.REASON_MAX),
      completedById: completed ? actor.uid : '',
      completedByName: completed ? clampString(actor.displayName, FIELD_LIMITS.NAME_MAX) : '',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pacs', pac.id), {
      status: 'em_execucao',
      progressPercent: nextProgress,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removePacTask(
  pac: PacDocument,
  taskId: string,
  allTasks: PacTask[]
): Promise<void> {
  const path = `pacs/${pac.id}/tasks/${taskId}`;
  const remaining = allTasks.filter((t) => t.id !== taskId);
  const completedCount = remaining.filter((t) => t.completed).length;
  const nextProgress =
    remaining.length > 0 ? Math.round((completedCount / remaining.length) * 100) : 0;

  try {
    await deleteDoc(doc(db, 'pacs', pac.id, 'tasks', taskId));
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id), {
      status: pac.status === 'aberto' ? 'em_execucao' : pac.status,
      progressPercent: nextProgress,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function submitPacForVerification(
  pac: PacDocument,
  comment: string,
  actor: UserPublic
): Promise<void> {
  const path = `pacs/${pac.id}`;
  const approvalRef = doc(collection(db, 'pacs', pac.id, 'approvals'));
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id), {
      status: 'aguardando_verificacao',
      progressPercent: pac.progressPercent,
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pac',
      entityId: pac.id,
      action: 'enviado_verificacao',
      fromStatus: pac.status,
      toStatus: 'aguardando_verificacao',
      comment: clampString(
        comment || 'Implantação finalizada. Enviado para verificação de eficácia.',
        FIELD_LIMITS.REASON_MAX
      ),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function verifyPacEfficacy(
  pac: PacDocument,
  approved: boolean,
  verificationNotes: string,
  actor: UserPublic
): Promise<void> {
  const notes = clampString(verificationNotes, FIELD_LIMITS.VERIFICATION_MAX);
  if (notes.length < 3) {
    throw new Error('Descreva o parecer da verificação de eficácia.');
  }
  const path = `pacs/${pac.id}`;
  const approvalRef = doc(collection(db, 'pacs', pac.id, 'approvals'));
  const nextStatus = approved ? 'concluido' : 'em_execucao';

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id), {
      status: nextStatus,
      verificationNotes: notes,
      progressPercent: approved ? 100 : pac.progressPercent,
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pac',
      entityId: pac.id,
      action: approved ? 'aprovado' : 'reprovado',
      fromStatus: pac.status,
      toStatus: nextStatus,
      comment: clampString(notes, FIELD_LIMITS.REASON_MAX),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelPac(
  pac: PacDocument,
  reason: string,
  actor: UserPublic
): Promise<void> {
  const path = `pacs/${pac.id}`;
  const approvalRef = doc(collection(db, 'pacs', pac.id, 'approvals'));
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'pacs', pac.id), {
      status: 'cancelado',
      updatedAt: serverTimestamp(),
    });
    batch.set(approvalRef, {
      entityType: 'pac',
      entityId: pac.id,
      action: 'cancelado',
      fromStatus: pac.status,
      toStatus: 'cancelado',
      comment: clampString(reason || 'PAC cancelado pela administração.', FIELD_LIMITS.REASON_MAX),
      actorId: actor.uid,
      actorName: clampString(actor.displayName, FIELD_LIMITS.NAME_MAX),
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedSampleComplianceData(actor: UserPublic): Promise<void> {
  const today = getTodayIso();
  const nextYear = getOneYearLaterIso();

  const pop1Ref = doc(collection(db, 'pops'));
  const pop2Ref = doc(collection(db, 'pops'));
  const pop3Ref = doc(collection(db, 'pops'));

  const pac1Ref = doc(collection(db, 'pacs'));
  const pac2Ref = doc(collection(db, 'pacs'));

  try {
    const batch = writeBatch(db);

    // POP 1: Vigente na v2 com histórico completo v1 e v2
    const pop1StepsV1: PopStep[] = [
      {
        order: 1,
        title: 'Pré-limpeza a seco dos equipamentos',
        description: 'Remover resíduos sólidos visíveis das bancadas e esteiras antes da aplicação de água.',
        criticalControl: false,
      },
      {
        order: 2,
        title: 'Aplicação de detergente alcalino clorado',
        description: 'Diluir a 2% e deixar agir por 10 minutos com escovação mecânica.',
        criticalControl: true,
      },
      {
        order: 3,
        title: 'Enxágue com água potável',
        description: 'Enxaguar completamente até ausência de espuma residual.',
        criticalControl: false,
      },
    ];

    const pop1StepsV2: PopStep[] = [
      ...pop1StepsV1,
      {
        order: 4,
        title: 'Teste rápido de ATP por bioluminescência',
        description: 'Coletar swab em 3 pontos críticos antes da liberação da linha (limite <= 150 RLU).',
        criticalControl: true,
      },
    ];

    batch.set(pop1Ref, {
      code: 'POP-HYG-001',
      title: 'Higienização Operacional e Pré-Operacional da Linha de Envase',
      department: 'Higienização',
      category: 'Boas Práticas de Fabricação',
      currentVersion: 2,
      status: 'vigente',
      objective:
        'Padronizar a limpeza e sanitização das superfícies de contato direto com o produto na linha de envase, prevenindo contaminação microbiológica cruzada.',
      scope: 'Aplicável a todas as linhas de envase primário, tanques pulmão e bancadas de inspeção.',
      responsibilities:
        'Operadores de Higienização executam a limpeza; Monitor de Qualidade valida o teste de ATP e libera o turno.',
      steps: pop1StepsV2,
      changeSummary: 'Inclusão da etapa obrigatória de verificação rápida por swab de ATP (<= 150 RLU).',
      ownerId: actor.uid,
      ownerName: actor.displayName,
      approverId: actor.uid,
      approverName: actor.displayName,
      effectiveDate: today,
      nextReviewDate: nextYear,
      lastRejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'pops', pop1Ref.id, 'versions', 'v1_seed'), {
      popId: pop1Ref.id,
      versionNumber: 1,
      code: 'POP-HYG-001',
      title: 'Higienização Operacional da Linha de Envase',
      department: 'Higienização',
      category: 'Boas Práticas de Fabricação',
      objective:
        'Padronizar a limpeza e sanitização das superfícies de contato direto com o produto na linha de envase.',
      scope: 'Aplicável às linhas de envase primário.',
      responsibilities: 'Operadores de Higienização executam a limpeza diária.',
      steps: pop1StepsV1,
      changeSummary: 'Emissão inicial do procedimento de higienização.',
      authorId: actor.uid,
      authorName: actor.displayName,
      approvedById: actor.uid,
      approvedByName: actor.displayName,
      effectiveDate: '2026-03-10',
      createdAt: serverTimestamp(),
    });

    batch.set(doc(db, 'pops', pop1Ref.id, 'versions', 'v2_seed'), {
      popId: pop1Ref.id,
      versionNumber: 2,
      code: 'POP-HYG-001',
      title: 'Higienização Operacional e Pré-Operacional da Linha de Envase',
      department: 'Higienização',
      category: 'Boas Práticas de Fabricação',
      objective:
        'Padronizar a limpeza e sanitização das superfícies de contato direto com o produto na linha de envase, prevenindo contaminação microbiológica cruzada.',
      scope: 'Aplicável a todas as linhas de envase primário, tanques pulmão e bancadas de inspeção.',
      responsibilities:
        'Operadores de Higienização executam a limpeza; Monitor de Qualidade valida o teste de ATP e libera o turno.',
      steps: pop1StepsV2,
      changeSummary: 'Inclusão da etapa obrigatória de verificação rápida por swab de ATP (<= 150 RLU).',
      authorId: actor.uid,
      authorName: actor.displayName,
      approvedById: actor.uid,
      approvedByName: actor.displayName,
      effectiveDate: today,
      createdAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pops', pop1Ref.id, 'approvals')), {
      entityType: 'pop',
      entityId: pop1Ref.id,
      versionNumber: 2,
      action: 'aprovado',
      fromStatus: 'aguardando_aprovacao',
      toStatus: 'vigente',
      comment: 'Versão v2.0 aprovada com inclusão do monitoramento de ATP.',
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    // POP 2: Aguardando Aprovação
    batch.set(pop2Ref, {
      code: 'POP-GQ-004',
      title: 'Calibração e Verificação Diária de Balanças Analíticas',
      department: 'Laboratório',
      category: 'Controle de Qualidade',
      currentVersion: 1,
      status: 'aguardando_aprovacao',
      objective:
        'Assegurar a confiabilidade metrológica das pesagens de matéria-prima e controle em processo através da verificação diária com massas padrão.',
      scope: 'Balanças analíticas e semi-analíticas do Laboratório Físico-Químico e Sala de Pesagem.',
      responsibilities: 'Analistas de Controle de Qualidade realizam a checagem antes do primeiro uso.',
      steps: [
        {
          order: 1,
          title: 'Inspeção de nivelamento e limpeza',
          description: 'Conferir bolha de nível centralizada e prato livre de resíduos.',
          criticalControl: false,
        },
        {
          order: 2,
          title: 'Verificação com peso padrão certificado F1',
          description: 'Registrar leitura em 3 pontos da faixa operacional (tolerância ±0,05%).',
          criticalControl: true,
        },
      ],
      changeSummary: 'Submetido para aprovação final da Garantia da Qualidade.',
      ownerId: actor.uid,
      ownerName: actor.displayName,
      approverId: '',
      approverName: '',
      effectiveDate: '',
      nextReviewDate: nextYear,
      lastRejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pops', pop2Ref.id, 'approvals')), {
      entityType: 'pop',
      entityId: pop2Ref.id,
      versionNumber: 1,
      action: 'revisado',
      fromStatus: 'em_revisao',
      toStatus: 'aguardando_aprovacao',
      comment: 'Critérios metrológicos revisados. Pronto para assinatura final.',
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    // POP 3: Rascunho
    batch.set(pop3Ref, {
      code: 'POP-MN-008',
      title: 'Bloqueio e Etiquetagem de Energias Perigosas (LOTO)',
      department: 'Manutenção',
      category: 'Segurança do Trabalho',
      currentVersion: 1,
      status: 'rascunho',
      objective:
        'Estabelecer requisitos mínimos para isolamento seguro de energia elétrica, pneumática e térmica durante intervenções de manutenção.',
      scope: 'Todas as máquinas rotativas, compressores e painéis elétricos industriais.',
      responsibilities: 'Técnicos de Manutenção e Segurança do Trabalho.',
      steps: [
        {
          order: 1,
          title: 'Comunicação e desligamento operacional',
          description: 'Notificar o operador da linha e desligar o equipamento pela chave geral.',
          criticalControl: true,
        },
        {
          order: 2,
          title: 'Aplicação de cadeado individual e etiqueta LOTO',
          description: 'Travar o seccionador e testar energia zero antes do início da manutenção.',
          criticalControl: true,
        },
      ],
      changeSummary: 'Rascunho inicial para alinhamento com NR-12.',
      ownerId: actor.uid,
      ownerName: actor.displayName,
      approverId: '',
      approverName: '',
      effectiveDate: '',
      nextReviewDate: nextYear,
      lastRejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pops', pop3Ref.id, 'approvals')), {
      entityType: 'pop',
      entityId: pop3Ref.id,
      versionNumber: 1,
      action: 'criado',
      fromStatus: 'novo',
      toStatus: 'rascunho',
      comment: 'Procedimento criado em fase de elaboração.',
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    // PAC 1: Em Execução vinculado ao POP-HYG-001
    batch.set(pac1Ref, {
      code: 'PAC-2026-001',
      title: 'Implantação do Teste Rápido de ATP na Linha de Envase (POP-HYG-001)',
      origin: 'implantacao_pop',
      severity: 'alta',
      department: 'Higienização',
      relatedPopId: pop1Ref.id,
      relatedPopCode: 'POP-HYG-001',
      rootCause:
        'Revisão v2.0 do POP-HYG-001 introduziu controle quantitativo por bioluminescência de ATP antes da liberação de turno.',
      actionPlan:
        'Adquirir luminômetro e swabs, treinar operadores dos turnos A e B e auditar 100% dos registros por 15 dias.',
      responsibleId: actor.uid,
      responsibleName: actor.displayName,
      dueDate: '2026-12-15',
      status: 'em_execucao',
      verificationNotes: '',
      progressPercent: 50,
      ownerId: actor.uid,
      ownerName: actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pacs', pac1Ref.id, 'tasks')), {
      pacId: pac1Ref.id,
      order: 1,
      title: 'Disponibilizar luminômetro calibrado e kit de swabs na área limpa',
      assigneeName: actor.displayName,
      completed: true,
      evidenceNote: 'Equipamento tombado nº LQ-042 entregue ao setor em 20/11.',
      completedById: actor.uid,
      completedByName: actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pacs', pac1Ref.id, 'tasks')), {
      pacId: pac1Ref.id,
      order: 2,
      title: 'Treinar e registrar lista de presença das equipes dos turnos A e B',
      assigneeName: actor.displayName,
      completed: false,
      evidenceNote: '',
      completedById: '',
      completedByName: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pacs', pac1Ref.id, 'approvals')), {
      entityType: 'pac',
      entityId: pac1Ref.id,
      action: 'iniciado',
      fromStatus: 'aberto',
      toStatus: 'em_execucao',
      comment: 'Plano de implantação iniciado após publicação do POP-HYG-001 v2.0.',
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    // PAC 2: Aguardando Verificação de Eficácia
    batch.set(pac2Ref, {
      code: 'PAC-2026-002',
      title: 'Correção de Registro Incompleto de Temperatura em Câmara Fria 02',
      origin: 'auditoria_interna',
      severity: 'critica',
      department: 'Logística',
      relatedPopId: '',
      relatedPopCode: '',
      rootCause:
        'Ausência de alerta sonoro no controlador e falha na conferência horária durante troca de turno noturno.',
      actionPlan:
        'Configurar alarme automático acima de 4°C, implantar dupla checagem na troca de turno e revisar registros de 7 dias.',
      responsibleId: actor.uid,
      responsibleName: actor.displayName,
      dueDate: '2026-11-30',
      status: 'aguardando_verificacao',
      verificationNotes: '',
      progressPercent: 100,
      ownerId: actor.uid,
      ownerName: actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pacs', pac2Ref.id, 'tasks')), {
      pacId: pac2Ref.id,
      order: 1,
      title: 'Parametrizar alarme de desvio térmico (> 4,0 °C) no painel digital',
      assigneeName: actor.displayName,
      completed: true,
      evidenceNote: 'Alarme testado e validado com simulação de abertura de porta.',
      completedById: actor.uid,
      completedByName: actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(collection(db, 'pacs', pac2Ref.id, 'approvals')), {
      entityType: 'pac',
      entityId: pac2Ref.id,
      action: 'enviado_verificacao',
      fromStatus: 'em_execucao',
      toStatus: 'aguardando_verificacao',
      comment: 'Ações concluídas com 100% das evidências anexadas. Aguardando verificação da Qualidade.',
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'pops/seed');
  }
}
