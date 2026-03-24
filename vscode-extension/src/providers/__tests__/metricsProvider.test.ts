import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: vi.fn(),
  },
  ViewColumn: { One: 1 },
}));

import { MetricsViewProvider } from '../metricsProvider';
import { window } from 'vscode';

describe('MetricsViewProvider', () => {
  let mockContext: any;
  let mockPanel: any;
  let mockWebview: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      subscriptions: [],
    };

    mockWebview = {
      html: '',
    };

    mockPanel = {
      webview: mockWebview,
    };

    (window.createWebviewPanel as any).mockReturnValue(mockPanel);
  });

  describe('show', () => {
    it('should create webview panel with correct parameters', () => {
      MetricsViewProvider.show(mockContext);

      expect(window.createWebviewPanel).toHaveBeenCalledWith(
        'aiready.metricsDetail',
        'AIReady Methodology',
        1,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
    });

    it('should set HTML content for webview', () => {
      MetricsViewProvider.show(mockContext);

      expect(mockWebview.html).toContain('AI Readiness Methodology');
      expect(mockWebview.html).toContain('Deep dive into the 9 metrics');
    });

    it('should scroll to specific metric when metricId is provided', () => {
      MetricsViewProvider.show(mockContext, 'semantic-duplicates');

      expect(mockWebview.html).toContain('id="semantic-duplicates"');
      expect(mockWebview.html).toContain('scrollIntoView');
    });

    it('should include all 9 metrics in HTML', () => {
      MetricsViewProvider.show(mockContext);

      const html = mockWebview.html;
      expect(html).toContain('Semantic Duplicates');
      expect(html).toContain('Context Fragmentation');
      expect(html).toContain('Naming Consistency');
      expect(html).toContain('Dependency Health');
      expect(html).toContain('Change Amplification');
      expect(html).toContain('AI Signal Clarity');
      expect(html).toContain('Documentation Health');
      expect(html).toContain('Agent Grounding');
      expect(html).toContain('Testability Index');
    });

    it('should include metric descriptions', () => {
      MetricsViewProvider.show(mockContext);

      const html = mockWebview.html;
      expect(html).toContain('Detects logic that is repeated');
      expect(html).toContain('Analyzes how scattered related logic is');
      expect(html).toContain('Measures how consistently variables');
    });

    it('should include code examples with before/after', () => {
      MetricsViewProvider.show(mockContext);

      const html = mockWebview.html;
      expect(html).toContain('Before (The Debt)');
      expect(html).toContain('After (AI-Ready)');
      expect(html).toContain('validate');
      expect(html).toContain('isUserValid');
    });

    it('should include threshold information', () => {
      MetricsViewProvider.show(mockContext);

      const html = mockWebview.html;
      expect(html).toContain('90+');
      expect(html).toContain('Excellent');
      // The HTML uses &lt; for <, so check for the encoded version
      expect(html).toContain('&lt; 50');
      expect(html).toContain('Critical');
    });
  });

  describe('viewType', () => {
    it('should have correct static viewType', () => {
      expect(MetricsViewProvider.viewType).toBe('aiready.metricsDetail');
    });
  });
});
