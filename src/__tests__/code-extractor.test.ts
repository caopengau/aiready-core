import { describe, it, expect } from 'vitest';
import { extractCodeBlocks, inferPatternType } from '../utils/code-extractor';

describe('code-extractor', () => {
  describe('inferPatternType', () => {
    it('should infer api-handler', () => {
      expect(inferPatternType('function', 'handleRequest')).toBe('api-handler');
      expect(inferPatternType('handler', 'anyName')).toBe('api-handler');
      expect(inferPatternType('function', 'userController')).toBe(
        'api-handler'
      );
    });

    it('should infer validator', () => {
      expect(inferPatternType('const', 'userSchema')).toBe('validator');
      expect(inferPatternType('function', 'validateUser')).toBe('validator');
    });

    it('should infer utility', () => {
      expect(inferPatternType('function', 'formatUtil')).toBe('utility');
      expect(inferPatternType('function', 'stringHelper')).toBe('utility');
    });

    it('should infer component', () => {
      expect(inferPatternType('function', 'UserProfile')).toBe('component');
      expect(inferPatternType('const', 'Button')).toBe('component');
    });

    it('should infer function', () => {
      expect(inferPatternType('function', 'doWork')).toBe('function');
      expect(inferPatternType('def', 'python_func')).toBe('function');
    });
  });

  describe('extractCodeBlocks', () => {
    it('should extract JS/TS functions', () => {
      const content = `
export function add(a, b) {
  return a + b;
}

class Calculator {
  multiply(a, b) {
    return a * b;
  }
}
      `;
      const blocks = extractCodeBlocks('test.ts', content);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].code).toContain('export function add');
      expect(blocks[1].code).toContain('class Calculator');
    });

    it('should extract Python functions by indentation', () => {
      const content = `
def top_func():
    print("hello")
    if True:
        print("nested")

class MyClass:
    def method(self):
        pass

def another_func():
    pass
      `;
      const blocks = extractCodeBlocks('test.py', content);
      // It finds top_func, MyClass, method (indented), and another_func
      expect(blocks).toHaveLength(4);
      expect(blocks[0].code).toContain('def top_func():');
      expect(blocks[1].code).toContain('class MyClass:');
      expect(blocks[3].code).toContain('def another_func():');
    });

    it('should filter out re-exports', () => {
      const content = `
export { name } from './module';
export * from './other';
export function realFunc() { return 1; }
      `;
      const blocks = extractCodeBlocks('index.ts', content);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain('function realFunc');
    });
  });
});
