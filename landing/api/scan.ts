import { json, allowedCorsHeaders, LandingEvent as Event } from './utils';

export async function handler(event: Event) {
  const method = event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return json(200, {}, allowedCorsHeaders());
  }

  try {
    if (!event.body) return json(400, { error: 'Missing request body' });

    const payload = JSON.parse(event.body);
    // Accept `directory` relative to repo root, default '.'
    const directory = payload.directory || '.';
    const toolsArray = payload.tools
      ? payload.tools.split(',').map((t: string) => t.trim())
      : undefined;
    const include = payload.include ? payload.include.split(',') : undefined;
    const exclude = payload.exclude ? payload.exclude.split(',') : undefined;

    const options: any = {
      rootDir: directory,
      tools: toolsArray,
      include,
      exclude,
    };

    // Run programmatic analysis (dynamic import to avoid build-time type errors)
    const { analyzeUnified } = await import('@aiready/cli');
    const results = await analyzeUnified(options);

    // Normalize execution time to seconds (CLI displays seconds)
    const summary = {
      ...results.summary,
      executionTime: Number((results.summary.executionTime / 1000).toFixed(2)),
    };

    const responseBody: any = {
      ...results,
      summary,
    };

    // Optional scoring: replicate CLI behavior when `score` flag is set
    if (payload.score) {
      const toolScores: Map<string, any> = new Map();

      if (results.duplicates && options.tools?.includes('patterns')) {
        const { calculatePatternScore } =
          await import('@aiready/pattern-detect');
        const score = calculatePatternScore(
          results.duplicates,
          results.patterns?.length || 0
        );
        toolScores.set('pattern-detect', score);
      }

      if (results.context && options.tools?.includes('context')) {
        const { calculateContextScore } =
          await import('@aiready/context-analyzer');
        const ctx = results.context;
        const contextSummary = {
          avgContextBudget:
            ctx.reduce(
              (sum: number, r: any) => sum + (r.contextBudget || 0),
              0
            ) / Math.max(1, ctx.length),
          maxContextBudget: Math.max(
            ...ctx.map((r: any) => r.contextBudget || 0)
          ),
          avgImportDepth:
            ctx.reduce((sum: number, r: any) => sum + (r.importDepth || 0), 0) /
            Math.max(1, ctx.length),
          maxImportDepth: Math.max(...ctx.map((r: any) => r.importDepth || 0)),
          avgFragmentation:
            ctx.reduce(
              (sum: number, r: any) => sum + (r.fragmentationScore || 0),
              0
            ) / Math.max(1, ctx.length),
          criticalIssues: ctx.filter((r: any) => r.severity === 'critical')
            .length,
          majorIssues: ctx.filter((r: any) => r.severity === 'major').length,
        };
        const score = calculateContextScore(contextSummary as any);
        toolScores.set('context-analyzer', score);
      }

      if (results.consistency && options.tools?.includes('consistency')) {
        const { calculateConsistencyScore } =
          await import('@aiready/consistency');
        const issues =
          results.consistency.results?.flatMap((r: any) => r.issues) || [];
        const score = calculateConsistencyScore(
          issues,
          results.consistency.summary.filesAnalyzed || 0
        );
        toolScores.set('consistency', score);
      }

      // Calculate overall score if we have tool outputs
      if (toolScores.size > 0) {
        const { calculateOverallScore, parseWeightString } =
          await import('@aiready/core');
        const cliWeights = parseWeightString(payload.weights);
        const scoring = calculateOverallScore(toolScores, options, cliWeights);
        responseBody.scoring = scoring;
      }
    }

    return json(200, { ok: true, results: responseBody });
  } catch (err: any) {
    console.error('scan handler error', err);
    return json(500, { error: err?.message || 'Internal error' });
  }
}
