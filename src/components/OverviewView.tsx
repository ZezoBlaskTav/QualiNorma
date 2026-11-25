import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { seedSampleComplianceData } from '../services/complianceService';
import {
  formatIsoDate,
  PacDocument,
  PopDocument,
  UserPublic,
} from '../types/compliance';
import { PacStatusDisplay, PopStatusDisplay } from './StatusText';

interface OverviewViewProps {
  profile: UserPublic;
  pops: PopDocument[];
  pacs: PacDocument[];
  loading: boolean;
  onSelectPop: (popId: string) => void;
  onSelectPac: (pacId: string) => void;
  onOpenNewPop: () => void;
  onOpenNewPac: () => void;
  onNavigateTab: (tab: 'pops' | 'pacs' | 'approvals') => void;
}

export function OverviewView({
  profile,
  pops,
  pacs,
  loading,
  onSelectPop,
  onSelectPac,
  onOpenNewPop,
  onOpenNewPac,
  onNavigateTab,
}: OverviewViewProps) {
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');

  const canEdit = profile.role !== 'leitor';
  const isAdmin = profile.role === 'admin';

  const vigentesCount = pops.filter((p) => p.status === 'vigente').length;
  const popsPendingCount = pops.filter(
    (p) => p.status === 'em_revisao' || p.status === 'aguardando_aprovacao'
  ).length;
  const pacsActiveCount = pacs.filter(
    (p) => p.status === 'aberto' || p.status === 'em_execucao'
  ).length;
  const pacsVerifyCount = pacs.filter(
    (p) => p.status === 'aguardando_verificacao'
  ).length;
  const pacsCompletedCount = pacs.filter((p) => p.status === 'concluido').length;

  const pendingPops = pops.filter(
    (p) => p.status === 'em_revisao' || p.status === 'aguardando_aprovacao'
  );
  const pendingPacs = pacs.filter((p) => p.status === 'aguardando_verificacao');

  const todayIso = new Date().toISOString().slice(0, 10);
  const activePacs = pacs
    .filter((p) => p.status === 'aberto' || p.status === 'em_execucao')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  async function handleSeed() {
    setSeeding(true);
    setSeedError('');
    try {
      await seedSampleComplianceData(profile);
    } catch (err) {
      setSeedError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados modelo.'
      );
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
          <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (pops.length === 0 && pacs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 lg:p-10 max-w-3xl">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Ambiente pronto para controle de POPs e PACs
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ainda não há Procedimentos Operacionais Padrão ou Planos de Ação Corretiva cadastrados neste repositório. Crie o primeiro registro manualmente ou carregue uma base modelo para testar imediatamente os fluxos de aprovação, etapas de implantação e comparativo de versões.
          </p>
        </div>

        {seedError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
            {seedError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onOpenNewPop}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                Criar Primeiro POP
              </button>
              <button
                type="button"
                onClick={onOpenNewPac}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
              >
                <ClipboardList className="w-4 h-4" />
                Criar Primeiro PAC
              </button>
            </>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
            >
              <Database className="w-4 h-4" />
              {seeding ? 'Carregando base...' : 'Carregar Base Modelo (POPs e PACs)'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">POPs Vigentes</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {vigentesCount}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {pops.length} procedimentos no total
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Aguardando Aprovação</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {popsPendingCount + pacsVerifyCount}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {popsPendingCount} POPs · {pacsVerifyCount} PACs
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">PACs em Implantação</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {pacsActiveCount}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Abertos ou em execução ativa
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">PACs Concluídos</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700">
            {pacsCompletedCount}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Eficácia verificada e aprovada
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Fila de Aprovações e Verificações
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('approvals')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Ver fila completa
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingPops.length === 0 && pendingPacs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-sm font-medium text-slate-800">
                Nenhuma pendência aguardando decisão
              </p>
              <p className="text-xs text-slate-500">
                Todos os POPs submetidos e PACs finalizados já foram analisados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingPops.slice(0, 4).map((pop) => (
                <button
                  key={pop.id}
                  type="button"
                  onClick={() => onSelectPop(pop.id)}
                  className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-800">
                        {pop.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        v{pop.currentVersion}.0
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{pop.department}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {pop.title}
                    </p>
                  </div>
                  <PopStatusDisplay status={pop.status} />
                </button>
              ))}

              {pendingPacs.slice(0, 4).map((pac) => (
                <button
                  key={pac.id}
                  type="button"
                  onClick={() => onSelectPac(pac.id)}
                  className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-800">
                        {pac.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{pac.department}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {pac.progressPercent}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {pac.title}
                    </p>
                  </div>
                  <PacStatusDisplay status={pac.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                PACs em Implantação e Prazos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('pacs')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Ver todos os PACs
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activePacs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <ClipboardList className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-800">
                Nenhum PAC em execução no momento
              </p>
              <p className="text-xs text-slate-500">
                Novos planos de ação corretiva aparecerão aqui com seu percentual de implantação.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activePacs.slice(0, 6).map((pac) => {
                const isOverdue = pac.dueDate && pac.dueDate < todayIso;
                return (
                  <button
                    key={pac.id}
                    type="button"
                    onClick={() => onSelectPac(pac.id)}
                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-800">
                          {pac.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{pac.responsibleName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-mono tabular-nums ${
                            isOverdue ? 'text-rose-700 font-semibold' : ''
                          }`}
                        >
                          Prazo {formatIsoDate(pac.dueDate)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {pac.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                        {pac.progressPercent}%
                      </span>
                      <PacStatusDisplay status={pac.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
