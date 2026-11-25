import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { createPac } from '../services/complianceService';
import {
  DEPARTMENTS,
  FIELD_LIMITS,
  PAC_CODE_REGEX,
  PAC_ORIGIN_LABELS,
  PAC_SEVERITY_LABELS,
  PacOrigin,
  PacSeverity,
  PopDocument,
  UserPublic,
} from '../types/compliance';

interface PacEditorModalProps {
  profile: UserPublic;
  users: UserPublic[];
  pops: PopDocument[];
  preselectedPop?: PopDocument | null;
  onClose: () => void;
  onSaved: (pacId: string) => void;
}

export function PacEditorModal({
  profile,
  users,
  pops,
  preselectedPop,
  onClose,
  onSaved,
}: PacEditorModalProps) {
  const defaultDue = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const [code, setCode] = useState('PAC-2026-');
  const [title, setTitle] = useState(
    preselectedPop ? `Implantação do ${preselectedPop.code}: ${preselectedPop.title}` : ''
  );
  const [origin, setOrigin] = useState<PacOrigin>(
    preselectedPop ? 'implantacao_pop' : 'nao_conformidade'
  );
  const [severity, setSeverity] = useState<PacSeverity>('media');
  const [department, setDepartment] = useState(
    preselectedPop?.department || profile.department || DEPARTMENTS[0]
  );
  const [relatedPopId, setRelatedPopId] = useState(preselectedPop?.id || '');
  const [responsibleId, setResponsibleId] = useState(profile.uid);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [rootCause, setRootCause] = useState(
    preselectedPop
      ? `Necessidade de implantação operacional após aprovação da versão v${preselectedPop.currentVersion}.0 do ${preselectedPop.code}.`
      : ''
  );
  const [actionPlan, setActionPlan] = useState('');
  const [tasks, setTasks] = useState<{ title: string; assigneeName: string }[]>([
    {
      title: 'Treinar equipe envolvida e registrar lista de presença',
      assigneeName: profile.displayName,
    },
    {
      title: 'Disponibilizar recursos e formulários no posto de trabalho',
      assigneeName: profile.displayName,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableUsers = users.length > 0 ? users : [profile];

  function addTaskRow() {
    if (tasks.length >= 20) return;
    const resp = availableUsers.find((u) => u.uid === responsibleId) || profile;
    setTasks([...tasks, { title: '', assigneeName: resp.displayName }]);
  }

  function removeTaskRow(idx: number) {
    setTasks(tasks.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const normalizedCode = code.trim().toUpperCase();
    if (!PAC_CODE_REGEX.test(normalizedCode)) {
      setError('Código inválido. Utilize o formato PAC-2026-001.');
      return;
    }
    if (title.trim().length < 3) {
      setError('O título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (rootCause.trim().length < 3) {
      setError('Descreva a causa raiz ou contexto da implantação.');
      return;
    }
    if (actionPlan.trim().length < 5) {
      setError('Descreva o plano de ação corretiva.');
      return;
    }

    const chosenPop = pops.find((p) => p.id === relatedPopId);
    const chosenResp =
      availableUsers.find((u) => u.uid === responsibleId) || profile;

    setSaving(true);
    try {
      const id = await createPac(
        {
          code: normalizedCode,
          title,
          origin,
          severity,
          department,
          relatedPopId: chosenPop?.id || '',
          relatedPopCode: chosenPop?.code || '',
          rootCause,
          actionPlan,
          responsibleId: chosenResp.uid,
          responsibleName: chosenResp.displayName,
          dueDate,
          initialTasks: tasks.filter((t) => t.title.trim().length >= 2),
        },
        profile
      );
      onSaved(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar PAC.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Novo Plano de Ação Corretiva (PAC)
            </h2>
            <p className="text-xs text-slate-500">
              Estruture causa raiz, responsável, prazo e etapas de implantação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Fechar modal de PAC"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Código do PAC</span>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.CODE_MAX}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PAC-2026-001"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Título do Plano de Ação</span>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Implantação do controle de ATP na linha 01"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Origem</span>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as PacOrigin)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Object.entries(PAC_ORIGIN_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Severidade</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as PacSeverity)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Object.entries(PAC_SEVERITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Departamento</span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">POP Vinculado (opcional)</span>
              <select
                value={relatedPopId}
                onChange={(e) => setRelatedPopId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Sem vínculo direto</option>
                {pops.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Responsável pela Execução</span>
              <select
                value={responsibleId}
                onChange={(e) => setResponsibleId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {availableUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.department})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Prazo Limite</span>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Análise de Causa Raiz / Contexto
            </span>
            <textarea
              required
              rows={2}
              maxLength={FIELD_LIMITS.ROOT_CAUSE_MAX}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Por que a não conformidade ocorreu ou qual requisito exige implantação?"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Descrição do Plano de Ação (Como Implantar)
            </span>
            <textarea
              required
              rows={3}
              maxLength={FIELD_LIMITS.ACTION_PLAN_MAX}
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="Descreva as medidas corretivas, recursos necessários e critérios de verificação."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Etapas Iniciais de Implantação
                </h3>
                <p className="text-xs text-slate-500">
                  O checklist acompanhará o avanço percentual até a verificação de eficácia.
                </p>
              </div>
              <button
                type="button"
                onClick={addTaskRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Tarefa
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.STEP_TITLE_MAX}
                    value={task.title}
                    onChange={(e) =>
                      setTasks(
                        tasks.map((t, i) =>
                          i === idx ? { ...t, title: e.target.value } : t
                        )
                      )
                    }
                    placeholder="Descrição da etapa operacional"
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeTaskRow(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    aria-label="Remover tarefa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Registrando...' : 'Abrir PAC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
