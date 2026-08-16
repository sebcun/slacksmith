import { createDefaultNodeConfig, getComponentDefinition } from './component-registry.js';

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  typeId: string;
  name: string;
  categoryId: string;
  position: FlowNodePosition;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNodeTemplate {
  typeId: string;
}

export const FLOW_FILE_NAME = 'flow.json';
export const FLOW_RELATIVE_DIR = 'data';

export function createEmptyFlowGraph(): FlowGraph {
  return { nodes: [], edges: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFlowNodePosition(value: unknown): value is FlowNodePosition {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  );
}

function isFlowNode(value: unknown): value is FlowNode {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.typeId === 'string' &&
    value.typeId.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.categoryId === 'string' &&
    isFlowNodePosition(value.position) &&
    isRecord(value.config) &&
    getComponentDefinition(value.typeId) !== undefined
  );
}

function isFlowEdge(value: unknown): value is FlowEdge {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.sourceNodeId === 'string' &&
    typeof value.sourcePortId === 'string' &&
    typeof value.targetNodeId === 'string' &&
    typeof value.targetPortId === 'string'
  );
}

export function isValidFlowGraph(value: unknown): value is FlowGraph {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return false;
  }

  if (!value.nodes.every(isFlowNode) || !value.edges.every(isFlowEdge)) {
    return false;
  }

  const nodeIds = new Set(value.nodes.map((node) => node.id));

  for (const edge of value.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      return false;
    }
  }

  return true;
}

export function parseFlowGraph(value: unknown): FlowGraph | null {
  if (!isValidFlowGraph(value)) {
    return null;
  }

  return {
    nodes: value.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      config: { ...node.config },
    })),
    edges: value.edges.map((edge) => ({ ...edge })),
  };
}

export function createFlowNode(
  template: FlowNodeTemplate,
  position: FlowNodePosition,
): FlowNode {
  const definition = getComponentDefinition(template.typeId);
  if (!definition) {
    throw new Error(`Unknown component type: ${template.typeId}`);
  }

  return {
    id: crypto.randomUUID(),
    typeId: template.typeId,
    name: definition.name,
    categoryId: definition.categoryId,
    position,
    config: createDefaultNodeConfig(template.typeId),
  };
}

export function createFlowEdge(
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge {
  return {
    id: crypto.randomUUID(),
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
  };
}
