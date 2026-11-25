import { useMemo, useState } from 'react';
import { FilePlus2, Search } from 'lucide-react';
import {
  DEPARTMENTS,
  formatIsoDate,
  POP_STATUS_LABELS,
  PopDocument,
  PopStatus,
  UserPublic,
} from '../types/compliance';
import { PopStatusDisplay } from './StatusText';

interface PopsViewProps {
  profile: UserPublic;
  pops: PopDocument[];
  loading: boolean;
  onSelectPop: (popId: string) => void;
  onOpenNewPop: () => void;
}

const STATUS_FILTERS: { id: 'todos' | PopStatus; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'vigente', label: 'Vigentes' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { id: 'em_revisao', label: 'Em Revisão' },
  { id: 'rascunho', label: 'Rascunhos' },
  { id: 'obsoleto', label: 'Obsoletos' },
];

export function PopsView({
  profile,
  pops,
  loading,
  onSelectPop,
  onOpenNewPop,
}: PopsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PopStatus>('todos');
  const [departmentFilter, setDepartmentFilter] = useState('todos');

  const canCreate = profile.role !== 'leitor';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pops
      .filter((pop) => {
        if (statusFilter !== 'todos' && pop.status !== statusFilter) return false;
        if (departmentFilter !== 'todos' && pop.department !== departmentFilter)
          return false;
        if (q) {
          return (
            pop.code.toLowerCase().includes(q) ||
            pop.title.toLowerCase().includes(q) ||
            pop.ownerName.toLowerCase().includes(q) ||
            pop.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [pops, search, statusFilter, departmentFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
          {STATUS_FILTERS.map((tab) => (
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
              placeholder="Buscar código, título ou autor..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filtrar por departamento"
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="todos">Todos os setores</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
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
              {pops.length === 0
                ? 'Nenhum POP cadastrado ainda'
                : `Nenhum POP encontrado para "${POP_STATUS_LABELS[statusFilter as PopStatus] || 'os filtros atuais'}"`}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ajuste os filtros de busca ou crie um novo Procedimento Operacional Padrão para iniciar o fluxo de revisão e aprovação.
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={onOpenNewPop}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors"
              >
                <FilePlus2 className="w-4 h-4" />
                Novo POP
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-4">Título e Setor</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Versão</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Elaborador</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Próx. Revisão</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((pop) => (
                  <tr
                    key={pop.id}
                    onClick={() => onSelectPop(pop.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {pop.code}
                    </td>
                    <td className="py-3 px-4 min-w-[260px]">
                      <div className="font-medium text-slate-900 line-clamp-1">
                        {pop.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span>{pop.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>{pop.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 text-right whitespace-nowrap">
                      v{pop.currentVersion}.0
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {pop.ownerName}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 text-right whitespace-nowrap">
                      {formatIsoDate(pop.nextReviewDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PopStatusDisplay status={pop.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
