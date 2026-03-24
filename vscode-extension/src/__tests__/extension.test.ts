import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track constructor calls
const mockIssuesProviderCalls: any[] = [];
const mockSummaryProviderCalls: any[] = [];
const mockReportsProviderCalls: any[] = [];
const mockReportDetailViewCalls: any[] = [];

// Mock all vscode modules
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn().mockReturnValue({
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    }),
    createStatusBarItem: vi.fn().mockReturnValue({
      text: '',
      tooltip: '',
      color: undefined,
      command: '',
      show: vi.fn(),
      dispose: vi.fn(),
    }),
    createTreeView: vi.fn().mockReturnValue({
      dispose: vi.fn(),
    }),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue: any) => defaultValue),
    }),
    onDidChangeWorkspaceFolders: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn(),
  },
  StatusBarAlignment: { Right: 2 },
  ThemeColor: vi.fn(),
  Uri: {
    parse: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
}));

vi.mock('../providers/issuesProvider', () => ({
  AIReadyIssuesProvider: class {
    refresh = vi.fn();
    setGroupBy = vi.fn();
    setSeverityFilter = vi.fn();
    constructor() {
      mockIssuesProviderCalls.push(this);
    }
  },
}));

vi.mock('../providers/summaryProvider', () => ({
  AIReadySummaryProvider: class {
    refresh = vi.fn();
    constructor() {
      mockSummaryProviderCalls.push(this);
    }
  },
}));

vi.mock('../providers/reportsProvider', () => ({
  AIReadyReportsProvider: class {
    refresh = vi.fn();
    constructor() {
      mockReportsProviderCalls.push(this);
    }
  },
}));

vi.mock('../providers/reportDetailView', () => ({
  ReportDetailView: class {
    showReport = vi.fn();
    constructor() {
      mockReportDetailViewCalls.push(this);
    }
  },
}));

vi.mock('../providers/metricsProvider', () => ({
  MetricsViewProvider: {
    show: vi.fn(),
  },
}));

vi.mock('../commands/scan', () => ({
  createScanCommands: vi.fn().mockReturnValue({
    scanWorkspace: vi.fn(),
    quickScan: vi.fn(),
  }),
}));

vi.mock('../commands/visualize', () => ({
  createVisualizeCommand: vi.fn().mockReturnValue({
    runVisualizer: vi.fn(),
    stopVisualizer: vi.fn(),
  }),
}));

import { activate, deactivate } from '../extension';
import { workspace, commands, window } from 'vscode';

describe('Extension', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIssuesProviderCalls.length = 0;
    mockSummaryProviderCalls.length = 0;
    mockReportsProviderCalls.length = 0;
    mockReportDetailViewCalls.length = 0;
    
    mockContext = {
      subscriptions: [],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('activate', () => {
    it('should activate successfully', () => {
      activate(mockContext);

      // Verify output channel was created
      expect(window.createOutputChannel).toHaveBeenCalledWith('AIReady');

      // Verify status bar item was created
      expect(window.createStatusBarItem).toHaveBeenCalled();

      // Verify providers were instantiated
      expect(mockIssuesProviderCalls.length).toBeGreaterThan(0);
      expect(mockSummaryProviderCalls.length).toBeGreaterThan(0);
      expect(mockReportsProviderCalls.length).toBeGreaterThan(0);
      expect(mockReportDetailViewCalls.length).toBeGreaterThan(0);

      // Verify commands were registered
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.scan',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.quickScan',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.visualize',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.stopVisualizer',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.showReport',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.openSettings',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.showReportDetail',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.showMetrics',
        expect.any(Function)
      );

      // Verify filter commands were registered
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.groupBySeverity',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.groupByTool',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.groupByFile',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.groupByNone',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.filterAll',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.filterCritical',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.filterMajor',
        expect.any(Function)
      );
      expect(commands.registerCommand).toHaveBeenCalledWith(
        'aiready.issues.filterMinor',
        expect.any(Function)
      );

      // Verify tree views were created
      expect(window.createTreeView).toHaveBeenCalledWith(
        'aiready.issues',
        expect.any(Object)
      );
      expect(window.createTreeView).toHaveBeenCalledWith(
        'aiready.summary',
        expect.any(Object)
      );
      expect(window.createTreeView).toHaveBeenCalledWith(
        'aiready.reports',
        expect.any(Object)
      );

      // Verify workspace change listener was registered
      expect(workspace.onDidChangeWorkspaceFolders).toHaveBeenCalled();

      // Verify subscriptions were added
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });

    it('should handle activation errors gracefully', () => {
      // Mock createOutputChannel to throw an error
      (window.createOutputChannel as any).mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      activate(mockContext);

      // Should show error message
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to activate AIReady extension')
      );
    });

    it('should show status bar when enabled', () => {
      const mockConfig = {
        get: vi.fn().mockImplementation((key: string, defaultValue: any) => {
          if (key === 'showStatusBar') return true;
          return defaultValue;
        }),
      };
      (workspace.getConfiguration as any).mockReturnValue(mockConfig);

      activate(mockContext);

      // Status bar should be shown
      const statusBarItem = (window.createStatusBarItem as any).mock.results[0].value;
      expect(statusBarItem.show).toHaveBeenCalled();
    });

    it('should register auto-scan listener when enabled', () => {
      const mockConfig = {
        get: vi.fn().mockImplementation((key: string, defaultValue: any) => {
          if (key === 'autoScan') return true;
          return defaultValue;
        }),
      };
      (workspace.getConfiguration as any).mockReturnValue(mockConfig);

      activate(mockContext);

      // Should register onDidSaveTextDocument listener
      expect(workspace.onDidSaveTextDocument).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should dispose resources properly', () => {
      activate(mockContext);

      // Get the status bar item and output channel mocks
      const statusBarItem = (window.createStatusBarItem as any).mock.results[0].value;
      const outputChannel = (window.createOutputChannel as any).mock.results[0].value;

      deactivate();

      // Should dispose status bar and output channel
      expect(statusBarItem.dispose).toHaveBeenCalled();
      expect(outputChannel.dispose).toHaveBeenCalled();
    });
  });
});
