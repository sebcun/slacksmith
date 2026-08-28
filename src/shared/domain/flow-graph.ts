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

export interface FlowCanvas {
  id: string;
  name: string;
  graph: FlowGraph;
}

export interface ProjectCanvases {
  version: 2;
  activeCanvasId: string;
  canvases: FlowCanvas[];
}

export interface FlowNodeTemplate {
  typeId: string;
}

export const FLOW_FILE_NAME = 'flow.json';
export const FLOW_RELATIVE_DIR = 'data';
export const MAX_PROJECT_CANVASES = 20;
export const DEFAULT_MAIN_CANVAS_NAME = 'Main';

export function createEmptyFlowGraph(): FlowGraph {
  return { nodes: [], edges: [] };
}

export function createFlowCanvas(name: string): FlowCanvas {
  return {
    id: crypto.randomUUID(),
    name,
    graph: createEmptyFlowGraph(),
  };
}

export function createEmptyProjectCanvases(): ProjectCanvases {
  const mainCanvas = createFlowCanvas(DEFAULT_MAIN_CANVAS_NAME);

  return {
    version: 2,
    activeCanvasId: mainCanvas.id,
    canvases: [mainCanvas],
  };
}

export function generateDefaultCanvasName(canvases: FlowCanvas[]): string {
  const existingNames = new Set(canvases.map((canvas) => canvas.name.toLowerCase()));

  if (!existingNames.has(DEFAULT_MAIN_CANVAS_NAME.toLowerCase())) {
    return DEFAULT_MAIN_CANVAS_NAME;
  }

  for (let index = 2; index <= MAX_PROJECT_CANVASES + 1; index += 1) {
    const candidate = `Canvas ${index}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `Canvas ${canvases.length + 1}`;
}

export function ensureUniqueCanvasName(
  name: string,
  canvases: FlowCanvas[],
  excludeCanvasId?: string,
): string {
  const trimmed = name.trim();
  const baseName = trimmed.length > 0 ? trimmed : DEFAULT_MAIN_CANVAS_NAME;

  const isTaken = (candidate: string): boolean =>
    canvases.some(
      (canvas) =>
        canvas.id !== excludeCanvasId && canvas.name.toLowerCase() === candidate.toLowerCase(),
    );

  if (!isTaken(baseName)) {
    return baseName;
  }

  for (let index = 2; index <= MAX_PROJECT_CANVASES + 1; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  return `${baseName} ${crypto.randomUUID().slice(0, 4)}`;
}

export function cloneFlowCanvas(canvas: FlowCanvas, name: string): FlowCanvas {
  const nodeIdMap = new Map<string, string>();

  const nodes = canvas.graph.nodes.map((node) => {
    const newId = crypto.randomUUID();
    nodeIdMap.set(node.id, newId);

    return {
      ...node,
      id: newId,
      position: { ...node.position },
      config: { ...node.config },
    };
  });

  const edges = canvas.graph.edges.map((edge) => ({
    ...edge,
    id: crypto.randomUUID(),
    sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
    targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
  }));

  return {
    id: crypto.randomUUID(),
    name,
    graph: { nodes, edges },
  };
}

export function mergeCanvasGraphs(canvases: FlowCanvas[]): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  for (const canvas of canvases) {
    nodes.push(
      ...canvas.graph.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
        config: { ...node.config },
      })),
    );
    edges.push(...canvas.graph.edges.map((edge) => ({ ...edge })));
  }

  return { nodes, edges };
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
  const migrated = migrateRawFlowGraph(value);

  if (!isValidFlowGraph(migrated)) {
    return null;
  }

  return cloneFlowGraph(migrated);
}

function cloneFlowGraph(graph: FlowGraph): FlowGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      config: { ...node.config },
    })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

function isFlowCanvas(value: unknown): value is FlowCanvas {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    isValidFlowGraph(value.graph)
  );
}

export function isValidProjectCanvases(value: unknown): value is ProjectCanvases {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.canvases)) {
    return false;
  }

  if (
    typeof value.activeCanvasId !== 'string' ||
    value.activeCanvasId.length === 0 ||
    value.canvases.length === 0 ||
    value.canvases.length > MAX_PROJECT_CANVASES
  ) {
    return false;
  }

  if (!value.canvases.every(isFlowCanvas)) {
    return false;
  }

  const canvasIds = new Set(value.canvases.map((canvas) => canvas.id));
  const canvasNames = new Set<string>();

  for (const canvas of value.canvases) {
    const normalizedName = canvas.name.trim().toLowerCase();
    if (canvasNames.has(normalizedName)) {
      return false;
    }
    canvasNames.add(normalizedName);
  }

  return canvasIds.has(value.activeCanvasId);
}

function migrateLegacyFlowGraphToProjectCanvases(value: unknown): ProjectCanvases | null {
  const migrated = migrateRawFlowGraph(value);

  if (!isValidFlowGraph(migrated)) {
    return null;
  }

  const mainCanvas = createFlowCanvas(DEFAULT_MAIN_CANVAS_NAME);
  mainCanvas.graph = cloneFlowGraph(migrated);

  return {
    version: 2,
    activeCanvasId: mainCanvas.id,
    canvases: [mainCanvas],
  };
}

export function parseProjectCanvases(value: unknown): ProjectCanvases | null {
  if (isValidProjectCanvases(value)) {
    return {
      version: 2,
      activeCanvasId: value.activeCanvasId,
      canvases: value.canvases.map((canvas) => ({
        id: canvas.id,
        name: canvas.name.trim(),
        graph: cloneFlowGraph(canvas.graph),
      })),
    };
  }

  return migrateLegacyFlowGraphToProjectCanvases(value);
}

function migrateRawFlowGraph(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return value;
  }

  const nodes = value.nodes
    .map((node) => {
      if (!isRecord(node)) {
        return node;
      }

      if (typeof node.typeId !== 'string' || getComponentDefinition(node.typeId) !== undefined) {
        return node;
      }

      return {
        ...node,
        typeId: 'if-else',
        name: getComponentDefinition('if-else')?.name ?? node.name,
        categoryId: 'conditions',
      };
    })
    .filter((node) => node !== null);

  const nodeTypeById = new Map<string, string>();
  for (const node of nodes) {
    if (isRecord(node) && typeof node.id === 'string' && typeof node.typeId === 'string') {
      nodeTypeById.set(node.id, node.typeId);
    }
  }

  const edges = value.edges
    .map((edge) => {
      if (!isRecord(edge)) {
        return edge;
      }

      const sourceTypeId =
        typeof edge.sourceNodeId === 'string'
          ? nodeTypeById.get(edge.sourceNodeId)
          : undefined;

      if (sourceTypeId === 'if-else') {
        if (edge.sourcePortId === 'match') {
          return { ...edge, sourcePortId: 'true' };
        }

        if (edge.sourcePortId === 'no-match') {
          return { ...edge, sourcePortId: 'false' };
        }
      }

      return edge;
    })
    .filter((edge) => edge !== null);

  return {
    ...value,
    nodes,
    edges,
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
