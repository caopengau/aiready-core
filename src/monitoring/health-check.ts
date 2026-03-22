/**
 * AIReady Shared Health Check Worker Logic
 * This file is shared across multiple projects.
 * Configuration is driven by Environment Variables in wrangler.toml
 */

interface HealthCheckResult {
  url: string;
  status: 'healthy' | 'unhealthy' | 'error';
  statusCode?: number;
  responseTime?: number;
  timestamp: string;
  error?: string;
}

const DEFAULT_TIMEOUT = 10000;

async function checkHealth(
  url: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const isHealthy = response.status >= 200 && response.status < 400;

    return {
      url,
      status: isHealthy ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      url,
      status: 'error',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function reportFailure(
  result: HealthCheckResult,
  healthApiUrl: string,
  projectName: string
) {
  if (result.status === 'healthy') return;

  const payload = {
    subject: `⚠️ ${projectName} Outage: ${result.url}`,
    message: `Health check failed for ${projectName} at ${result.timestamp}`,
    failedUrls: [result.url],
    details: [result],
  };

  try {
    await fetch(`${healthApiUrl}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Failed to report failure:', e);
  }
}

interface WorkerHandler {
  scheduled(event: any, env: any, ctx: any): Promise<void>;
  fetch(request: Request, env: any): Promise<Response>;
}

const handler: WorkerHandler = {
  async scheduled(_event: any, env: any) {
    const url = env.URL_TO_CHECK;
    const projectName = env.PROJECT_NAME || 'Unknown Project';

    if (!url) {
      console.error('URL_TO_CHECK not configured in environment');
      return;
    }

    const result = await checkHealth(url);
    console.log(
      `${result.status === 'healthy' ? '✅' : '❌'} [${projectName}] ${result.url}: ${result.status}`
    );

    if (result.status !== 'healthy') {
      await reportFailure(result, env.HEALTH_API_URL, projectName);
    }
  },

  async fetch(_request: Request, env: any) {
    const url = env.URL_TO_CHECK;
    if (!url)
      return new Response('URL_TO_CHECK not configured', { status: 500 });

    const result = await checkHealth(url);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

export default handler;
