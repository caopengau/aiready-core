import * as vscode from 'vscode';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, parse } from 'path';
import { getRatingFromScore, countIssues } from '../utils/report';

export interface ScanReport {
  id: string;
  fileName: string;
  filePath: string;
  timestamp: Date;
  score: number;
  rating: string;
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  infoIssues: number;
  tools: Array<{
    name: string;
    score: number;
    rating: string;
  }>;
}
function findReportsInDir(dir: string): ScanReport[] {
  const aireadyDir = join(dir, '.aiready');

  if (!existsSync(aireadyDir)) {
    return [];
  }

  try {
    const files = readdirSync(aireadyDir)
      .filter((f) => f.startsWith('aiready-report-') && f.endsWith('.json'))
      .map((f) => {
        const filePath = join(aireadyDir, f);
        const stats = statSync(filePath);
        return {
          name: f,
          path: filePath,
          mtime: stats.mtime,
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const reports: ScanReport[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file.path, 'utf8');
        const data = JSON.parse(content);

        const score = data.scoring?.overall ?? 0;
        const rating = data.scoring?.rating ?? 'Unknown';

        const timestamp = data.scoring?.timestamp
          ? new Date(data.scoring.timestamp)
          : file.mtime;

        const counts = countIssues(data);

        const tools: Array<{ name: string; score: number; rating: string }> =
          [];
        data.scoring?.breakdown?.forEach((tool: any) => {
          tools.push({
            name: tool.toolName,
            score: tool.score,
            rating: tool.rating ?? getRatingFromScore(tool.score),
          });
        });

        reports.push({
          id: file.name.replace('aiready-report-', '').replace('.json', ''),
          fileName: file.name,
          filePath: file.path,
          timestamp,
          score,
          rating,
          totalIssues: counts.total,
          criticalIssues: counts.critical,
          majorIssues: counts.major,
          minorIssues: counts.minor,
          infoIssues: counts.info,
          tools,
        });
      } catch (e) {
        console.error(`Failed to parse report ${file.path}:`, e);
      }
    }

    return reports;
  } catch (e) {
    console.error(`Error reading ${aireadyDir} directory:`, e);
    return [];
  }
}

/**
 * Find all AIReady report files in the workspace (all folders + upward search)
 */
export function findAllReports(): ScanReport[] {
  const reports: ScanReport[] = [];
  const seenPaths = new Set<string>();

  // 1. Search all workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  for (const folder of workspaceFolders) {
    const folderReports = findReportsInDir(folder.uri.fsPath);
    for (const report of folderReports) {
      if (!seenPaths.has(report.filePath)) {
        reports.push(report);
        seenPaths.add(report.filePath);
      }
    }
  }

  // 2. Upward search from active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.uri.scheme === 'file') {
    let currentDir = dirname(activeEditor.document.uri.fsPath);
    const rootPath = parse(currentDir).root;

    // Search up to 5 levels or until root
    for (let i = 0; i < 5; i++) {
      const dirReports = findReportsInDir(currentDir);
      for (const report of dirReports) {
        if (!seenPaths.has(report.filePath)) {
          reports.push(report);
          seenPaths.add(report.filePath);
        }
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir || currentDir === rootPath) break;
      currentDir = parentDir;
    }
  }

  // Sort all reports by timestamp descending
  return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Tree item for reports view
export class AIReadyReportsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private reports: ScanReport[] = [];
  private workspacePath: string = '';

  refresh(): void {
    this.reports = findAllReports();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    if (!element) {
      if (this.reports.length === 0) {
        return [
          {
            label: '$(play) Run first scan',
            iconPath: new vscode.ThemeIcon('play'),
            command: {
              command: 'aiready.scan',
              title: 'Run Scan',
            },
          } as vscode.TreeItem,
          {
            label: 'No previous reports found',
            iconPath: new vscode.ThemeIcon('info'),
            description: 'Run a scan to generate your first report',
          } as vscode.TreeItem,
        ];
      }

      // Show reports (limit to last 20)
      return this.reports.slice(0, 20).map((report) => {
        const item = new vscode.TreeItem(
          this.formatDate(report.timestamp),
          vscode.TreeItemCollapsibleState.None
        );

        // Icon based on score
        const iconName =
          report.score >= 70
            ? 'check'
            : report.score >= 50
              ? 'warning'
              : 'error';
        item.iconPath = new vscode.ThemeIcon(iconName);

        // Description shows score and issue count
        item.description = `Score: ${report.score}/100 • ${report.totalIssues} issues`;

        // Store report data in the item
        (item as any).report = report;
        item.contextValue = 'report';

        // Make it clickable to show details
        item.command = {
          command: 'aiready.showReportDetail',
          title: 'Show Report Details',
          arguments: [report],
        };

        return item;
      });
    }
    return [];
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
}
