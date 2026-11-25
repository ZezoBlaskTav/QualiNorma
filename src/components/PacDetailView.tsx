import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  History,
  PlayCircle,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  addPacTask,
  cancelPac,
  removePacTask,
  startPacExecution,
  submitPacForVerification,
  togglePacTask,
  verifyPacEfficacy,
} from '../services/complianceService';
import {
  formatIsoDate,
  formatTimestamp,
  PAC_ORIGIN_LABELS,
  PAC_STATUS_LABELS,
  PacApprovalEvent,
  PacDocument,
  PacTask,
  ROLE_LABELS,
  UserPublic,
  UserRole,
} from '../types/compliance';
import { PacSeverityDisplay, PacStatusDisplay } from './StatusText';

interface PacDetailViewProps {
  pac: PacDocument;
  profile: UserPublic;
  onBack: () => void;
  onOpenPop: (popId: string) => void;
}

export function PacDetailView({
  pac,
  profile,
  onBack,
  onOpenPop,
}: PacDetailViewProps) {
  const [tasks, setTasks] = useState<PacTask[]>([]);
  const [approvals, setApprovals] = useState<PacApprovalEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'implantacao' | 'historico'>(
    'implantacao'
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [evidenceInputs, setEvidenceInputs] = useState<Record<string, string>>({});
  const [verificationNote, setVerificationNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isEditorOrAbove = profile.role !== 'leitor';
  const isApproverOrAdmin =
    profile.role === 'aprovador' || profile.role === 'admin';
  const isAdmin = profile.role === 'admin';
  const isResponsible = profile.uid === pac.responsibleId;
  const canExecuteTasks =
    (pac.status === 'aberto' || pac.status === 'em_execucao') &&
    (isEditorOrAbove || isResponsible);

  useEffect(() => {
    const tasksPath = `pacs/${pac.id}/tasks`;
    const qTasks = query(
      collection(db, 'pacs', pac.id, 'tasks'),
      where('pacId', '==', pac.id)
    );
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PacTask, 'id'>) }))
          .sort((a, b) => a.order - b.order);
        setTasks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
    );

    const approvalsPath = `pacs/${pac.id}/approvals`;
    const qApprovals = query(
      collection(db, 'pacs', pac.id, 'approvals'),
      where('entityId', '==', pac.id),
      where('entityType', '==', 'pac')
    );
    const unsubApprovals = onSnapshot(
      qApprovals,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PacApprovalEvent, 'id'>),
          }))
          .sort((a, b) => {
            const ta =
              (a.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
            const tb =
              (b.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
            return tb - ta;
          });
        setApprovals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, approvalsPath)
    );

    return () => {
      unsubTasks();
      unsubApprovals();
    };
  }, [pac.id]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar PAC.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (newTaskTitle.trim().length < 2) return;
    await runAction(async () => {
      await addPacTask(pac, newTaskTitle, pac.responsibleName, tasks);
      setNewTaskTitle('');
    });
  }

  const actionLabels: Record<PacApprovalEvent['action'], string> = {
    criado: 'PAC Aberto',
    iniciado: 'Execução Iniciada',
    enviado_verificacao: 'Enviado para Verificação',
    aprovado: 'Eficácia Aprovada',
    reprovado: 'Devolvido para Ajustes',
    cancelado: 'PAC Cancelado',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para lista de PACs
          </button>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm font-semibold text-blue-700">
              {pac.code}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              /
            </span>
            <h1 className="font-display text-xl font-bold text-slate-900">
              {pac.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{PAC_ORIGIN_LABELS[pac.origin]}</span>
            <span aria-hidden="true">·</span>
            <span>{pac.department}</span>
            <span aria-hidden="true">·</span>
            <span>Responsável: {pac.responsibleName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Prazo: {formatIsoDate(pac.dueDate)}
            </span>
            <span aria-hidden="true">·</span>
            <PacSeverityDisplay severity={pac.severity} />
            <span aria-hidden="true">·</span>
            <PacStatusDisplay status={pac.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pac.status === 'aberto' && (isEditorOrAbove || isResponsible) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => startPacExecution(pac, profile))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Iniciar Execução
            </button>
          )}

          {(pac.status === 'aberto' || pac.status === 'em_execucao') &&
            (isEditorOrAbove || isResponsible) && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() =>
                    submitPacForVerification(pac, verificationNote, profile)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar para Verificação
              </button>
            )}

          {pac.status !== 'concluido' && pac.status !== 'cancelado' && isAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  cancelPac(pac, verificationNote || 'Cancelado pela administração.', profile)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-300 rounded-md hover:bg-rose-50 whitespace-nowrap"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar PAC
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('implantacao')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'implantacao'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Plano e Implantação ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'historico'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Histórico de Verificações ({approvals.length})
        </button>
      </div>

      {activeTab === 'implantacao' && (
        <div className="space-y-6">
          {pac.status === 'aguardando_verificacao' && isApproverOrAdmin && (
            <section className="bg-white border border-blue-200 rounded-lg p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  Verificação de Eficácia da Garantia da Qualidade
                </h2>
                <p className="text-xs text-slate-600">
                  Analise as evidências registradas nas etapas de implantação e aprove a conclusão ou devolva para ajustes.
                </p>
              </div>
              <textarea
                rows={2}
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="Descreva o parecer técnico da verificação de eficácia..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busy || verificationNote.trim().length < 3}
                  onClick={() =>
                    runAction(() =>
                      verifyPacEfficacy(pac, false, verificationNote, profile)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-300 rounded-md hover:bg-rose-50 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reprovar e Retornar à Execução
                </button>
                <button
                  type="button"
                  disabled={busy || verificationNote.trim().length < 3}
                  onClick={() =>
                    runAction(() =>
                      verifyPacEfficacy(pac, true, verificationNote, profile)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprovar Eficácia e Concluir PAC
                </button>
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-500">
                  Análise de Causa Raiz / Contexto
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {pac.rootCause}
                </p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-500">
                  Plano de Ação (Como Implantar)
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {pac.actionPlan}
                </p>
              </div>
            </div>

            {pac.relatedPopId && (
              <div className="px-6 py-4 flex items-center justify-between gap-4 bg-slate-50/70">
                <div className="text-xs text-slate-600">
                  Procedimento vinculado:{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {pac.relatedPopCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPop(pac.relatedPopId)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Abrir POP vinculado
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pac.verificationNotes && (
              <div className="p-6 space-y-1.5 bg-emerald-50/40">
                <h3 className="text-xs font-semibold text-emerald-900">
                  Parecer de Verificação de Eficácia
                </h3>
                <p className="text-sm text-slate-800">{pac.verificationNotes}</p>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Checklist de Etapas de Implantação
                </h2>
                <p className="text-xs text-slate-500">
                  Marque as etapas concluídas e registre a evidência objetiva de execução.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 transition-all"
                    style={{ width: `${pac.progressPercent}%` }}
                  />
                </div>
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                  {pac.progressPercent}%
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Nenhuma etapa operacional cadastrada para este PAC.
                </div>
              ) : (
                tasks.map((task) => {
                  const noteVal =
                    evidenceInputs[task.id] !== undefined
                      ? evidenceInputs[task.id]
                      : task.evidenceNote;

                  return (
                    <div key={task.id} className="p-5 space-y-2.5">
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          disabled={!canExecuteTasks || busy}
                          onClick={() =>
                            runAction(() =>
                              togglePacTask(
                                pac,
                                task,
                                !task.completed,
                                noteVal,
                                tasks,
                                profile
                              )
                            )
                          }
                          className="flex items-start gap-3 text-left flex-1 disabled:cursor-default"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <p
                              className={`text-sm font-medium ${
                                task.completed
                                  ? 'line-through text-slate-500'
                                  : 'text-slate-900'
                              }`}
                            >
                              <span className="font-mono text-xs text-slate-400 mr-2">
                                {String(task.order).padStart(2, '0')}.
                              </span>
                              {task.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              Responsável: {task.assigneeName || pac.responsibleName}
                              {task.completed && task.completedByName
                                ? ` · Concluído por ${task.completedByName}`
                                : ''}
                            </p>
                          </div>
                        </button>

                        {isEditorOrAbove &&
                          (pac.status === 'aberto' || pac.status === 'em_execucao') && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(() => removePacTask(pac, task.id, tasks))
                              }
                              className="p-1 text-slate-400 hover:text-rose-600"
                              aria-label="Remover etapa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                      </div>

                      {canExecuteTasks ? (
                        <div className="pl-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={noteVal}
                            onChange={(e) =>
                              setEvidenceInputs((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            placeholder="Evidência de implantação (ex: lista de presença, nº do registro, foto/lote)..."
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          {noteVal !== task.evidenceNote && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(() =>
                                  togglePacTask(
                                    pac,
                                    task,
                                    task.completed,
                                    noteVal,
                                    tasks,
                                    profile
                                  )
                                )
                              }
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap"
                            >
                              Salvar Evidência
                            </button>
                          )}
                        </div>
                      ) : (
                        task.evidenceNote && (
                          <p className="pl-7 text-xs text-slate-600">
                            Evidência: {task.evidenceNote}
                          </p>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isEditorOrAbove &&
              (pac.status === 'aberto' || pac.status === 'em_execucao') && (
                <form
                  onSubmit={handleAddTask}
                  className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Adicionar nova etapa de implantação..."
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={busy || newTaskTitle.trim().length < 2}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Incluir Etapa
                  </button>
                </form>
              )}
          </section>
        </div>
      )}

      {activeTab === 'historico' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Histórico de Movimentações e Verificações
            </h2>
          </div>

          {approvals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum registro histórico disponível.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {approvals.map((ev) => (
                <div
                  key={ev.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {actionLabels[ev.action] || ev.action}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-600">
                        {PAC_STATUS_LABELS[ev.fromStatus as keyof typeof PAC_STATUS_LABELS] ||
                          ev.fromStatus}{' '}
                        →{' '}
                        {PAC_STATUS_LABELS[ev.toStatus as keyof typeof PAC_STATUS_LABELS] ||
                          ev.toStatus}
                      </span>
                    </div>
                    {ev.comment && (
                      <p className="text-sm text-slate-700">{ev.comment}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {ev.actorName} ({ROLE_LABELS[ev.actorRole as UserRole] || ev.actorRole})
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-slate-500 shrink-0">
                    {formatTimestamp(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
