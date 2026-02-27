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
