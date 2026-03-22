/**
 * Shared HTML report formatting utilities.
 * Provides common template parts for generating self-contained HTML reports.
 *
 * @lastUpdated 2026-03-24
 */

export interface ReportOptions {
  title: string;
  subtitle?: string;
  packageName: string;
  packageUrl?: string;
  bugUrl?: string;
  version?: string;
}

export interface StatCard {
  value: string | number;
  label: string;
  color?: string;
}

export interface TableConfig {
  headers: string[];
  rows: string[][];
}

/**
 * Generate the HTML document head with common styles.
 */
export function generateReportHead(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 2rem; background-color: #f9f9f9; }
    h1, h2, h3 { color: #1a1a1a; border-bottom: 2px solid #eaeaea; padding-bottom: 0.5rem; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 2rem; border: 1px solid #eaeaea; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #fff; padding: 1rem; border-radius: 6px; text-align: center; border: 1px solid #eaeaea; }
    .stat-value { font-size: 1.8rem; font-weight: bold; color: #2563eb; }
    .stat-label { font-size: 0.875rem; color: #666; text-transform: uppercase; }
    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    .hero h1 { border: none; color: white; margin: 0; }
    .hero p { margin: 10px 0 0 0; opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: white; border-radius: 4px; overflow: hidden; }
    th, td { text-align: left; padding: 0.875rem 1rem; border-bottom: 1px solid #eaeaea; }
    th { background-color: #f8fafc; font-weight: 600; color: #475569; }
    tr:last-child td { border-bottom: none; }
    .critical { color: #dc2626; font-weight: bold; }
    .major { color: #ea580c; font-weight: bold; }
    .minor { color: #2563eb; }
    .issue-critical { color: #dc2626; font-weight: bold; text-transform: uppercase; }
    .issue-major { color: #ea580c; font-weight: bold; text-transform: uppercase; }
    .issue-minor { color: #2563eb; font-weight: bold; text-transform: uppercase; }
    code { background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.875rem; color: #334155; }
    .footer { margin-top: 4rem; text-align: center; color: #94a3b8; font-size: 0.875rem; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>`;
}

/**
 * Generate a hero section for the report.
 */
export function generateReportHero(title: string, subtitle?: string): string {
  const subtitleHtml = subtitle ? `<p>${subtitle}</p>` : '';
  return `<div class="hero">
    <h1>${title}</h1>
    ${subtitleHtml}
  </div>`;
}

/**
 * Generate stat cards section.
 */
export function generateStatCards(cards: StatCard[]): string {
  const cardsHtml = cards
    .map(
      (card) => `
    <div class="stat-card">
      <div class="stat-value"${card.color ? ` style="color: ${card.color}"` : ''}>${card.value}</div>
      <div class="stat-label">${card.label}</div>
    </div>`
    )
    .join('');

  return `<div class="stats">${cardsHtml}</div>`;
}

/**
 * Generate a score card with a single large value.
 */
export function generateScoreCard(
  value: string | number,
  label: string
): string {
  return `<div class="stat-card" style="margin-bottom: 2rem;">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
  </div>`;
}

/**
 * Generate an HTML table from configuration.
 */
export function generateTable(config: TableConfig): string {
  const headersHtml = config.headers.map((h) => `<th>${h}</th>`).join('');
  const rowsHtml = config.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  return `<table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

/**
 * Generate an issue summary card.
 */
export function generateIssueSummary(
  critical: number,
  major: number,
  minor: number,
  potentialSavings?: number
): string {
  const savingsHtml = potentialSavings
    ? `<p><strong>Potential Savings:</strong> ${potentialSavings.toLocaleString()} tokens</p>`
    : '';

  return `<div class="card" style="margin-bottom: 30px;">
    <h2>⚠️ Issues Summary</h2>
    <p>
      <span class="critical">🔴 Critical: ${critical}</span> &nbsp;
      <span class="major">🟡 Major: ${major}</span> &nbsp;
      <span class="minor">🔵 Minor: ${minor}</span>
    </p>
    ${savingsHtml}
  </div>`;
}

/**
 * Generate the report footer.
 */
export function generateReportFooter(options: ReportOptions): string {
  const versionText = options.version ? ` v${options.version}` : '';
  const links: string[] = [];

  if (options.packageUrl) {
    links.push(`<a href="${options.packageUrl}">Star us on GitHub</a>`);
  }
  if (options.bugUrl) {
    links.push(`<a href="${options.bugUrl}">Report it here</a>`);
  }

  const linksHtml = links.length
    ? links.map((l) => `<p>Like AIReady? ${l}</p>`).join('\n    ')
    : '';

  return `<div class="footer">
    <p>Generated by <strong>@aiready/${options.packageName}</strong>${versionText}</p>
    ${linksHtml}
  </div>`;
}

/**
 * Wrap content in a card div.
 */
export function wrapInCard(content: string, title?: string): string {
  const titleHtml = title ? `<h2>${title}</h2>` : '';
  return `<div class="card">
    ${titleHtml}
    ${content}
  </div>`;
}

/**
 * Generate a complete report by combining all parts.
 */
export function generateCompleteReport(
  options: ReportOptions,
  bodyContent: string
): string {
  return `${generateReportHead(options.title)}
<body>
  ${bodyContent}
  ${generateReportFooter(options)}
</body>
</html>`;
}
