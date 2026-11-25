import { CheckCircle2, ClipboardCheck, FileCheck2 } from 'lucide-react';
import {
  formatIsoDate,
  PacDocument,
  PopDocument,
  UserPublic,
} from '../types/compliance';
import { PacSeverityDisplay, PacStatusDisplay, PopStatusDisplay } from './StatusText';

interface ApprovalsQueueViewProps {
  profile: UserPublic;
  pops: PopDocument[];
  pacs: PacDocument[];
  onSelectPop: (popId: string) => void;
  onSelectPac: (pacId: string) => void;
}

export function ApprovalsQueueView({
  profile,
  pops,
  pacs,
  onSelectPop,
  onSelectPac,
}: ApprovalsQueueViewProps) {
  const isApprover = profile.role === 'aprovador' || profile.role === 'admin';

  const pendingPops = pops.filter(
    (p) => p.status === 'em_revisao' || p.status === 'aguardando_aprovacao'
  );
  const pendingPacs = pacs.filter((p) => p.status === 'aguardando_verificacao');

  return (
    <div className="space-y-6">
      {!isApprover && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
          Seu perfil atual tem acesso de leitura nesta fila. Apenas usuários com nível{' '}
          <strong className="text-slate-900">Aprovador (Qualidade)</strong> ou{' '}
          <strong className="text-slate-900">Administrador</strong> podem aprovar POPs e concluir verificações de eficácia de PACs.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              POPs Aguardando Revisão ou Aprovação Final ({pendingPops.length})
            </h2>
          </div>
        </div>

        {pendingPops.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
            <p className="text-sm font-medium text-slate-800">
              Nenhum POP pendente de aprovação
            </p>
            <p className="text-xs text-slate-500">
              Procedimentos submetidos pelos elaboradores aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingPops.map((pop) => (
              <div
                key={pop.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">
                      {pop.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      v{pop.currentVersion}.0
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{pop.department}</span>
                    <span aria-hidden="true">·</span>
                    <span>Elaborador: {pop.ownerName}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {pop.title}
                  </p>
                  {pop.changeSummary && (
                    <p className="text-xs text-slate-600 line-clamp-1">
                      Alteração: {pop.changeSummary}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <PopStatusDisplay status={pop.status} />
                  <button
                    type="button"
                    onClick={() => onSelectPop(pop.id)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
                  >
                    {isApprover ? 'Analisar e Decidir' : 'Visualizar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              PACs Aguardando Verificação de Eficácia ({pendingPacs.length})
            </h2>
          </div>
        </div>

        {pendingPacs.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
            <p className="text-sm font-medium text-slate-800">
              Nenhum PAC aguardando verificação
            </p>
            <p className="text-xs text-slate-500">
              Planos finalizados pelas áreas operacionais aparecerão aqui para validação.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingPacs.map((pac) => (
              <div
                key={pac.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">
                      {pac.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{pac.department}</span>
                    <span aria-hidden="true">·</span>
                    <span>Resp.: {pac.responsibleName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Prazo: {formatIsoDate(pac.dueDate)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <PacSeverityDisplay severity={pac.severity} />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {pac.title}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <PacStatusDisplay status={pac.status} />
                  <button
                    type="button"
                    onClick={() => onSelectPac(pac.id)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
                  >
                    {isApprover ? 'Verificar Eficácia' : 'Visualizar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
