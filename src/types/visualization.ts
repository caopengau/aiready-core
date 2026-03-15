/**
 * Shared types for graph-based visualizations
 */

export interface GraphNode {
  id: string;
  label: string;
  path?: string;
  size?: number;
  value?: number;
  color?: string;
  group?: string;
  title?: string;
  x?: number;
  y?: number;
  duplicates?: number;
  tokenCost?: number;
  severity?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type?: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: { id: string; name: string; nodeIds: string[] }[];
  issues?: {
    id: string;
    type: string;
    severity: string;
    nodeIds: string[];
    message: string;
  }[];
  metadata?: any;
  /** Whether the graph was truncated due to size limits */
  truncated?: {
    nodes: boolean;
    edges: boolean;
    nodeCount?: number;
    edgeCount?: number;
    nodeLimit?: number;
    edgeLimit?: number;
  };
}
