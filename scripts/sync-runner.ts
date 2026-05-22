import { Resource } from 'sst';
import { GitHubIssueResolverAgent } from '../src/growth/agents';
import { GitHubService } from '../src/services/github-service';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

async function run() {
  console.log('[SyncRunner] Starting evolution sync runner...');

  const eventType = process.env.EVENT_TYPE;
  const payloadBody = process.env.PAYLOAD_BODY;

  if (!eventType || !payloadBody) {
    console.error('[SyncRunner] Missing EVENT_TYPE or PAYLOAD_BODY');
    process.exit(1);
  }

  const payload = JSON.parse(payloadBody);
  const githubToken = (Resource as any).GithubServiceToken.value;
  const _minimaxApiKey = (Resource as any).MinimaxApiKey.value;

  if (!githubToken) {
    console.error('[SyncRunner] GithubServiceToken not found in Resource');
    process.exit(1);
  }

  const _githubService = new GitHubService(githubToken);
  const resolver = new GitHubIssueResolverAgent({
    trustedAuthors: ['pengcao'], // Standardizing on the user's handle
    generate: async (_prompt: string) => {
      // In a real runner, we would call Minimax/LLM here.
      // For now, we'll use a mock or a simple pass-through if it's a known command.
      console.log('[SyncRunner] Agent generating response...');
      return 'CORE_EVOLUTION_SYNC'; // Simplified for the runner context
    },
  });

  const requestId = randomUUID().slice(0, 8);
  const workingDir = path.join(process.cwd(), `tmp-sync-${requestId}`);

  try {
    fs.mkdirSync(workingDir, { recursive: true });

    if (eventType === 'issues') {
      const { issue, repository } = payload;
      if (!issue || !repository) {
        throw new Error('Invalid issues payload: missing issue or repository');
      }

      console.log(
        `[SyncRunner] Resolving issue #${issue.number} in ${repository.full_name}`
      );

      // Clone the repo
      const repoUrl = `https://x-access-token:${githubToken}@github.com/${repository.full_name}.git`;
      execSync(`git clone ${repoUrl} ${workingDir}`, { stdio: 'inherit' });

      // Identify labels
      const labels = (issue.labels || []).map((l: any) =>
        typeof l === 'string' ? l : l.name
      );

      const result = await resolver.resolve(
        {
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          labels: labels,
          author: issue.user?.login,
        },
        workingDir
      );

      if (result.success) {
        console.log(`[SyncRunner] Resolution successful: ${result.message}`);

        // Push changes if any
        execSync('git push origin main', { cwd: workingDir, stdio: 'inherit' });

        console.log('[SyncRunner] Changes pushed to origin.');
      } else {
        console.error(`[SyncRunner] Resolution failed: ${result.message}`);
      }
    } else {
      console.log(`[SyncRunner] Unsupported event type: ${eventType}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SyncRunner] Error during execution:', message);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(workingDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

run().catch((err) => {
  console.error('[SyncRunner] Fatal error:', err);
  process.exit(1);
});
