import { TSESTree } from '@typescript-eslint/typescript-estree';

/**
 * Find which imports are used within a node
 */
export function findUsedImports(
  node: TSESTree.Node,
  importedNames: Set<string>
): string[] {
  const usedImports = new Set<string>();

  function visit(n: TSESTree.Node) {
    if (n.type === 'Identifier' && importedNames.has(n.name)) {
      usedImports.add(n.name);
    }

    // Recursively visit child nodes
    for (const key in n) {
      const value = (n as any)[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((child) => {
            if (child && typeof child === 'object' && 'type' in child) {
              visit(child);
            }
          });
        } else if ('type' in value) {
          visit(value);
        }
      }
    }
  }

  visit(node);
  return Array.from(usedImports);
}

/**
 * Extract TypeScript type references from a node
 * Collects all type identifiers used in type annotations
 */
export function extractTypeReferences(node: TSESTree.Node): string[] {
  const types = new Set<string>();

  function visit(n: any) {
    if (!n || typeof n !== 'object') return;

    // Type references
    if (n.type === 'TSTypeReference' && n.typeName) {
      if (n.typeName.type === 'Identifier') {
        types.add(n.typeName.name);
      } else if (n.typeName.type === 'TSQualifiedName') {
        // Handle qualified names like A.B.C
        let current = n.typeName;
        while (current.type === 'TSQualifiedName') {
          if (current.right?.type === 'Identifier') {
            types.add(current.right.name);
          }
          current = current.left;
        }
        if (current.type === 'Identifier') {
          types.add(current.name);
        }
      }
    }

    // Interface references
    if (n.type === 'TSInterfaceHeritage' && n.expression) {
      if (n.expression.type === 'Identifier') {
        types.add(n.expression.name);
      }
    }

    // Recursively visit children
    for (const key of Object.keys(n)) {
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  }

  visit(node);
  return Array.from(types);
}
