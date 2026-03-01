import { execSync } from 'child_process';

/**
 * Get git commit timestamps for each line in a file
 */
export function getFileCommitTimestamps(file: string): Record<number, number> {
  const lineStamps: Record<number, number> = {};
  try {
    const output = execSync(`git blame -t "${file}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = output.split('\n');
    for (const line of lines) {
      if (!line) continue;
      const match = line.match(/^\S+\s+\(.*?(\d{10,})\s+[-+]\d+\s+(\d+)\)/);
      if (match) {
        const ts = parseInt(match[1], 10);
        const ln = parseInt(match[2], 10);
        lineStamps[ln] = ts;
      }
    }
  } catch {
    // Ignore errors (file untracked, new file, etc)
  }
  return lineStamps;
}

/**
 * Get the latest commit timestamp for a line range
 */
export function getLineRangeLastModifiedCached(
  lineStamps: Record<number, number>,
  startLine: number,
  endLine: number
): number {
  let latest = 0;
  for (let i = startLine; i <= endLine; i++) {
    if (lineStamps[i] && lineStamps[i] > latest) {
      latest = lineStamps[i];
    }
  }
  return latest;
}

/**
 * Get repository metadata (URL, branch, commit, author)
 */
export function getRepoMetadata(directory: string): {
  url?: string;
  branch?: string;
  commit?: string;
  author?: string;
} {
  const metadata: any = {};
  try {
    // Get remote URL
    try {
      metadata.url = execSync('git config --get remote.origin.url', {
        cwd: directory,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // No remote origin
    }

    // Get current branch
    try {
      metadata.branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: directory,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // Not on a branch
    }

    // Get latest commit hash
    try {
      metadata.commit = execSync('git rev-parse HEAD', {
        cwd: directory,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // No commits
    }

    // Get last author
    try {
      metadata.author = execSync('git log -1 --format=%ae', {
        cwd: directory,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // No log
    }
  } catch {
    // Not a git repo or git not installed
  }
  return metadata;
}
