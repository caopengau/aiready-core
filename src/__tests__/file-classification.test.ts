import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  adjustFragmentationForClassification,
  getClassificationRecommendations,
} from '../analyzer';
import type { DependencyNode, FileClassification } from '../types';

describe('file classification', () => {
  const createNode = (overrides: Partial<DependencyNode>): DependencyNode => ({
    file: 'test.ts',
    imports: [],
    exports: [],
    tokenCost: 100,
    linesOfCode: 50,
    ...overrides,
  });

  describe('classifyFile', () => {
    it('should classify barrel export files correctly', () => {
      const node = createNode({
        file: 'src/index.ts',
        imports: ['../module1', '../module2', '../module3'],
        exports: [
          { name: 'func1', type: 'function', inferredDomain: 'module1' },
          { name: 'func2', type: 'function', inferredDomain: 'module2' },
          { name: 'func3', type: 'function', inferredDomain: 'module3' },
        ],
        linesOfCode: 20, // Sparse code
      });

      const classification = classifyFile(node, 0.5, ['module1', 'module2', 'module3']);
      expect(classification).toBe('barrel-export');
    });

    it('should classify type definition files correctly', () => {
      const node = createNode({
        file: 'src/types.ts',
        exports: [
          { name: 'User', type: 'interface', inferredDomain: 'user' },
          { name: 'Order', type: 'interface', inferredDomain: 'order' },
          { name: 'Product', type: 'type', inferredDomain: 'product' },
          { name: 'Status', type: 'type', inferredDomain: 'unknown' },
        ],
        linesOfCode: 100,
      });

      const classification = classifyFile(node, 0.5, ['user', 'order', 'product']);
      expect(classification).toBe('type-definition');
    });

    it('should classify cohesive module files correctly', () => {
      const node = createNode({
        file: 'src/calculator.ts',
        exports: [
          { name: 'calculate', type: 'function', inferredDomain: 'calc' },
          { name: 'format', type: 'function', inferredDomain: 'calc' },
          { name: 'validate', type: 'function', inferredDomain: 'calc' },
        ],
        imports: ['../utils'],
        linesOfCode: 300,
      });

      const classification = classifyFile(node, 0.8, ['calc']);
      expect(classification).toBe('cohesive-module');
    });

    it('should classify mixed concerns files correctly', () => {
      const node = createNode({
        file: 'src/audit.ts',
        exports: [
          { name: 'auditStatus', type: 'function', inferredDomain: 'audit' },
          { name: 'createJob', type: 'function', inferredDomain: 'job' },
          { name: 'LineItem', type: 'interface', inferredDomain: 'order' },
          { name: 'SupportingDoc', type: 'type', inferredDomain: 'doc' },
        ],
        imports: ['../auth', '../job', '../order'],
        linesOfCode: 384,
      });

      const classification = classifyFile(node, 0.3, ['audit', 'job', 'order', 'doc']);
      expect(classification).toBe('mixed-concerns');
    });

    it('should classify files with low cohesion as mixed-concerns', () => {
      const node = createNode({
        file: 'src/utils.ts',
        exports: [
          { name: 'formatDate', type: 'function', inferredDomain: 'date' },
          { name: 'parseJSON', type: 'function', inferredDomain: 'json' },
          { name: 'validateEmail', type: 'function', inferredDomain: 'email' },
        ],
        imports: [],
        linesOfCode: 150,
      });

      const classification = classifyFile(node, 0.4, ['date', 'json', 'email']);
      expect(classification).toBe('mixed-concerns');
    });

    it('should return unknown for files that do not fit other categories', () => {
      const node = createNode({
        file: 'src/component.ts',
        exports: [
          { name: 'Component', type: 'function', inferredDomain: 'ui' },
        ],
        imports: ['react'],
        linesOfCode: 100,
      });

      // Medium cohesion (0.6), single domain - not quite cohesive-module (needs 0.7)
      const classification = classifyFile(node, 0.6, ['ui']);
      expect(classification).toBe('unknown');
    });
  });

  describe('adjustFragmentationForClassification', () => {
    it('should return 0 fragmentation for barrel exports', () => {
      const result = adjustFragmentationForClassification(0.8, 'barrel-export');
      expect(result).toBe(0);
    });

    it('should return 0 fragmentation for type definitions', () => {
      const result = adjustFragmentationForClassification(0.9, 'type-definition');
      expect(result).toBe(0);
    });

    it('should reduce fragmentation by 70% for cohesive modules', () => {
      const result = adjustFragmentationForClassification(0.6, 'cohesive-module');
      expect(result).toBeCloseTo(0.18, 2); // 0.6 * 0.3
    });

    it('should keep full fragmentation for mixed concerns', () => {
      const result = adjustFragmentationForClassification(0.7, 'mixed-concerns');
      expect(result).toBe(0.7);
    });

    it('should reduce fragmentation by 30% for unknown classification', () => {
      const result = adjustFragmentationForClassification(0.5, 'unknown');
      expect(result).toBeCloseTo(0.35, 2); // 0.5 * 0.7
    });
  });

  describe('getClassificationRecommendations', () => {
    it('should provide barrel export recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'barrel-export',
        'src/index.ts',
        ['High fragmentation']
      );
      expect(recommendations).toContain('Barrel export file detected - multiple domains are expected here');
    });

    it('should provide type definition recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'type-definition',
        'src/types.ts',
        ['High fragmentation']
      );
      expect(recommendations).toContain('Type definition file - centralized types improve consistency');
    });

    it('should provide cohesive module recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'cohesive-module',
        'src/calculator.ts',
        []
      );
      expect(recommendations).toContain('Module has good cohesion despite its size');
    });

    it('should provide mixed concerns recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'mixed-concerns',
        'src/audit.ts',
        ['Multiple domains detected']
      );
      expect(recommendations).toContain('Consider splitting this file by domain');
    });
  });

  describe('integration: barrel export detection edge cases', () => {
    it('should detect barrel export even for non-index files with re-export patterns', () => {
      const node = createNode({
        file: 'src/exports.ts',
        imports: ['../module1', '../module2', '../module3', '../module4', '../module5'],
        exports: [
          { name: 'a', type: 'function' },
          { name: 'b', type: 'function' },
          { name: 'c', type: 'function' },
          { name: 'd', type: 'function' },
          { name: 'e', type: 'function' },
        ],
        linesOfCode: 25, // Very sparse - mostly re-exports
      });

      const classification = classifyFile(node, 0.5, ['module1', 'module2']);
      expect(classification).toBe('barrel-export');
    });

    it('should not misclassify large component files as barrel exports', () => {
      const node = createNode({
        file: 'src/components/Calculator.tsx', // NOT an index file
        imports: ['react', '../hooks', '../utils'],
        exports: [
          { name: 'Calculator', type: 'function' },
        ],
        linesOfCode: 346, // Substantial code
      });

      // Single domain, high cohesion
      const classification = classifyFile(node, 0.9, ['calculator']);
      expect(classification).toBe('cohesive-module');
    });
  });
});