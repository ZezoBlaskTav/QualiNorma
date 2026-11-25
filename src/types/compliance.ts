export type UserRole = 'admin' | 'aprovador' | 'editor' | 'leitor';

export type PopStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'aguardando_aprovacao'
  | 'vigente'
  | 'obsoleto';

export type PacStatus =
  | 'aberto'
  | 'em_execucao'
  | 'aguardando_verificacao'
  | 'concluido'
  | 'cancelado';

export type PacOrigin =
  | 'nao_conformidade'
  | 'auditoria_interna'
  | 'implantacao_pop'
  | 'melhoria_continua'
  | 'inspecao_sanitaria';

export type PacSeverity = 'baixa' | 'media' | 'alta' | 'critica';

export interface PopStep {
  order: number;
  title: string;
  description: string;
  criticalControl: boolean;
}

export interface UserPublic {
  uid: string;
  displayName: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PopDocument {
  id: string;
  code: string;
  title: string;
  department: string;
  category: string;
  currentVersion: number;
  status: PopStatus;
  objective: string;
  scope: string;
  responsibilities: string;
  steps: PopStep[];
  changeSummary: string;
  ownerId: string;
  ownerName: string;
  approverId: string;
  approverName: string;
  effectiveDate: string;
  nextReviewDate: string;
  lastRejectionReason: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PopVersion {
  id: string;
  popId: string;
  versionNumber: number;
  code: string;
  title: string;
  department: string;
  category: string;
  objective: string;
  scope: string;
  responsibilities: string;
  steps: PopStep[];
  changeSummary: string;
  authorId: string;
  authorName: string;
  approvedById: string;
  approvedByName: string;
  effectiveDate: string;
  createdAt?: unknown;
}

export interface PopApprovalEvent {
  id: string;
  entityType: 'pop';
  entityId: string;
  versionNumber: number;
  action:
    | 'criado'
    | 'submetido'
    | 'revisado'
    | 'aprovado'
    | 'reprovado'
    | 'nova_revisao'
    | 'arquivado';
  fromStatus: string;
  toStatus: string;
  comment: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  createdAt?: unknown;
}

export interface PacDocument {
  id: string;
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
  status: PacStatus;
  verificationNotes: string;
  progressPercent: number;
  ownerId: string;
  ownerName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PacTask {
  id: string;
  pacId: string;
  order: number;
  title: string;
  assigneeName: string;
  completed: boolean;
  evidenceNote: string;
  completedById: string;
  completedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PacApprovalEvent {
  id: string;
  entityType: 'pac';
  entityId: string;
  action:
    | 'criado'
    | 'iniciado'
    | 'enviado_verificacao'
    | 'aprovado'
    | 'reprovado'
    | 'cancelado';
  fromStatus: string;
  toStatus: string;
  comment: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  createdAt?: unknown;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  aprovador: 'Aprovador (Qualidade)',
  editor: 'Elaborador / Editor',
  leitor: 'Operador / Leitor',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Controle total do sistema, gestão de acessos, arquivamento e aprovações finais.',
  aprovador: 'Revisa, aprova ou reprova POPs e verifica a eficácia de PACs implantados.',
  editor: 'Elabora novos POPs, inicia revisões, cria PACs e conduz planos de implantação.',
  leitor: 'Consulta POPs vigentes, histórico de versões e registra evidências em PACs atribuídos.',
};

export const POP_STATUS_LABELS: Record<PopStatus, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em Revisão Técnica',
  aguardando_aprovacao: 'Aguardando Aprovação',
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
};

export const PAC_STATUS_LABELS: Record<PacStatus, string> = {
  aberto: 'Aberto',
  em_execucao: 'Em Execução',
  aguardando_verificacao: 'Aguardando Verificação',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const PAC_ORIGIN_LABELS: Record<PacOrigin, string> = {
  nao_conformidade: 'Não Conformidade',
  auditoria_interna: 'Auditoria Interna',
  implantacao_pop: 'Implantação de POP',
  melhoria_continua: 'Melhoria Contínua',
  inspecao_sanitaria: 'Inspeção Sanitária / Regulatória',
};

export const PAC_SEVERITY_LABELS: Record<PacSeverity, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const DEPARTMENTS = [
  'Garantia da Qualidade',
  'Produção',
  'Higienização',
  'Manutenção',
  'Logística',
  'Laboratório',
  'Segurança do Trabalho',
  'Recursos Humanos',
];

export const POP_CATEGORIES = [
  'Operacional',
  'Controle de Qualidade',
  'Boas Práticas de Fabricação',
  'Segurança de Alimentos',
  'Segurança do Trabalho',
  'Manutenção Preventiva',
  'Ambiental',
];

export const FIELD_LIMITS = {
  CODE_MAX: 32,
  TITLE_MAX: 160,
  DEPARTMENT_MAX: 80,
  CATEGORY_MAX: 80,
  OBJECTIVE_MAX: 2000,
  SCOPE_MAX: 1500,
  RESPONSIBILITIES_MAX: 1500,
  CHANGE_SUMMARY_MAX: 500,
  REASON_MAX: 600,
  ROOT_CAUSE_MAX: 2000,
  ACTION_PLAN_MAX: 2000,
  VERIFICATION_MAX: 1000,
  STEP_TITLE_MAX: 160,
  STEP_DESC_MAX: 1000,
  STEPS_MAX: 25,
  NAME_MAX: 100,
} as const;

export const POP_CODE_REGEX = /^POP-[A-Z0-9\-]{2,26}$/;
export const PAC_CODE_REGEX = /^PAC-[A-Z0-9\-]{2,26}$/;

export function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (ts instanceof Date) {
      return ts.toLocaleString('pt-BR');
    }
    if (typeof ts === 'string' && ts.trim()) {
      const parsed = new Date(ts);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('pt-BR');
      }
      return ts;
    }
  } catch {
    return '—';
  }
  return '—';
}

export function formatIsoDate(iso: string): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}
