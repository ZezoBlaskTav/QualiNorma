import { useMemo, useState } from 'react';
import { ClipboardPlus, Search } from 'lucide-react';
import {
  formatIsoDate,
  PAC_ORIGIN_LABELS,
  PAC_STATUS_LABELS,
  PacDocument,
  PacSeverity,
  PacStatus,
  UserPublic,
} from '../types/compliance';
import { PacSeverityDisplay, PacStatusDisplay } from './StatusText';

interface PacsViewProps {
  profile: UserPublic;
  pacs: PacDocument[];
  loading: boolean;
  onSelectPac: (pacId: string) => void;
  onOpenNewPac: () => void;
}

const STATUS_TABS: { id: 'todos' | PacStatus; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'aberto', label: 'Abertos' },
  { id: 'em_execucao', label: 'Em Execução' },
  { id: 'aguardando_verificacao', label: 'Aguardando Verificação' },
  { id: 'concluido', label: 'Concluídos' },
  { id: 'cancelado', label: 'Cancelados' },
];

export function PacsView({
  profile,
  pacs,
  loading,
  onSelectPac,
  onOpenNewPac,
}: PacsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PacStatus>('todos');
  const [severityFilter, setSeverityFilter] = useState<'todas' | PacSeverity>('todas');

  const canCreate = profile.role !== 'leitor';
  const todayIso = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pacs
      .filter((pac) => {
        if (statusFilter !== 'todos' && pac.status !== statusFilter) return false;
        if (severityFilter !== 'todas' && pac.severity !== severityFilter)
          return false;
        if (q) {
          return (
            pac.code.toLowerCase().includes(q) ||
            pac.title.toLowerCase().includes(q) ||
            pac.responsibleName.toLowerCase().includes(q) ||
            pac.relatedPopCode.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [pacs, search, statusFilter, severityFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar PAC, POP ou responsável..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value as 'todas' | PacSeverity)
            }
            aria-label="Filtrar por severidade"
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="todas">Todas as severidades</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800">
              {pacs.length === 0
                ? 'Nenhum PAC cadastrado ainda'
                : `Nenhum PAC encontrado para "${PAC_STATUS_LABELS[statusFilter as PacStatus] || 'os filtros atuais'}"`}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Abra um Plano de Ação Corretiva para implantar novos POPs ou tratar não conformidades de auditoria.
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={onOpenNewPac}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
              >
                <ClipboardPlus className="w-4 h-4" />
                Novo PAC
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-4">Plano de Ação e Origem</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">POP Vínculo</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Severidade</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Avanço</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Prazo</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((pac) => {
                  const overdue =
                    pac.dueDate &&
                    pac.dueDate < todayIso &&
                    pac.status !== 'concluido' &&
                    pac.status !== 'cancelado';

                  return (
                    <tr
                      key={pac.id}
                      onClick={() => onSelectPac(pac.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {pac.code}
                      </td>
                      <td className="py-3 px-4 min-w-[240px]">
                        <div className="font-medium text-slate-900 line-clamp-1">
                          {pac.title}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span>{PAC_ORIGIN_LABELS[pac.origin]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{pac.department}</span>
                          <span aria-hidden="true">·</span>
                          <span>Resp.: {pac.responsibleName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {pac.relatedPopCode || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PacSeverityDisplay severity={pac.severity} />
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700 text-right whitespace-nowrap">
                        {pac.progressPercent}%
                      </td>
                      <td
                        className={`py-3 px-4 font-mono tabular-nums text-right whitespace-nowrap ${
                          overdue ? 'text-rose-700 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        {formatIsoDate(pac.dueDate)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PacStatusDisplay status={pac.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
