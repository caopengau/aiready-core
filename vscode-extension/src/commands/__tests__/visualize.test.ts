import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before importing anything else
vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  },
  workspace: {
    workspaceFolders: undefined,
  },
  env: {
    openExternal: vi.fn(),
  },
  Uri: {
    parse: vi.fn((url) => url),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

describe('Visualize Command', () => {
  let mockOutputChannel: any;
  let mockUpdateStatusBar: any;
  let createVisualizeCommand: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    mockOutputChannel = {
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    };

    mockUpdateStatusBar = vi.fn();

    // Import the module fresh each time to reset the visualizerProcess state
    const visualizeModule = await import('../visualize');
    createVisualizeCommand = visualizeModule.createVisualizeCommand;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runVisualizer', () => {
    it('should show error when no workspace folder is open', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);

      await visualizeCommand.runVisualizer();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace folder open'
      );
    });

    it('should start visualizer when workspace is available', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn();

      (spawn as any).mockReturnValue(mockChild);

      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      await visualizeCommand.runVisualizer();

      expect(mockUpdateStatusBar).toHaveBeenCalledWith(
        '$(sync~spin) Starting visualizer...',
        false
      );
      expect(mockOutputChannel.clear).toHaveBeenCalled();
      expect(mockOutputChannel.show).toHaveBeenCalled();
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@aiready/cli', 'visualise'],
        expect.objectContaining({
          cwd: '/test/workspace',
          shell: true,
        })
      );
    });

    it('should handle visualizer process errors', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn();

      (spawn as any).mockReturnValue(mockChild);

      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      await visualizeCommand.runVisualizer();

      // Simulate error
      mockChild.emit('error', new Error('Process failed'));

      expect(mockUpdateStatusBar).toHaveBeenCalledWith(
        '$(shield) AIReady: Error',
        true
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('AIReady visualizer failed')
      );
    });

    it('should detect and notify about local server URL', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      (vscode.window as any).showInformationMessage = vi.fn().mockResolvedValue(undefined);

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn();

      (spawn as any).mockReturnValue(mockChild);

      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      await visualizeCommand.runVisualizer();

      // Simulate stdout with URL
      mockChild.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000'),
        'Open in Browser',
        'Stop Visualizer'
      );
    });

    it('should update status bar when visualizer closes', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn();

      (spawn as any).mockReturnValue(mockChild);

      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      await visualizeCommand.runVisualizer();

      // Reset mock to check close event
      mockUpdateStatusBar.mockClear();

      // Simulate process close
      mockChild.emit('close', 0);

      expect(mockUpdateStatusBar).toHaveBeenCalledWith(
        '$(shield) AIReady',
        false
      );
    });
  });

  describe('stopVisualizer', () => {
    it('should show message when no visualizer is running', () => {
      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      visualizeCommand.stopVisualizer();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'AIReady: No visualizer is currently running.'
      );
    });

    it('should stop running visualizer', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' } },
      ];

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.kill = vi.fn();

      (spawn as any).mockReturnValue(mockChild);

      const visualizeCommand = createVisualizeCommand(mockOutputChannel, mockUpdateStatusBar);
      await visualizeCommand.runVisualizer();

      // Now stop it
      visualizeCommand.stopVisualizer();

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '🛑 Stopping visualizer...'
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '✅ Visualizer stopped.'
      );
    });
  });
});
