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

export function createEmptyFlowGraph(): FlowGraph {
  return { nodes: [], edges: [] };
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
