/**
 * Standard CSS styles for AIReady HTML reports.
 * Used by @aiready/core and other packages for consistent report appearance.
 */

export const REPORT_STYLES = `
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
`;
