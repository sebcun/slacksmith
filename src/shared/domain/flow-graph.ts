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
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNodeTemplate {
  typeId: string;
  name: string;
  categoryId: string;
}

export function createEmptyFlowGraph(): FlowGraph {
  return { nodes: [], edges: [] };
}

export function createFlowNode(
  template: FlowNodeTemplate,
  position: FlowNodePosition,
): FlowNode {
  return {
    id: crypto.randomUUID(),
    typeId: template.typeId,
    name: template.name,
    categoryId: template.categoryId,
    position,
  };
}

export function createFlowEdge(sourceNodeId: string, targetNodeId: string): FlowEdge {
  return {
    id: crypto.randomUUID(),
    sourceNodeId,
    targetNodeId,
  };
}
