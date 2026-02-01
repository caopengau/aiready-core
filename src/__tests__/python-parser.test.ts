/**
 * Test Python parser
 */

import { describe, it, expect } from 'vitest';
import { PythonParser } from '../parsers/python-parser';
import { Language } from '../types/language';

describe('PythonParser', () => {
  const parser = new PythonParser();

  it('should have correct language and extensions', () => {
    expect(parser.language).toBe(Language.Python);
    expect(parser.extensions).toContain('.py');
  });

  it('should handle .py files', () => {
    expect(parser.canHandle('test.py')).toBe(true);
    expect(parser.canHandle('Test.PY')).toBe(true);
    expect(parser.canHandle('test.ts')).toBe(false);
  });

  it('should return PEP 8 naming conventions', () => {
    const conventions = parser.getNamingConventions();
    
    // Variables and functions should be snake_case
    expect(conventions.variablePattern.test('my_variable')).toBe(true);
    expect(conventions.variablePattern.test('myVariable')).toBe(false);
    expect(conventions.functionPattern.test('my_function')).toBe(true);
    
    // Classes should be PascalCase
    expect(conventions.classPattern.test('MyClass')).toBe(true);
    expect(conventions.classPattern.test('my_class')).toBe(false);
    
    // Constants should be UPPER_CASE
    expect(conventions.constantPattern.test('MY_CONSTANT')).toBe(true);
    expect(conventions.constantPattern.test('myConstant')).toBe(false);
    
    // Should have Python special method exceptions
    expect(conventions.exceptions).toContain('__init__');
    expect(conventions.exceptions).toContain('__str__');
  });

  describe('Import Extraction', () => {
    it('should extract simple imports', () => {
      const code = `
import os
import sys
import json
`;
      const result = parser.parse(code, 'test.py');
      
      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].source).toBe('os');
      expect(result.imports[1].source).toBe('sys');
      expect(result.imports[2].source).toBe('json');
    });

    it('should extract from imports', () => {
      const code = `
from typing import List, Dict, Optional
from pathlib import Path
`;
      const result = parser.parse(code, 'test.py');
      
      expect(result.imports).toHaveLength(2);
      
      const typingImport = result.imports.find(i => i.source === 'typing');
      expect(typingImport).toBeDefined();
      expect(typingImport?.specifiers).toContain('List');
      expect(typingImport?.specifiers).toContain('Dict');
      expect(typingImport?.specifiers).toContain('Optional');
      
      const pathlibImport = result.imports.find(i => i.source === 'pathlib');
      expect(pathlibImport?.specifiers).toContain('Path');
    });

    it('should handle wildcard imports', () => {
      const code = `from os import *`;
      const result = parser.parse(code, 'test.py');
      
      expect(result.imports[0].source).toBe('os');
      expect(result.imports[0].specifiers).toContain('*');
    });
  });

  describe('Export Extraction', () => {
    it('should extract module-level functions', () => {
      const code = `
def public_function():
    pass

def another_function(arg1, arg2):
    return arg1 + arg2
`;
      const result = parser.parse(code, 'test.py');
      
      const funcNames = result.exports.map(e => e.name);
      expect(funcNames).toContain('public_function');
      expect(funcNames).toContain('another_function');
    });

    it('should extract classes', () => {
      const code = `
class MyClass:
    def __init__(self):
        self.value = 0
    
    def method(self):
        pass

class AnotherClass:
    pass
`;
      const result = parser.parse(code, 'test.py');
      
      const classNames = result.exports.filter(e => e.type === 'class').map(e => e.name);
      expect(classNames).toContain('MyClass');
      expect(classNames).toContain('AnotherClass');
      
      // Methods should not be exported as separate entities
      const methodNames = result.exports.map(e => e.name);
      expect(methodNames).not.toContain('method');
    });

    it('should not export private functions', () => {
      const code = `
def public_function():
    pass

def _private_function():
    pass

def __dunder_function__():
    pass
`;
      const result = parser.parse(code, 'test.py');
      
      const funcNames = result.exports.map(e => e.name);
      expect(funcNames).toContain('public_function');
      expect(funcNames).toContain('__dunder_function__'); // Dunder methods are included
      expect(funcNames).not.toContain('_private_function'); // Single underscore excluded
    });

    it('should extract __all__ exports', () => {
      const code = `
__all__ = ['foo', 'bar', 'MyClass']

def foo():
    pass

def bar():
    pass

class MyClass:
    pass
`;
      const result = parser.parse(code, 'test.py');
      
      const names = result.exports.map(e => e.name);
      expect(names).toContain('foo');
      expect(names).toContain('bar');
      expect(names).toContain('MyClass');
    });
  });

  it('should include warning about regex-based parsing', () => {
    const code = 'import os';
    const result = parser.parse(code, 'test.py');
    
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toContain('regex-based');
  });

  it('should parse real-world Python code', () => {
    const code = `
"""
A sample Python module
"""
from typing import List, Optional
import os
import sys

__all__ = ['process_data', 'DataProcessor']

class DataProcessor:
    """Process data"""
    
    def __init__(self, config: dict):
        self.config = config
    
    def process(self, data: List[str]) -> List[str]:
        return [item.upper() for item in data]

def process_data(items: List[str]) -> Optional[List[str]]:
    """Process a list of items"""
    if not items:
        return None
    return [item.strip() for item in items]

def _helper_function():
    """Private helper"""
    pass

MY_CONSTANT = 42
`;
    const result = parser.parse(code, 'example.py');
    
    // Check imports
    expect(result.imports.length).toBeGreaterThan(0);
    const typingImport = result.imports.find(i => i.source === 'typing');
    expect(typingImport).toBeDefined();
    
    // Check exports
    const exportNames = result.exports.map(e => e.name);
    expect(exportNames).toContain('DataProcessor');
    expect(exportNames).toContain('process_data');
    expect(exportNames).not.toContain('_helper_function');
    expect(exportNames).not.toContain('process'); // Method, not module-level
  });
});
