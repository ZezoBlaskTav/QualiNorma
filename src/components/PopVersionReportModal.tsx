import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Printer, X } from 'lucide-react';
import { downloadPopVersionReportHtml } from '../services/popReportExport';
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

interface PopVersionReportModalProps {
  pop: PopDocument;
  versions: PopVersion[];
  approvals: PopApprovalEvent[];
  profile: UserPublic;
  onClose: () => void;
}

const ACTION_LABEL_MAP: Record<PopApprovalEvent['action'], string> = {
  criado: 'Criação',
  submetido: 'Submetido para Revisão',
  revisado: 'Revisão Validada',
  aprovado: 'Aprovado e Publicado',
  reprovado: 'Devolvido para Ajustes',
  nova_revisao: 'Nova Revisão Iniciada',
  arquivado: 'Arquivado como Obsoleto',
};

export function PopVersionReportModal({
  pop,
  versions,
  approvals,
  profile,
  onClose,
}: PopVersionReportModalProps) {
  const [includeSteps, setIncludeSteps] = useState(true);
  const [includeApprovals, setIncludeApprovals] = useState(true);
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  useEffect(() => {
    document.body.classList.add('printing-pop-report');
    return () => {
      document.body.classList.remove('printing-pop-report');
    };
  }, []);

  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleDownloadHtml() {
    downloadPopVersionReportHtml(pop, versions, approvals, profile, {
      includeSteps,
      includeApprovals,
    });
    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 3000);
  }

  function handlePrint() {
    window.print();
  }

  return createPortal(
    <div className="print-report-portal fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="print-report-dialog bg-white border border-slate-200 rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="no-print px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-700 shrink-0" />
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Exportar Relatório Simplificado de Versões
              </h2>
              <p className="text-xs text-slate-500">
                Pré-visualização para impressão em PDF ou download em HTML autônomo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {downloadedNotice ? 'Relatório Baixado' : 'Baixar HTML (.html)'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
              aria-label="Fechar pré-visualização do relatório"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="no-print px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-5 text-xs text-slate-700 shrink-0">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSteps}
              onChange={(e) => setIncludeSteps(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>Incluir etapas operacionais de cada versão</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeApprovals}
              onChange={(e) => setIncludeApprovals(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>Incluir trilha de aprovações</span>
          </label>
        </div>

        <div className="print-report-body flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
          <article
            id="pop-version-report-sheet"
            className="bg-white border border-slate-200 rounded-md max-w-3xl mx-auto p-6 sm:p-8 space-y-6 text-slate-900"
          >
            <header className="pb-4 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700">
                  QualiNorma · Relatório Simplificado de Histórico de Versões
                </p>
                <h1 className="font-display text-lg font-bold text-slate-900">
                  <span className="font-mono">{pop.code}</span> — {pop.title}
                </h1>
              </div>
              <div className="text-xs text-slate-600 sm:text-right shrink-0 space-y-0.5">
                <p>
                  Emitido em{' '}
                  <span className="font-mono tabular-nums">{generatedAt}</span>
                </p>
                <p>Por {profile.displayName}</p>
              </div>
            </header>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs">
              <div>
                <p className="text-slate-500">Status Atual</p>
                <p className="font-semibold text-slate-900">
                  {POP_STATUS_LABELS[pop.status] || pop.status}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Versão Atual</p>
                <p className="font-mono tabular-nums font-semibold text-slate-900">
                  v{pop.currentVersion}.0
                </p>
              </div>
              <div>
                <p className="text-slate-500">Departamento · Categoria</p>
                <p className="font-semibold text-slate-900">
                  {pop.department} · {pop.category}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Elaborador</p>
                <p className="font-semibold text-slate-900">{pop.ownerName}</p>
              </div>
              <div>
                <p className="text-slate-500">Vigência Publicada</p>
                <p className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatIsoDate(pop.effectiveDate)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Próxima Revisão</p>
                <p className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatIsoDate(pop.nextReviewDate)}
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-800 pb-1.5 border-b border-slate-200">
                Histórico de Versões Publicadas ({sortedVersions.length})
              </h2>

              {sortedVersions.length === 0 ? (
                <div className="p-4 border border-slate-200 rounded-md bg-slate-50 text-xs text-slate-600">
                  Nenhuma versão vigente publicada até o momento. Este documento encontra-se em{' '}
                  {POP_STATUS_LABELS[pop.status] || pop.status} (v{pop.currentVersion}.0).
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedVersions.map((ver) => {
                    const pccCount = ver.steps.filter((s) => s.criticalControl).length;
                    return (
                      <div
                        key={ver.id}
                        className="border border-slate-200 rounded-md p-4 space-y-2 break-inside-avoid"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-mono tabular-nums font-bold text-blue-700">
                              v{ver.versionNumber}.0
                            </span>
                            <span aria-hidden="true" className="text-slate-300 mx-2">
                              ·
                            </span>
                            <span className="font-semibold text-slate-900">
                              {ver.title}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-xs text-slate-500">
                            Vigência: {formatIsoDate(ver.effectiveDate)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">
                          {ver.changeSummary || 'Sem descrição de alteração registrada.'}
                        </p>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>Elaborado por {ver.authorName}</span>
                          <span aria-hidden="true">·</span>
                          <span>Aprovado por {ver.approvedByName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {ver.steps.length} etapa(s)
                            {pccCount > 0 ? ` (${pccCount} PCC)` : ''}
                          </span>
                        </div>

                        {includeSteps && ver.steps.length > 0 && (
                          <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
                            <p className="text-xs font-medium text-slate-600">
                              Etapas Operacionais
                            </p>
                            <ol className="space-y-1 text-xs">
                              {ver.steps.map((step) => (
                                <li key={step.order} className="text-slate-700">
                                  <span className="font-mono tabular-nums text-slate-500 mr-1.5">
                                    {String(step.order).padStart(2, '0')}.
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {step.title}
                                  </span>
                                  {step.criticalControl && (
                                    <span className="text-rose-700 font-semibold ml-1.5">
                                      [PCC]
                                    </span>
                                  )}
                                  {step.description && (
                                    <p className="text-slate-600 pl-6">
                                      {step.description}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {includeApprovals && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-slate-800 pb-1.5 border-b border-slate-200">
                  Trilha de Aprovações ({approvals.length})
                </h2>

                {approvals.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-md bg-slate-50 text-xs text-slate-600">
                    Nenhum evento registrado na trilha de aprovações.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-2 px-2.5 whitespace-nowrap">Data / Hora</th>
                          <th className="py-2 px-2.5 whitespace-nowrap">Versão</th>
                          <th className="py-2 px-2.5">Evento</th>
                          <th className="py-2 px-2.5">Responsável</th>
                          <th className="py-2 px-2.5">Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {approvals.map((ev) => (
                          <tr key={ev.id}>
                            <td className="py-2 px-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {formatTimestamp(ev.createdAt)}
                            </td>
                            <td className="py-2 px-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              v{ev.versionNumber}.0
                            </td>
                            <td className="py-2 px-2.5 text-slate-900 font-medium">
                              {ACTION_LABEL_MAP[ev.action] || ev.action}
                            </td>
                            <td className="py-2 px-2.5 text-slate-700">
                              {ev.actorName}{' '}
                              <span className="text-slate-500">
                                ({ROLE_LABELS[ev.actorRole as UserRole] || ev.actorRole})
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-600">
                              {ev.comment || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <footer className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>QualiNorma · Controle Documental de POPs</span>
              <span className="font-mono tabular-nums">
                {pop.code} · {sortedVersions.length} versão(ões) publicada(s)
              </span>
            </footer>
          </article>
        </div>
      </div>
    </div>,
    document.body
  );
}
