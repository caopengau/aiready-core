import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  detectModuleClusters,
  calculateFragmentation,
} from '../analyzer';

describe('fragmentation coupling discount', () => {
  it('does not apply discount when files have no shared imports', () => {
    const files = [
      {
        file: 'src/billing/a.ts',
        content: `export const getBillingA = 1;`,
      },
      {
        file: 'src/api/billing/b.ts',
        content: `export const getBillingB = 2;`,
      },
      {
        file: 'lib/billing/c.ts',
        content: `export const getBillingC = 3;`,
      },
    ];

    const graph = buildDependencyGraph(files);
    const clusters = detectModuleClusters(graph);
    const cluster = clusters.find((c) => c.domain === 'billing');
    expect(cluster).toBeDefined();

    const base = calculateFragmentation(files.map(f => f.file), 'billing');
    // With no import similarity the coupling discount should be 0 -> fragmentation unchanged
    expect(cluster!.fragmentationScore).toBeCloseTo(base, 6);
  });

  it('applies up-to-20% discount when files share identical imports', () => {
    const files = [
      {
        file: 'src/billing/a.ts',
        content: `import { shared } from 'shared/module';\nexport const getBillingA = 1;`,
      },
      {
        file: 'src/api/billing/b.ts',
        content: `import { shared } from 'shared/module';\nexport const getBillingB = 2;`,
      },
      {
        file: 'lib/billing/c.ts',
        content: `import { shared } from 'shared/module';\nexport const getBillingC = 3;`,
      },
    ];

    const graph = buildDependencyGraph(files);
    const clusters = detectModuleClusters(graph);
    const cluster = clusters.find((c) => c.domain === 'billing');
    expect(cluster).toBeDefined();

    const base = calculateFragmentation(files.map(f => f.file), 'billing');
    const expected = base * 0.8; // full cohesion => 20% discount

    // Allow small FP tolerance
    expect(cluster!.fragmentationScore).toBeCloseTo(expected, 6);
  });
});
