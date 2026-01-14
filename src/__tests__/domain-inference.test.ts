import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../analyzer';
import type { ExportInfo } from '../types';

function makeFile(name: string, content: string) {
  return { file: name, content };
}

describe('Config-driven domain inference and tokenization', () => {
  it('matches custom domainKeywords including abbreviations', () => {
    const files = [
      makeFile('src/payments/processTxn.ts', 'export function processTxn(){}'),
    ];
    const graph = buildDependencyGraph(files, {
      domainKeywords: ['txn', 'transaction'],
      pathDomainMap: { payments: 'payment' },
    });

    const node = graph.nodes.get('src/payments/processTxn.ts')!;
    const domains = node.exports.map(e => e.inferredDomain);
    expect(domains).toContain('txn');
  });

  it('tokenizes camelCase and matches tokens', () => {
    const files = [
      makeFile('src/orders/invoiceItemRepo.ts', 'export const invoiceItemRepo = {}'),
    ];
    const graph = buildDependencyGraph(files, {
      domainKeywords: ['invoice', 'order'],
    });

    const node = graph.nodes.get('src/orders/invoiceItemRepo.ts')!;
    const domains = node.exports.map(e => e.inferredDomain);
    expect(domains).toContain('invoice');
  });

  it('falls back to pathDomainMap when name has no keywords', () => {
    const files = [
      makeFile('src/customers/handler.ts', 'export function handler(){}'),
    ];
    const graph = buildDependencyGraph(files, {
      pathDomainMap: { customers: 'customer' },
    });

    const node = graph.nodes.get('src/customers/handler.ts')!;
    const domains = node.exports.map(e => e.inferredDomain);
    expect(domains).toContain('customer');
  });

  it('uses domainPatterns (regex) when provided', () => {
    const files = [
      makeFile('src/auth/authz.ts', 'export function doAuthz(){}'),
    ];
    const graph = buildDependencyGraph(files, {
      domainPatterns: ['^authz$'],
      domainKeywords: ['authz', 'authorization'],
    });

    const node = graph.nodes.get('src/auth/authz.ts')!;
    const domains = node.exports.map(e => e.inferredDomain);
    expect(domains).toContain('authz');
  });
});
