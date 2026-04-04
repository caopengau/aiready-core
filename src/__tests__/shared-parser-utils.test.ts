import { describe, it, expect, vi } from 'vitest';
import {
  analyzeGeneralMetadata,
  extractParameterNames,
} from '../parsers/shared-parser-utils';
import * as Parser from 'web-tree-sitter';

describe('shared-parser-utils', () => {
  const mockNode = (properties: any): Parser.Node => {
    return {
      type: 'function_definition',
      text: 'function test() {}',
      childCount: 0,
      children: [],
      child: () => null,
      parent: null,
      ...properties,
    } as unknown as Parser.Node;
  };

  describe('analyzeGeneralMetadata', () => {
    it('should extract JSDoc documentation', () => {
      const docNode = mockNode({ type: 'comment', text: '/** Test Doc */' });
      const funcNode = mockNode({
        previousSibling: docNode,
        text: 'function test() {}',
      });

      const result = analyzeGeneralMetadata(
        funcNode,
        '/** Test Doc */\nfunction test() {}'
      );
      expect(result.documentation).toBeDefined();
      expect(result.documentation?.type).toBe('jsdoc');
      expect(result.documentation?.content).toBe('Test Doc');
    });

    it('should extract XML-doc documentation', () => {
      const docNode = mockNode({
        type: 'comment',
        text: '/// <summary>Test</summary>',
      });
      const funcNode = mockNode({
        previousSibling: docNode,
        text: 'void Test() {}',
      });

      const result = analyzeGeneralMetadata(
        funcNode,
        '/// <summary>Test</summary>\nvoid Test() {}'
      );
      expect(result.documentation?.type).toBe('xml-doc');
    });

    it('should detect side effects from keywords', () => {
      const bodyNode = mockNode({
        text: 'console.log("test");',
        type: 'expression_statement',
      });
      const funcNode = mockNode({
        childCount: 1,
        child: () => bodyNode,
        text: 'function test() { console.log("test"); }',
      });

      const result = analyzeGeneralMetadata(funcNode, funcNode.text);
      expect(result.hasSideEffects).toBe(true);
      expect(result.isPure).toBe(false);
    });

    it('should detect side effects from assignments', () => {
      const assignNode = mockNode({
        type: 'assignment_expression',
        text: 'x = 1',
      });
      const funcNode = mockNode({
        childCount: 1,
        child: () => assignNode,
        text: 'function test() { x = 1; }',
      });

      const result = analyzeGeneralMetadata(funcNode, funcNode.text);
      expect(result.hasSideEffects).toBe(true);
    });
  });

  describe('extractParameterNames', () => {
    it('should extract names from a simple parameter list', () => {
      const param1 = mockNode({ type: 'identifier', text: 'a' });
      const param2 = mockNode({ type: 'identifier', text: 'b' });
      const paramList = mockNode({
        type: 'parameter_list',
        children: [param1, param2],
      });
      const funcNode = mockNode({
        children: [paramList],
      });

      const names = extractParameterNames(funcNode);
      expect(names).toEqual(['a', 'b']);
    });
  });
});
