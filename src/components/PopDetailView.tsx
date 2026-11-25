import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ClipboardPlus,
  Edit3,
  FileDown,
  GitCompareArrows,
  History,
  RotateCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  advancePopToApproval,
  approveAndPublishPop,
  archivePop,
  rejectPopToDraft,
  startNewPopRevision,
  submitPopForReview,
} from '../services/complianceService';
import {
  formatIsoDate,
  formatTimestamp,
  POP_STATUS_LABELS,
  PopApprovalEvent,
  PopDocument,
  PopVersion,
  ROLE_LABELS,
  UserPublic,
  UserRole,
} from '../types/compliance';
import { PopStatusDisplay } from './StatusText';
import { PopVersionReportModal } from './PopVersionReportModal';

interface PopDetailViewProps {
  pop: PopDocument;
  profile: UserPublic;
  onBack: () => void;
  onEditDraft: (pop: PopDocument) => void;
  onCreateLinkedPac: (pop: PopDocument) => void;
}

type DetailTab = 'documento' | 'versoes' | 'auditoria';

export function PopDetailView({
  pop,
  profile,
  onBack,
  onEditDraft,
  onCreateLinkedPac,
}: PopDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('documento');
  const [versions, setVersions] = useState<PopVersion[]>([]);
  const [approvals, setApprovals] = useState<PopApprovalEvent[]>([]);
  const [actionNote, setActionNote] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState(pop.nextReviewDate || '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<string>('');
  const [compareRightId, setCompareRightId] = useState<string>('');
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const isEditorOrAbove = profile.role !== 'leitor';
  const isApproverOrAdmin =
    profile.role === 'aprovador' || profile.role === 'admin';
  const isAdmin = profile.role === 'admin';

  useEffect(() => {
    const versionsPath = `pops/${pop.id}/versions`;
    const qVersions = query(
      collection(db, 'pops', pop.id, 'versions'),
      where('popId', '==', pop.id)
    );
    const unsubVersions = onSnapshot(
      qVersions,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PopVersion, 'id'>) }))
          .sort((a, b) => b.versionNumber - a.versionNumber);
        setVersions(list);
        if (list.length >= 2) {
          setCompareRightId((prev) => prev || list[0].id);
          setCompareLeftId((prev) => prev || list[1].id);
        } else if (list.length === 1) {
          setCompareRightId((prev) => prev || list[0].id);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, versionsPath)
    );

    const approvalsPath = `pops/${pop.id}/approvals`;
    const qApprovals = query(
      collection(db, 'pops', pop.id, 'approvals'),
      where('entityId', '==', pop.id),
      where('entityType', '==', 'pop')
    );
    const unsubApprovals = onSnapshot(
      qApprovals,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PopApprovalEvent, 'id'>),
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
      (error) => handleFirestoreError(error, OperationType.LIST, approvalsPath)
    );

    return () => {
      unsubVersions();
      unsubApprovals();
    };
  }, [pop.id]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setActionError('');
    try {
      await fn();
      setActionNote('');
      setShowRejectBox(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erro ao executar ação no fluxo.'
      );
    } finally {
      setBusy(false);
    }
  }

  const leftVersion = useMemo(
    () => versions.find((v) => v.id === compareLeftId) || null,
    [versions, compareLeftId]
  );
  const rightVersion = useMemo(
    () => versions.find((v) => v.id === compareRightId) || null,
    [versions, compareRightId]
  );

  const workflowStages: { key: string; label: string; active: boolean; done: boolean }[] = [
    {
      key: 'rascunho',
      label: '01. Elaboração',
      active: pop.status === 'rascunho',
      done: pop.status !== 'rascunho',
    },
    {
      key: 'em_revisao',
      label: '02. Revisão Técnica',
      active: pop.status === 'em_revisao',
      done:
        pop.status === 'aguardando_aprovacao' ||
        pop.status === 'vigente' ||
        pop.status === 'obsoleto',
    },
    {
      key: 'aguardando_aprovacao',
      label: '03. Aprovação Final',
      active: pop.status === 'aguardando_aprovacao',
      done: pop.status === 'vigente' || pop.status === 'obsoleto',
    },
    {
      key: 'vigente',
      label: '04. Vigente',
      active: pop.status === 'vigente',
      done: pop.status === 'obsoleto',
    },
  ];

  const actionLabelMap: Record<PopApprovalEvent['action'], string> = {
    criado: 'Criação',
    submetido: 'Submetido para Revisão',
    revisado: 'Revisão Validada',
    aprovado: 'Aprovado e Publicado',
    reprovado: 'Devolvido para Ajustes',
    nova_revisao: 'Nova Revisão Iniciada',
    arquivado: 'Arquivado como Obsoleto',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para lista de POPs
          </button>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm font-semibold text-blue-700">
              {pop.code}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              /
            </span>
            <h1 className="font-display text-xl font-bold text-slate-900">
              {pop.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums font-medium text-slate-700">
              Versão v{pop.currentVersion}.0
            </span>
            <span aria-hidden="true">·</span>
            <span>{pop.department}</span>
            <span aria-hidden="true">·</span>
            <span>{pop.category}</span>
            <span aria-hidden="true">·</span>
            <span>Elaborador: {pop.ownerName}</span>
            {pop.effectiveDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Vigência: {formatIsoDate(pop.effectiveDate)}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <PopStatusDisplay status={pop.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar Relatório
          </button>

          {pop.status === 'rascunho' && isEditorOrAbove && (
            <>
              <button
                type="button"
                onClick={() => onEditDraft(pop)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Rascunho
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() =>
                    submitPopForReview(pop, actionNote || pop.changeSummary, profile)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                Submeter para Revisão
              </button>
            </>
          )}

          {pop.status === 'em_revisao' && isEditorOrAbove && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(() => advancePopToApproval(pop, actionNote, profile))
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Encaminhar para Aprovação Final
            </button>
          )}

          {(pop.status === 'em_revisao' || pop.status === 'aguardando_aprovacao') &&
            isApproverOrAdmin && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowRejectBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-white border border-rose-300 rounded-md hover:bg-rose-50 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Devolver para Rascunho
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runAction(() =>
                      approveAndPublishPop(pop, actionNote, nextReviewDate, profile)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprovar e Publicar v{pop.currentVersion}.0
                </button>
              </>
            )}

          {pop.status === 'vigente' && isEditorOrAbove && (
            <>
              <button
                type="button"
                onClick={() => onCreateLinkedPac(pop)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                <ClipboardPlus className="w-3.5 h-3.5" />
                Gerar PAC de Implantação
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() =>
                    startNewPopRevision(
                      pop,
                      actionNote || `Revisão v${pop.currentVersion + 1}.0 iniciada.`,
                      profile
                    )
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Iniciar Nova Revisão (v{pop.currentVersion + 1}.0)
              </button>
            </>
          )}

          {pop.status !== 'obsoleto' && isAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  archivePop(pop, actionNote || 'Documento arquivado.', profile)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              Arquivar
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
          {actionError}
        </div>
      )}

      {pop.lastRejectionReason && pop.status === 'rascunho' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-rose-900">
              Devolvido na etapa de aprovação
            </p>
            <p className="text-xs text-rose-800 leading-relaxed">
              {pop.lastRejectionReason}
            </p>
          </div>
        </div>
      )}

      {showRejectBox && (
        <div className="bg-white border border-rose-200 rounded-lg p-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-900">
              Justificativa obrigatória para devolução ao elaborador
            </span>
            <textarea
              rows={2}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Indique exatamente quais itens técnicos ou operacionais precisam de correção."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectBox(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy || actionNote.trim().length < 3}
              onClick={() => runAction(() => rejectPopToDraft(pop, actionNote, profile))}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-700 rounded-md hover:bg-rose-800 disabled:opacity-50"
            >
              Confirmar Devolução
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('documento')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'documento'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Documento e Fluxo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('versoes')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'versoes'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          Histórico de Versões ({versions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('auditoria')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'auditoria'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Trilha de Aprovações ({approvals.length})
        </button>
      </div>

      {activeTab === 'documento' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-700">
                Fluxo de Aprovação do Procedimento
              </h2>
              {pop.approverName && (
                <span className="text-xs text-slate-500">
                  Último aprovador: {pop.approverName}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {workflowStages.map((stage) => (
                <div
                  key={stage.key}
                  className={`p-3 rounded-md border text-xs ${
                    stage.active
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold'
                      : stage.done
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800 font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  {stage.label}
                </div>
              ))}
            </div>

            {(pop.status === 'em_revisao' || pop.status === 'aguardando_aprovacao') &&
              isApproverOrAdmin &&
              !showRejectBox && (
                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium text-slate-700">
                      Parecer da aprovação (opcional)
                    </span>
                    <input
                      type="text"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Ex: Procedimento validado conforme requisitos sanitários."
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">
                      Próxima revisão
                    </span>
                    <input
                      type="date"
                      value={nextReviewDate}
                      onChange={(e) => setNextReviewDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                </div>
              )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            <div className="p-6 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500">01. Objetivo</h3>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {pop.objective}
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">
                  02. Abrangência e Aplicação
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {pop.scope}
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">
                  03. Responsabilidades
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {pop.responsibilities || 'Não especificado.'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500">
                04. Etapas Operacionais ({pop.steps.length})
              </h3>
              <ol className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                {pop.steps.map((step) => (
                  <li key={step.order} className="p-4 flex items-start gap-4">
                    <span className="font-mono tabular-nums text-xs font-semibold text-slate-500 pt-0.5 shrink-0">
                      {String(step.order).padStart(2, '0')}
                    </span>
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {step.title}
                        </span>
                        {step.criticalControl && (
                          <span className="text-xs font-semibold text-rose-700">
                            · Ponto Crítico de Controle
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {pop.changeSummary && (
              <div className="p-6 space-y-1 bg-slate-50/70">
                <h3 className="text-xs font-semibold text-slate-500">
                  Resumo da Revisão Atual (v{pop.currentVersion}.0)
                </h3>
                <p className="text-sm text-slate-700">{pop.changeSummary}</p>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'versoes' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Versões Publicadas e Imutáveis
                </h2>
                <p className="text-xs text-slate-500">
                  Cada aprovação gera um registro congelado para consulta e auditoria normativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="w-3.5 h-3.5" />
                Exportar Relatório Visual
              </button>
            </div>

            {versions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhuma versão vigente publicada ainda. A versão v1.0 será gravada aqui após a primeira aprovação final.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {versions.map((ver) => (
                  <div key={ver.id} className="p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                          v{ver.versionNumber}.0
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {ver.title}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-xs text-slate-500">
                        Vigência: {formatIsoDate(ver.effectiveDate)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{ver.changeSummary}</p>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>Elaborado por {ver.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Aprovado por {ver.approvedByName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {ver.steps.length} etapas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {versions.length >= 2 && (
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Comparativo entre Versões
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione duas versões publicadas para inspecionar alterações de conteúdo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={compareLeftId}
                    onChange={(e) => setCompareLeftId(e.target.value)}
                    aria-label="Versão anterior"
                    className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Base: v{v.versionNumber}.0
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">vs</span>
                  <select
                    value={compareRightId}
                    onChange={(e) => setCompareRightId(e.target.value)}
                    aria-label="Versão comparada"
                    className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Alvo: v{v.versionNumber}.0
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {leftVersion && rightVersion && (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-200 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    <div className="p-4 space-y-1">
                      <p className="font-semibold text-slate-500">
                        Título (v{leftVersion.versionNumber}.0)
                      </p>
                      <p className="text-slate-800">{leftVersion.title}</p>
                    </div>
                    <div
                      className={`p-4 space-y-1 ${
                        leftVersion.title !== rightVersion.title
                          ? 'bg-amber-50/60'
                          : ''
                      }`}
                    >
                      <p className="font-semibold text-slate-500">
                        Título (v{rightVersion.versionNumber}.0)
                        {leftVersion.title !== rightVersion.title && ' · Alterado'}
                      </p>
                      <p className="text-slate-900 font-medium">
                        {rightVersion.title}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    <div className="p-4 space-y-1">
                      <p className="font-semibold text-slate-500">
                        Objetivo (v{leftVersion.versionNumber}.0)
                      </p>
                      <p className="text-slate-700 leading-relaxed">
                        {leftVersion.objective}
                      </p>
                    </div>
                    <div
                      className={`p-4 space-y-1 ${
                        leftVersion.objective !== rightVersion.objective
                          ? 'bg-amber-50/60'
                          : ''
                      }`}
                    >
                      <p className="font-semibold text-slate-500">
                        Objetivo (v{rightVersion.versionNumber}.0)
                        {leftVersion.objective !== rightVersion.objective &&
                          ' · Alterado'}
                      </p>
                      <p className="text-slate-800 leading-relaxed">
                        {rightVersion.objective}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    <div className="p-4 space-y-2">
                      <p className="font-semibold text-slate-500">
                        Etapas (v{leftVersion.versionNumber}.0 ·{' '}
                        {leftVersion.steps.length})
                      </p>
                      <ul className="space-y-1.5 text-slate-700">
                        {leftVersion.steps.map((s) => (
                          <li key={s.order}>
                            <span className="font-mono font-medium">
                              {String(s.order).padStart(2, '0')}.
                            </span>{' '}
                            {s.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="font-semibold text-slate-500">
                        Etapas (v{rightVersion.versionNumber}.0 ·{' '}
                        {rightVersion.steps.length})
                      </p>
                      <ul className="space-y-1.5 text-slate-800">
                        {rightVersion.steps.map((s) => {
                          const existed = leftVersion.steps.some(
                            (ls) =>
                              ls.title === s.title && ls.description === s.description
                          );
                          return (
                            <li
                              key={s.order}
                              className={!existed ? 'text-emerald-800 font-medium' : ''}
                            >
                              <span className="font-mono">
                                {String(s.order).padStart(2, '0')}.
                              </span>{' '}
                              {s.title} {!existed && '(Nova ou alterada)'}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {activeTab === 'auditoria' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Trilha de Auditoria e Aprovações
            </h2>
            <p className="text-xs text-slate-500">
              Histórico cronológico imutável de submissões, revisões, aprovações e devoluções.
            </p>
          </div>

          {approvals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {approvals.map((ev) => (
                <div key={ev.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {actionLabelMap[ev.action] || ev.action}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-slate-600">
                        v{ev.versionNumber}.0
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-600">
                        {POP_STATUS_LABELS[ev.fromStatus as keyof typeof POP_STATUS_LABELS] ||
                          ev.fromStatus}{' '}
                        →{' '}
                        {POP_STATUS_LABELS[ev.toStatus as keyof typeof POP_STATUS_LABELS] ||
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

      {reportModalOpen && (
        <PopVersionReportModal
          pop={pop}
          versions={versions}
          approvals={approvals}
          profile={profile}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </div>
  );
}
