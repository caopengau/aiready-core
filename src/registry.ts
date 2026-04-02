import { ToolName } from './types';
import { ToolProvider } from './types/contract';

/**
 * AIReady Tool Registry
 *
 * Central registry for all analysis tools. Decouples the CLI from
 * individual tool packages and allows for easier extension.
 *
 * Supports both singleton usage and multiple instances for test isolation.
 */
export class ToolRegistry {
  private providers: Map<ToolName, ToolProvider>;
  public readonly id: string;

  /**
   * Create a new ToolRegistry instance
   *
   * @param id Optional identifier for the registry (e.g. for debugging)
   */
  constructor(id: string = 'default') {
    this.providers = new Map<ToolName, ToolProvider>();
    this.id = `registry-${id}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Register a new tool provider.
   *
   * @param provider The tool provider to register
   */
  register(provider: ToolProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by its canonical ID.
   *
   * @param id The tool ID
   * @returns The provider if found
   */
  get(id: ToolName): ToolProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get a provider by name or alias.
   *
   * @param nameOrAlias The tool name or alias string
   * @returns The provider if found
   */
  find(nameOrAlias: string): ToolProvider | undefined {
    const exact = this.providers.get(nameOrAlias as ToolName);
    if (exact) return exact;

    for (const p of this.providers.values()) {
      if (p.alias.includes(nameOrAlias)) return p;
    }
    return undefined;
  }

  /**
   * Get all registered tool providers.
   *
   * @returns Array of all registered tool providers
   */
  getAll(): ToolProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all available tool IDs from the ToolName enum.
   *
   * @returns Array of valid ToolName identifiers
   */
  getAvailableIds(): ToolName[] {
    return Object.values(ToolName).filter(
      (v) => typeof v === 'string'
    ) as ToolName[];
  }

  /**
   * Clear the registry (primarily for testing).
   */
  clear(): void {
    this.providers.clear();
  }

  // --- Static Compatibility Layer ---

  private static getGlobalRegistry(): ToolRegistry {
    const g = globalThis as Record<string, unknown>;
    if (!g.__AIRE_TOOL_REGISTRY_INSTANCE__) {
      g.__AIRE_TOOL_REGISTRY_INSTANCE__ = new ToolRegistry('global');
    }
    return g.__AIRE_TOOL_REGISTRY_INSTANCE__ as ToolRegistry;
  }

  /**
   * Static register (Singleton compatibility)
   */
  static register(provider: ToolProvider): void {
    this.getGlobalRegistry().register(provider);
  }

  /**
   * Static get (Singleton compatibility)
   */
  static get(id: ToolName): ToolProvider | undefined {
    return this.getGlobalRegistry().get(id);
  }

  /**
   * Static find (Singleton compatibility)
   */
  static find(nameOrAlias: string): ToolProvider | undefined {
    return this.getGlobalRegistry().find(nameOrAlias);
  }

  /**
   * Static getAll (Singleton compatibility)
   */
  static getAll(): ToolProvider[] {
    return this.getGlobalRegistry().getAll();
  }

  /**
   * Static getAvailableIds (Singleton compatibility)
   */
  static getAvailableIds(): ToolName[] {
    return this.getGlobalRegistry().getAvailableIds();
  }

  /**
   * Static clear (Singleton compatibility)
   */
  static clear(): void {
    this.getGlobalRegistry().clear();
  }
}
