import { describe, it, expect, vi } from 'vitest';
import {
  groupIssuesByFile,
  buildSimpleProviderScore,
  buildSpokeOutput,
  createProvider,
} from '../utils/provider-utils';
import { ToolName } from '../types/enums';

describe('provider-utils', () => {
  describe('groupIssuesByFile', () => {
    it('should group issues by file path', () => {
      const issues = [
        { location: { file: 'a.ts' }, message: 'error 1' },
        { location: { file: 'b.ts' }, message: 'error 2' },
        { location: { file: 'a.ts' }, message: 'error 3' },
        { message: 'no file' },
      ];

      const results = groupIssuesByFile(issues);

      expect(results).toHaveLength(3);
      const a = results.find((r) => r.fileName === 'a.ts');
      const b = results.find((r) => r.fileName === 'b.ts');
      const unknown = results.find((r) => r.fileName === 'unknown');

      expect(a?.issues).toHaveLength(2);
      expect(b?.issues).toHaveLength(1);
      expect(unknown?.issues).toHaveLength(1);
    });
  });

  describe('buildSimpleProviderScore', () => {
    it('should build score from summary', () => {
      const summary = {
        score: 85,
        recommendations: ['Fix it'],
        total: 10,
      };
      const score = buildSimpleProviderScore('test-tool', summary, {
        extra: 1,
      });

      expect(score.toolName).toBe('test-tool');
      expect(score.score).toBe(85);
      expect(score.rawMetrics.total).toBe(10);
      expect(score.rawMetrics.extra).toBe(1);
      expect(score.recommendations).toHaveLength(1);
      expect(score.recommendations[0].action).toBe('Fix it');
    });

    it('should handle missing score/recs', () => {
      const score = buildSimpleProviderScore('test-tool', {});
      expect(score.score).toBe(0);
      expect(score.recommendations).toHaveLength(0);
    });
  });

  describe('buildSpokeOutput', () => {
    it('should build and validate spoke output', () => {
      const results = [{ fileName: 'a.ts', issues: [], metrics: {} }];
      const summary = { score: 100 };
      const output = buildSpokeOutput('test-tool', '1.0.0', summary, results);

      expect(output.results).toEqual(results);
      expect(output.summary).toEqual(summary);
      expect(output.metadata!.toolName).toBe('test-tool');
      expect(output.metadata!.version).toBe('1.0.0');
      expect(output.metadata!.timestamp).toBeDefined();
    });
  });

  describe('createProvider', () => {
    it('should create a provider implementation', async () => {
      const config = {
        id: ToolName.PatternDetect,
        alias: ['pd'],
        version: '1.2.3',
        defaultWeight: 1,
        analyzeReport: vi.fn().mockResolvedValue({ data: 'raw' }),
        getResults: vi
          .fn()
          .mockReturnValue([{ fileName: 'f.ts', issues: [], metrics: {} }]),
        getSummary: vi.fn().mockReturnValue({ score: 90 }),
        score: vi.fn().mockReturnValue({ score: 90, toolName: 'pd' } as any),
      };

      const provider = createProvider(config);

      expect(provider.id).toBe(ToolName.PatternDetect);
      expect(provider.alias).toContain('pd');

      const options = { rootDir: '.', include: [], exclude: [] };
      const output = await provider.analyze(options);

      expect(config.analyzeReport).toHaveBeenCalledWith(options);
      expect(output.summary.score).toBe(90);
      expect(output.results[0].fileName).toBe('f.ts');

      const score = provider.score(output, options);
      expect(score.score).toBe(90);
      expect(config.score).toHaveBeenCalledWith(output, options);
    });
  });
});
