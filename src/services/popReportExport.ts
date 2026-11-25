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

export interface PopReportOptions {
  includeSteps: boolean;
  includeApprovals: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export function buildPopVersionReportHtml(
  pop: PopDocument,
  versions: PopVersion[],
  approvals: PopApprovalEvent[],
  exportedBy: UserPublic,
  options: PopReportOptions
): string {
  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  const versionsHtml =
    sortedVersions.length === 0
      ? `<div class="empty-box">Nenhuma versão vigente publicada até o momento. Este documento encontra-se em ${escapeHtml(
          POP_STATUS_LABELS[pop.status] || pop.status
        )} (v${pop.currentVersion}.0).</div>`
      : sortedVersions
          .map((ver) => {
            const pccCount = ver.steps.filter((s) => s.criticalControl).length;
            const stepsHtml = options.includeSteps
              ? `<div class="steps-wrap">
                  <div class="steps-heading">Etapas Operacionais (${ver.steps.length}${
                  pccCount > 0 ? ` · ${pccCount} Ponto(s) Crítico(s)` : ''
                })</div>
                  <ol class="steps-list">
                    ${ver.steps
                      .map(
                        (s) =>
                          `<li>
                            <span class="mono step-num">${String(s.order).padStart(2, '0')}.</span>
                            <span class="step-title">${escapeHtml(s.title)}</span>${
                              s.criticalControl
                                ? ' <span class="pcc-tag">[PCC]</span>'
                                : ''
                            }${
                              s.description
                                ? `<div class="step-desc">${escapeHtml(s.description)}</div>`
                                : ''
                            }
                          </li>`
                      )
                      .join('')}
                  </ol>
                </div>`
              : '';

            return `<article class="version-card">
              <div class="version-head">
                <div>
                  <span class="mono version-num">v${ver.versionNumber}.0</span>
                  <span class="sep">·</span>
                  <strong class="version-title">${escapeHtml(ver.title)}</strong>
                </div>
                <div class="mono muted">Vigência: ${escapeHtml(
                  formatIsoDate(ver.effectiveDate)
                )}</div>
              </div>
              <p class="change-summary">${escapeHtml(
                ver.changeSummary || 'Sem descrição de alteração registrada.'
              )}</p>
              <div class="meta-line">
                <span>Elaborado por ${escapeHtml(ver.authorName)}</span>
                <span class="sep">·</span>
                <span>Aprovado por ${escapeHtml(ver.approvedByName)}</span>
                <span class="sep">·</span>
                <span class="mono">${ver.steps.length} etapa(s)</span>
              </div>
              ${stepsHtml}
            </article>`;
          })
          .join('');

  const approvalsHtml = options.includeApprovals
    ? `<section class="section">
        <h2>Trilha de Aprovações (${approvals.length})</h2>
        ${
          approvals.length === 0
            ? `<div class="empty-box">Nenhum evento registrado na trilha de aprovações.</div>`
            : `<table class="audit-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Versão</th>
                    <th>Evento</th>
                    <th>Responsável</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  ${approvals
                    .map((ev) => {
                      const actionText = ACTION_LABEL_MAP[ev.action] || ev.action;
                      const roleText =
                        ROLE_LABELS[ev.actorRole as UserRole] || ev.actorRole;
                      return `<tr>
                        <td class="mono nowrap">${escapeHtml(
                          formatTimestamp(ev.createdAt)
                        )}</td>
                        <td class="mono nowrap">v${ev.versionNumber}.0</td>
                        <td>${escapeHtml(actionText)}</td>
                        <td>${escapeHtml(ev.actorName)} <span class="muted">(${escapeHtml(
                        roleText
                      )})</span></td>
                        <td>${escapeHtml(ev.comment || '—')}</td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>`
        }
      </section>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Versões — ${escapeHtml(pop.code)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      line-height: 1.5;
    }
    .sheet {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 32px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }
    .muted { color: #64748b; }
    .nowrap { white-space: nowrap; }
    .sep { color: #cbd5e1; margin: 0 6px; }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 20px;
    }
    .brand { font-size: 13px; font-weight: 700; color: #1d4ed8; letter-spacing: 0.02em; }
    h1 { margin: 4px 0 0 0; font-size: 20px; line-height: 1.25; }
    h2 { margin: 0 0 12px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .header-meta { text-align: right; font-size: 12px; color: #475569; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .summary-item label { display: block; color: #64748b; font-size: 11px; margin-bottom: 2px; }
    .summary-item strong { color: #0f172a; font-weight: 600; }
    .section { margin-top: 24px; }
    .version-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .version-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-size: 13px;
    }
    .version-num { font-weight: 700; color: #1d4ed8; }
    .version-title { color: #0f172a; }
    .change-summary { margin: 8px 0 6px 0; font-size: 13px; color: #1e293b; }
    .meta-line { font-size: 12px; color: #64748b; }
    .steps-wrap {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
    }
    .steps-heading { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .steps-list { margin: 0; padding-left: 0; list-style: none; font-size: 12px; }
    .steps-list li { padding: 4px 0; border-bottom: 1px solid #f8fafc; }
    .step-num { color: #64748b; margin-right: 6px; }
    .step-title { font-weight: 600; color: #0f172a; }
    .pcc-tag { color: #b91c1c; font-weight: 600; font-size: 11px; }
    .step-desc { color: #475569; padding-left: 26px; margin-top: 2px; }
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .audit-table th, .audit-table td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .audit-table th { background: #f8fafc; color: #475569; font-weight: 600; }
    .empty-box {
      padding: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #475569;
      background: #f8fafc;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .sheet { border: none; padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="report-header">
      <div>
        <div class="brand">QualiNorma · Relatório Simplificado de Histórico de Versões</div>
        <h1><span class="mono">${escapeHtml(pop.code)}</span> — ${escapeHtml(pop.title)}</h1>
      </div>
      <div class="header-meta">
        <div>Emitido em <span class="mono">${escapeHtml(generatedAt)}</span></div>
        <div>Por ${escapeHtml(exportedBy.displayName)}</div>
      </div>
    </header>

    <section class="summary-grid">
      <div class="summary-item">
        <label>Status Atual</label>
        <strong>${escapeHtml(POP_STATUS_LABELS[pop.status] || pop.status)}</strong>
      </div>
      <div class="summary-item">
        <label>Versão Atual</label>
        <strong class="mono">v${pop.currentVersion}.0</strong>
      </div>
      <div class="summary-item">
        <label>Departamento / Categoria</label>
        <strong>${escapeHtml(pop.department)} · ${escapeHtml(pop.category)}</strong>
      </div>
      <div class="summary-item">
        <label>Elaborador</label>
        <strong>${escapeHtml(pop.ownerName)}</strong>
      </div>
      <div class="summary-item">
        <label>Vigência Publicada</label>
        <strong class="mono">${escapeHtml(formatIsoDate(pop.effectiveDate))}</strong>
      </div>
      <div class="summary-item">
        <label>Próxima Revisão</label>
        <strong class="mono">${escapeHtml(formatIsoDate(pop.nextReviewDate))}</strong>
      </div>
    </section>

    <section class="section">
      <h2>Histórico de Versões Publicadas (${sortedVersions.length})</h2>
      ${versionsHtml}
    </section>

    ${approvalsHtml}

    <footer class="footer">
      <span>QualiNorma · Controle Documental de POPs</span>
      <span class="mono">${escapeHtml(pop.code)} · ${sortedVersions.length} versão(ões) publicada(s)</span>
    </footer>
  </main>
</body>
</html>`;
}

export function downloadPopVersionReportHtml(
  pop: PopDocument,
  versions: PopVersion[],
  approvals: PopApprovalEvent[],
  exportedBy: UserPublic,
  options: PopReportOptions
): void {
  const html = buildPopVersionReportHtml(
    pop,
    versions,
    approvals,
    exportedBy,
    options
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeCode = pop.code.replace(/[^a-zA-Z0-9_-]/g, '-');
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-versoes-${safeCode}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
