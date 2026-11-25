import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { createPop, updatePopDraft } from '../services/complianceService';
import {
  DEPARTMENTS,
  FIELD_LIMITS,
  POP_CATEGORIES,
  POP_CODE_REGEX,
  PopDocument,
  PopStep,
  UserPublic,
} from '../types/compliance';

interface PopEditorModalProps {
  profile: UserPublic;
  editingPop?: PopDocument | null;
  onClose: () => void;
  onSaved: (popId: string) => void;
}

export function PopEditorModal({
  profile,
  editingPop,
  onClose,
  onSaved,
}: PopEditorModalProps) {
  const defaultNextYear = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const [code, setCode] = useState(editingPop?.code || 'POP-GQ-');
  const [title, setTitle] = useState(editingPop?.title || '');
  const [department, setDepartment] = useState(
    editingPop?.department || profile.department || DEPARTMENTS[0]
  );
  const [category, setCategory] = useState(
    editingPop?.category || POP_CATEGORIES[0]
  );
  const [nextReviewDate, setNextReviewDate] = useState(
    editingPop?.nextReviewDate || defaultNextYear
  );
  const [objective, setObjective] = useState(editingPop?.objective || '');
  const [scope, setScope] = useState(editingPop?.scope || '');
  const [responsibilities, setResponsibilities] = useState(
    editingPop?.responsibilities || ''
  );
  const [changeSummary, setChangeSummary] = useState(
    editingPop?.changeSummary || ''
  );
  const [steps, setSteps] = useState<PopStep[]>(
    editingPop?.steps?.length
      ? editingPop.steps
      : [
          {
            order: 1,
            title: '',
            description: '',
            criticalControl: false,
          },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addStep() {
    if (steps.length >= FIELD_LIMITS.STEPS_MAX) return;
    setSteps([
      ...steps,
      {
        order: steps.length + 1,
        title: '',
        description: '',
        criticalControl: false,
      },
    ]);
  }

  function removeStep(idx: number) {
    if (steps.length <= 1) return;
    const next = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(next);
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const copy = [...steps];
    const tmp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = tmp;
    setSteps(copy.map((s, i) => ({ ...s, order: i + 1 })));
  }

  function updateStep(idx: number, patch: Partial<PopStep>) {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const normalizedCode = code.trim().toUpperCase();
    if (!POP_CODE_REGEX.test(normalizedCode)) {
      setError('Código inválido. Use o padrão POP-XX-001 (ex: POP-GQ-001).');
      return;
    }
    if (title.trim().length < 3) {
      setError('O título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (objective.trim().length < 5) {
      setError('O objetivo deve ter pelo menos 5 caracteres.');
      return;
    }
    if (scope.trim().length < 3) {
      setError('A abrangência deve ter pelo menos 3 caracteres.');
      return;
    }
    const validSteps = steps.filter((s) => s.title.trim().length > 0);
    if (validSteps.length === 0) {
      setError('Inclua pelo menos uma etapa operacional preenchida.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: normalizedCode,
        title,
        department,
        category,
        objective,
        scope,
        responsibilities,
        steps: validSteps,
        changeSummary,
        nextReviewDate,
      };
      if (editingPop) {
        await updatePopDraft(editingPop.id, payload);
        onSaved(editingPop.id);
      } else {
        const id = await createPop(payload, profile);
        onSaved(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar POP.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              {editingPop
                ? `Editar Rascunho · ${editingPop.code} (v${editingPop.currentVersion}.0)`
                : 'Novo Procedimento Operacional Padrão (POP)'}
            </h2>
            <p className="text-xs text-slate-500">
              Preencha os requisitos normativos e as etapas ordenadas de execução.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Fechar editor de POP"
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
              <span className="text-xs font-medium text-slate-700">Código do POP</span>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.CODE_MAX}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="POP-GQ-001"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </label>

            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Título do Procedimento</span>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Higienização e Sanitização de Superfícies"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Categoria</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {POP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Próxima Revisão Prevista</span>
              <input
                type="date"
                value={nextReviewDate}
                onChange={(e) => setNextReviewDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Objetivo</span>
            <textarea
              required
              rows={2}
              maxLength={FIELD_LIMITS.OBJECTIVE_MAX}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Descreva a finalidade técnica e o resultado esperado deste procedimento."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Abrangência / Aplicação</span>
              <textarea
                required
                rows={2}
                maxLength={FIELD_LIMITS.SCOPE_MAX}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Setores, turnos ou equipamentos cobertos."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Responsabilidades</span>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.RESPONSIBILITIES_MAX}
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Quem executa, quem supervisiona e quem audita."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Etapas do Procedimento
                </h3>
                <p className="text-xs text-slate-500">
                  Máximo de {FIELD_LIMITS.STEPS_MAX} etapas ordenadas.
                </p>
              </div>
              <button
                type="button"
                onClick={addStep}
                disabled={steps.length >= FIELD_LIMITS.STEPS_MAX}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Etapa
              </button>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
              {steps.map((step, idx) => (
                <div key={idx} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                      Etapa {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 mr-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.criticalControl}
                          onChange={(e) =>
                            updateStep(idx, { criticalControl: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <span>Ponto Crítico (PCC)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => moveStep(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Mover etapa para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Mover etapa para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        disabled={steps.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                        aria-label="Remover etapa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.STEP_TITLE_MAX}
                    value={step.title}
                    onChange={(e) => updateStep(idx, { title: e.target.value })}
                    placeholder="Título da ação operacional"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <textarea
                    rows={2}
                    maxLength={FIELD_LIMITS.STEP_DESC_MAX}
                    value={step.description}
                    onChange={(e) => updateStep(idx, { description: e.target.value })}
                    placeholder="Instruções detalhadas, parâmetros de controle e tolerâncias."
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Resumo da Revisão / Histórico de Alteração
            </span>
            <input
              type="text"
              maxLength={FIELD_LIMITS.CHANGE_SUMMARY_MAX}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Descreva o motivo desta emissão ou o que foi alterado nesta versão."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Salvando...' : editingPop ? 'Salvar Alterações' : 'Criar Rascunho do POP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
