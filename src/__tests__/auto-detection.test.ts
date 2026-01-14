import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../analyzer';

describe('Auto-detection from folder structure', () => {
  it('should auto-detect domain keywords from folder paths', () => {
    const files = [
      {
        file: 'src/payments/process.ts',
        content: 'export function processPayment() { return 1; }',
      },
      {
        file: 'src/orders/create.ts',
        content: 'export function createOrder() { return 2; }',
      },
    ];

    const graph = buildDependencyGraph(files);
    const paymentsNode = graph.nodes.get('src/payments/process.ts');
    const ordersNode = graph.nodes.get('src/orders/create.ts');

    // Should detect 'payment' from processPayment (now part of auto-detected keywords)
    expect(paymentsNode?.exports[0].inferredDomain).toBe('payment');
    
    // Should detect 'order' from createOrder
    expect(ordersNode?.exports[0].inferredDomain).toBe('order');
  });

  it('should detect domains from nested folders', () => {
    const files = [
      {
        file: 'src/api/invoices/handler.ts',
        content: 'export function handleRequest() { return 1; }',
      },
    ];

    const graph = buildDependencyGraph(files);
    const node = graph.nodes.get('src/api/invoices/handler.ts');

    // Should detect 'invoice' from path (invoices folder)
    expect(node?.exports[0].inferredDomain).toBe('invoice');
  });

  it('should skip common infrastructure folders', () => {
    const files = [
      {
        file: 'src/utils/helpers/format.ts',
        content: 'export function formatData() { return 1; }',
      },
    ];

    const graph = buildDependencyGraph(files);
    const node = graph.nodes.get('src/utils/helpers/format.ts');

    // 'utils' and 'helpers' should be skipped, no domain detected
    expect(node?.exports[0].inferredDomain).toBe('unknown');
  });

  it('should merge auto-detected with custom keywords', () => {
    const files = [
      {
        file: 'src/receipts/scan.ts',
        content: 'export function scanReceipt() { return 1; }',
      },
    ];

    const graph = buildDependencyGraph(files, {
      domainKeywords: ['receipt'], // Custom keyword
    });
    const node = graph.nodes.get('src/receipts/scan.ts');

    // Should detect 'receipt' from both auto-detection AND custom keywords
    expect(node?.exports[0].inferredDomain).toBe('receipt');
  });
});

describe('Import-path domain inference', () => {
  it('should infer domain from import paths', () => {
    const files = [
      {
        file: 'src/lib/session.ts',
        content: `
          import { processPayment } from '../payments/processor';
          export function createSession() { return 1; }
        `,
      },
      {
        file: 'src/payments/processor.ts',
        content: 'export function processPayment() { return 2; }',
      },
    ];

    const graph = buildDependencyGraph(files);
    const sessionNode = graph.nodes.get('src/lib/session.ts');

    // session.ts imports from '../payments/...' so should infer 'payment' domain
    expect(sessionNode?.exports[0].inferredDomain).toBe('payment');
  });

  it('should infer domain from absolute import paths', () => {
    const files = [
      {
        file: 'src/components/nav-links.ts',
        content: `
          import { getOrders } from '@/orders/service';
          export function NavLinks() { return 'nav'; }
        `,
      },
      {
        file: 'src/orders/service.ts',
        content: 'export function getOrders() { return []; }',
      },
    ];

    const graph = buildDependencyGraph(files);
    const navNode = graph.nodes.get('src/components/nav-links.ts');

    // nav-links.ts imports from '@/orders/...' so should infer 'order' domain
    expect(navNode?.exports[0].inferredDomain).toBe('order');
  });

  it('should use identifier name first before import-path fallback', () => {
    const files = [
      {
        file: 'src/lib/handler.ts',
        content: `
          import { processPayment } from '../payments/processor';
          export function processInvoice() { return 1; }
        `,
      },
    ];

    const graph = buildDependencyGraph(files);
    const node = graph.nodes.get('src/lib/handler.ts');

    // processInvoice should match 'invoice' from identifier, not 'payment' from imports
    expect(node?.exports[0].inferredDomain).toBe('invoice');
  });

  it('should fall back to import-path when identifier is generic', () => {
    const files = [
      {
        file: 'src/lib/dynamodb.ts',
        content: `
          import { Customer } from '../customers/model';
          export function connect() { return 1; }
        `,
      },
    ];

    const graph = buildDependencyGraph(files);
    const node = graph.nodes.get('src/lib/dynamodb.ts');

    // 'connect' is generic, should infer 'customer' from import path
    expect(node?.exports[0].inferredDomain).toBe('customer');
  });
});
