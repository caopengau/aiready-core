import { SyncOrchestrator } from '../lib/sync/sync-orchestrator';
import { ConflictResolver } from '../lib/sync/conflict-resolver';
import * as path from 'path';

async function main() {
  const orchestrator = new SyncOrchestrator();
  const resolver = new ConflictResolver();

  // Configuration for the sync
  const options = {
    workingDir: process.env.CLIENT_REPO_PATH || '/tmp/clawmore-test-client',
    hubUrl: path.resolve(__dirname, '../../serverlessclaw'),
    hubBranch: 'main',
    spokeBranch: 'main',
    prefix: 'core-blueprint',
    squash: true,
  };

  console.log('--- ClawMore Two-Way Sync Demo ---');

  try {
    // 1. Attempt to sync Hub updates into the client repo
    await orchestrator.syncHubToSpoke(options);
    console.log('✅ Sync completed successfully.');
  } catch (error: any) {
    console.log('⚠️ Sync failed or encountered conflicts.');

    // 2. Attempt agentic conflict resolution
    try {
      await resolver.resolve(options.workingDir);
      console.log('✅ Conflicts resolved based on sync-rules.json');
    } catch (resolveError: any) {
      console.error('❌ Automatic resolution failed:', resolveError.message);
    }
  }
}

main().catch(console.error);
