import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before importing anything else
vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    activeTextEditor: undefined,
  },
  workspace: {
    workspaceFolders: undefined,
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock util
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

// Mock config
vi.mock('../../utils/config', () => ({
  getMergedConfig: vi.fn().mockReturnValue({
    threshold: 70,
    tools: ['patterns', 'context'],
    failOn: 'critical',
  }),
}));

// Mock report utils
vi.mock('../../utils/report', () => ({
  getRatingFromScore: vi.fn().mockReturnValue('Good'),
  countIssues: vi.fn().mockReturnValue({
    critical: 1,
    major: 2,
    minor: 3,
    info: 4,
    total: 10,
  }),
  collectAllIssues: vi.fn().mockReturnValue([]),
}));

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { getMergedConfig } from '../../utils/config';
import { countIssues, collectAllIssues } from '../../utils/report';
import { createScanCommands } from '../scan';

describe('Scan Commands', () => {
  let mockOutputChannel: any;
  let mockIssuesProvider: any;
  let mockSummaryProvider: any;
  let mockReportsProvider: any;
  let mockUpdateStatusBar: any;
  let mockRunVisualizer: any;
  let scanCommands: ReturnType<typeof createScanCommands>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOutputChannel = {
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    };

    mockIssuesProvider = {
      refresh: vi.fn(),
    };

    mockSummaryProvider = {
      refresh: vi.fn(),
    };

    mockReportsProvider = {
      refresh: vi.fn(),
    };

    mockUpdateStatusBar = vi.fn();
    mockRunVisualizer = vi.fn();

    scanCommands = createScanCommands(
      mockOutputChannel,
      mockIssuesProvider,
      mockSummaryProvider,
      mockReportsProvider,
      mockUpdateStatusBar,
      mockRunVisualizer
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scanWorkspace', () => {
    it('should show error when no workspace folder is open', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      await scanCommands.scanWorkspace();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace folder open'
      );
    });

    it('should run scan when workspace is available', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockExec = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({ scoring: { overall: 85 } }),
        stderr: '',
      });
      (exec as any).mockImplementation(mockExec);

      // Mock file system
      (existsSync as any).mockReturnValue(true);
      (readdirSync as any).mockReturnValue(['aiready-report-123.json']);
      (statSync as any).mockReturnValue({ mtime: new Date() });
      (readFileSync as any).mockReturnValue(
        JSON.stringify({
          scoring: {
            overall: 85,
            rating: 'Excellent',
            breakdown: [],
          },
          summary: {
            toolsRun: ['patterns'],
            executionTime: 1000,
          },
        })
      );

      await scanCommands.scanWorkspace();

      expect(mockUpdateStatusBar).toHaveBeenCalledWith('$(sync~spin) Scanning...', false);
      expect(mockOutputChannel.clear).toHaveBeenCalled();
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });

    it('should handle scan errors gracefully', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockExec = vi.fn().mockRejectedValue(new Error('Scan failed'));
      (exec as any).mockImplementation(mockExec);

      await scanCommands.scanWorkspace();

      expect(mockUpdateStatusBar).toHaveBeenCalledWith(
        '$(shield) AIReady: Error',
        true
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('AIReady scan failed')
      );
    });
  });

  describe('quickScan', () => {
    it('should show error when no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await scanCommands.quickScan();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No active file'
      );
    });

    it('should run scan on active file', async () => {
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: { fsPath: '/test/file.ts' },
        },
      };

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockExec = vi.fn().mockResolvedValue({
        stdout: JSON.stringify({ scoring: { overall: 85 } }),
        stderr: '',
      });
      (exec as any).mockImplementation(mockExec);

      // Mock file system
      (existsSync as any).mockReturnValue(true);
      (readdirSync as any).mockReturnValue(['aiready-report-123.json']);
      (statSync as any).mockReturnValue({ mtime: new Date() });
      (readFileSync as any).mockReturnValue(
        JSON.stringify({
          scoring: {
            overall: 85,
            rating: 'Excellent',
            breakdown: [],
          },
          summary: {
            toolsRun: ['patterns'],
            executionTime: 1000,
          },
        })
      );

      await scanCommands.quickScan();

      expect(mockUpdateStatusBar).toHaveBeenCalledWith('$(sync~spin) Scanning...', false);
    });
  });

  describe('extractBusinessMetrics', () => {
    it('should extract metrics from scoring breakdown', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockExec = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      (exec as any).mockImplementation(mockExec);

      // Mock file system with business metrics
      (existsSync as any).mockReturnValue(true);
      (readdirSync as any).mockReturnValue(['aiready-report-123.json']);
      (statSync as any).mockReturnValue({ mtime: new Date() });
      (readFileSync as any).mockReturnValue(
        JSON.stringify({
          scoring: {
            overall: 85,
            rating: 'Excellent',
            breakdown: [
              {
                toolName: 'patterns',
                score: 90,
                rawMetrics: {
                  estimatedMonthlyCost: 100,
                  estimatedDeveloperHours: 5,
                },
              },
              {
                toolName: 'context',
                score: 80,
                rawMetrics: {
                  estimatedMonthlyCost: 50,
                  estimatedDeveloperHours: 3,
                },
              },
            ],
          },
          summary: {
            toolsRun: ['patterns', 'context'],
            executionTime: 1000,
          },
        })
      );

      await scanCommands.scanWorkspace();

      // Verify summary was refreshed with business metrics
      expect(mockSummaryProvider.refresh).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 85,
          issues: expect.any(Number),
          warnings: expect.any(Number),
        })
      );
    });

    it('should handle missing scoring breakdown', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockExec = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      (exec as any).mockImplementation(mockExec);

      // Mock file system without scoring breakdown
      (existsSync as any).mockReturnValue(true);
      (readdirSync as any).mockReturnValue(['aiready-report-123.json']);
      (statSync as any).mockReturnValue({ mtime: new Date() });
      (readFileSync as any).mockReturnValue(
        JSON.stringify({
          scoring: {
            overall: 85,
            rating: 'Excellent',
          },
          summary: {
            toolsRun: ['patterns'],
            executionTime: 1000,
          },
        })
      );

      await scanCommands.scanWorkspace();

      // Should still work without breakdown
      expect(mockSummaryProvider.refresh).toHaveBeenCalled();
    });
  });
});
