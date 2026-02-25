/**
 * Temporal Tracking Utilities
 * 
 * Manages score history storage and retrieval for trend analysis.
 * Stores data in .aiready/history/ directory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Path to history storage
 */
function getHistoryPath(rootDir: string): string {
  return join(rootDir, '.aiready', 'history.json');
}

/**
 * Load score history from disk
 */
export function loadScoreHistory(rootDir: string): any[] {
  const historyPath = getHistoryPath(rootDir);
  
  if (!existsSync(historyPath)) {
    return [];
  }
  
  try {
    const data = readFileSync(historyPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to load score history:', error);
    return [];
  }
}

/**
 * Save score entry to history
 */
export function saveScoreEntry(
  rootDir: string,
  entry: {
    overallScore: number;
    breakdown: Record<string, number>;
    totalIssues: number;
    totalTokens: number;
  }
): void {
  const historyPath = getHistoryPath(rootDir);
  const historyDir = dirname(historyPath);
  
  // Ensure directory exists
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }
  
  // Load existing history
  const history = loadScoreHistory(rootDir);
  
  // Add new entry with timestamp
  const newEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  
  // Keep last 365 days of data (approximately)
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const filteredHistory = history.filter(
    (e: any) => new Date(e.timestamp).getTime() > oneYearAgo
  );
  
  // Add new entry
  filteredHistory.push(newEntry);
  
  // Save back
  writeFileSync(historyPath, JSON.stringify(filteredHistory, null, 2));
}

/**
 * Get summary of recent history
 */
export function getHistorySummary(rootDir: string): {
  totalScans: number;
  firstScan: string | null;
  lastScan: string | null;
  avgScore: number;
} {
  const history = loadScoreHistory(rootDir);
  
  if (history.length === 0) {
    return {
      totalScans: 0,
      firstScan: null,
      lastScan: null,
      avgScore: 0,
    };
  }
  
  const scores = history.map((e: any) => e.overallScore);
  const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  
  return {
    totalScans: history.length,
    firstScan: history[0].timestamp,
    lastScan: history[history.length - 1].timestamp,
    avgScore: Math.round(avgScore),
  };
}

/**
 * Export history for external analysis
 */
export function exportHistory(rootDir: string, format: 'json' | 'csv' = 'json'): string {
  const history = loadScoreHistory(rootDir);
  
  if (format === 'csv') {
    const headers = 'timestamp,overallScore,totalIssues,totalTokens,patternScore,contextScore,consistencyScore\n';
    const rows = history.map((e: any) => 
      `${e.timestamp},${e.overallScore},${e.totalIssues},${e.totalTokens},${e.breakdown?.['pattern-detect'] || ''},${e.breakdown?.['context-analyzer'] || ''},${e.breakdown?.['consistency'] || ''}`
    ).join('\n');
    return headers + rows;
  }
  
  return JSON.stringify(history, null, 2);
}

/**
 * Clear history (for testing or reset)
 */
export function clearHistory(rootDir: string): void {
  const historyPath = getHistoryPath(rootDir);
  if (existsSync(historyPath)) {
    writeFileSync(historyPath, JSON.stringify([]));
  }
}
