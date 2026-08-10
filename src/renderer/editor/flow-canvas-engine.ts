import {
  createEmptyFlowGraph,
  createFlowEdge,
  createFlowNode,
  type FlowGraph,
  type FlowNode,
  type FlowNodeTemplate,
} from '../../shared/domain/flow-graph.js';

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
const DEFAULT_ZOOM_INDEX = 2;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 72;
const MIN_ZOOM = ZOOM_LEVELS[0] / 100;
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] / 100;

export interface FlowCanvasEngineOptions {
  onSelectionChange?: (node: FlowNode | null) => void;
  onGraphChange?: (graph: FlowGraph) => void;
}

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface PortPointerState {
  nodeId: string;
  pointerId: number;
}

export class FlowCanvasEngine {
  private readonly root: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly edgesLayer: SVGSVGElement;
  private readonly nodesLayer: HTMLElement;
  private readonly emptyState: HTMLElement;
  private readonly options: FlowCanvasEngineOptions;

  private graph: FlowGraph = createEmptyFlowGraph();
  private viewport: ViewportState = { x: 0, y: 0, zoom: 1 };
  private selectedNodeId: string | null = null;
  private zoomIndex = DEFAULT_ZOOM_INDEX;

  private panPointerId: number | null = null;
  private panStart = { x: 0, y: 0 };
  private panOrigin = { x: 0, y: 0 };

  private nodeDragPointerId: number | null = null;
  private nodeDragNodeId: string | null = null;
  private nodeDragStart = { x: 0, y: 0 };
  private nodeDragOrigin = { x: 0, y: 0 };

  private connectionDraft: PortPointerState | null = null;
  private connectionPreviewLine: SVGPathElement | null = null;

  constructor(options: FlowCanvasEngineOptions = {}) {
    this.options = options;

    this.root = document.createElement('div');
    this.root.className = 'flow-canvas';
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', 'Flow canvas');

    this.surface = document.createElement('div');
    this.surface.className = 'flow-canvas__surface';

    this.edgesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.edgesLayer.classList.add('flow-canvas__edges');
    this.edgesLayer.setAttribute('aria-hidden', 'true');

    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'flow-canvas__nodes';

    this.emptyState = document.createElement('div');
    this.emptyState.className = 'flow-canvas__empty-state';
    this.emptyState.innerHTML = `
      <p class="flow-canvas__empty-title">Build your bot flow</p>
      <p class="flow-canvas__empty-description">
        Click or drag components from the library onto the canvas. Connect nodes by dragging from an output port to an input port.
      </p>
    `;

    this.surface.append(this.edgesLayer, this.nodesLayer);
    this.root.append(this.surface, this.emptyState);

    this.bindEvents();
    this.applyViewport();
    this.syncEmptyState();
  }

  getElement(): HTMLElement {
    return this.root;
  }

  getGraph(): FlowGraph {
    return {
      nodes: this.graph.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
      })),
      edges: this.graph.edges.map((edge) => ({ ...edge })),
    };
  }

  getZoomPercent(): number {
    return Math.round(this.viewport.zoom * 100);
  }

  getZoomIndex(): number {
    return this.zoomIndex;
  }

  getMaxZoomIndex(): number {
    return ZOOM_LEVELS.length - 1;
  }

  addNode(template: FlowNodeTemplate, position?: { x: number; y: number }): FlowNode {
    const nodePosition = position ?? this.getViewportCenterPosition();
    const node = createFlowNode(template, nodePosition);
    this.graph.nodes.push(node);
    this.renderNode(node);
    this.selectNode(node.id);
    this.syncEmptyState();
    this.notifyGraphChange();
    return node;
  }

  deleteSelectedNode(): void {
    if (!this.selectedNodeId) {
      return;
    }

    const nodeId = this.selectedNodeId;
    this.graph.nodes = this.graph.nodes.filter((node) => node.id !== nodeId);
    this.graph.edges = this.graph.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    );

    this.root.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
    this.selectedNodeId = null;
    this.renderEdges();
    this.syncEmptyState();
    this.options.onSelectionChange?.(null);
    this.notifyGraphChange();
  }

  zoomIn(): void {
    if (this.zoomIndex < ZOOM_LEVELS.length - 1) {
      this.setZoomIndex(this.zoomIndex + 1);
    }
  }

  zoomOut(): void {
    if (this.zoomIndex > 0) {
      this.setZoomIndex(this.zoomIndex - 1);
    }
  }

  resetView(): void {
    this.setZoomIndex(DEFAULT_ZOOM_INDEX);
    this.viewport.x = 0;
    this.viewport.y = 0;
    this.applyViewport();
  }

  fitToScreen(): void {
    if (this.graph.nodes.length === 0) {
      this.resetView();
      return;
    }

    const bounds = this.getGraphBounds();
    const rect = this.root.getBoundingClientRect();
    const padding = 48;
    const availableWidth = Math.max(rect.width - padding * 2, 1);
    const availableHeight = Math.max(rect.height - padding * 2, 1);
    const graphWidth = Math.max(bounds.width, 1);
    const graphHeight = Math.max(bounds.height, 1);

    const fitZoom = Math.min(availableWidth / graphWidth, availableHeight / graphHeight);
    const clampedZoom = Math.min(Math.max(fitZoom, MIN_ZOOM), MAX_ZOOM);
    this.viewport.zoom = clampedZoom;
    this.zoomIndex = this.findNearestZoomIndex(clampedZoom);

    this.viewport.x = padding + (availableWidth - graphWidth * clampedZoom) / 2 - bounds.minX * clampedZoom;
    this.viewport.y = padding + (availableHeight - graphHeight * clampedZoom) / 2 - bounds.minY * clampedZoom;

    this.applyViewport();
  }

  destroy(): void {
    this.root.replaceChildren();
  }

  private bindEvents(): void {
    this.root.addEventListener('pointerdown', (event) => this.handleRootPointerDown(event));
    this.root.addEventListener('pointermove', (event) => this.handleRootPointerMove(event));
    this.root.addEventListener('pointerup', (event) => this.handleRootPointerUp(event));
    this.root.addEventListener('pointercancel', (event) => this.handleRootPointerUp(event));
    this.root.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    this.root.addEventListener('keydown', (event) => this.handleKeyDown(event));

    this.root.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    });

    this.root.addEventListener('drop', (event) => {
      event.preventDefault();
      const payload = event.dataTransfer?.getData('application/x-slacksmith-component');
      if (!payload) {
        return;
      }

      const template = parseComponentPayload(payload);
      if (!template) {
        return;
      }

      const position = this.clientToWorld(event.clientX, event.clientY);
      this.addNode(template, {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      });
    });
  }

  private handleRootPointerDown(event: PointerEvent): void {
    this.root.focus({ preventScroll: true });

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const port = target.closest('[data-port]');
    if (port instanceof HTMLElement) {
      const nodeElement = port.closest('[data-node-id]');
      const nodeId = nodeElement?.getAttribute('data-node-id');
      const portType = port.getAttribute('data-port');
      if (!nodeId || !portType) {
        return;
      }

      if (portType === 'output') {
        event.preventDefault();
        event.stopPropagation();
        this.connectionDraft = { nodeId, pointerId: event.pointerId };
        this.root.setPointerCapture(event.pointerId);
        this.ensureConnectionPreview();
        this.updateConnectionPreview(event.clientX, event.clientY);
      }
      return;
    }

    const nodeElement = target.closest('[data-node-id]');
    if (nodeElement instanceof HTMLElement) {
      const nodeId = nodeElement.getAttribute('data-node-id');
      if (!nodeId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.selectNode(nodeId);
      this.nodeDragPointerId = event.pointerId;
      this.nodeDragNodeId = nodeId;
      this.nodeDragStart = { x: event.clientX, y: event.clientY };
      const node = this.graph.nodes.find((entry) => entry.id === nodeId);
      if (node) {
        this.nodeDragOrigin = { ...node.position };
      }
      nodeElement.setPointerCapture(event.pointerId);
      return;
    }

    if (target === this.root || target === this.surface || target === this.edgesLayer) {
      this.selectNode(null);
      this.panPointerId = event.pointerId;
      this.panStart = { x: event.clientX, y: event.clientY };
      this.panOrigin = { x: this.viewport.x, y: this.viewport.y };
      this.root.setPointerCapture(event.pointerId);
    }
  }

  private handleRootPointerMove(event: PointerEvent): void {
    if (this.connectionDraft && event.pointerId === this.connectionDraft.pointerId) {
      this.updateConnectionPreview(event.clientX, event.clientY);
      return;
    }

    if (this.nodeDragPointerId === event.pointerId && this.nodeDragNodeId) {
      const deltaX = (event.clientX - this.nodeDragStart.x) / this.viewport.zoom;
      const deltaY = (event.clientY - this.nodeDragStart.y) / this.viewport.zoom;
      const node = this.graph.nodes.find((entry) => entry.id === this.nodeDragNodeId);
      if (node) {
        node.position.x = this.nodeDragOrigin.x + deltaX;
        node.position.y = this.nodeDragOrigin.y + deltaY;
        this.updateNodePosition(node);
        this.renderEdges();
      }
      return;
    }

    if (this.panPointerId === event.pointerId) {
      this.viewport.x = this.panOrigin.x + (event.clientX - this.panStart.x);
      this.viewport.y = this.panOrigin.y + (event.clientY - this.panStart.y);
      this.applyViewport();
    }
  }

  private handleRootPointerUp(event: PointerEvent): void {
    if (this.connectionDraft && event.pointerId === this.connectionDraft.pointerId) {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const port = target instanceof Element ? target.closest('[data-port="input"]') : null;
      const nodeElement = port?.closest('[data-node-id]');
      const targetNodeId = nodeElement?.getAttribute('data-node-id') ?? null;

      if (targetNodeId && targetNodeId !== this.connectionDraft.nodeId) {
        this.tryCreateEdge(this.connectionDraft.nodeId, targetNodeId);
      }

      this.clearConnectionDraft();
      this.root.releasePointerCapture(event.pointerId);
      return;
    }

    if (this.nodeDragPointerId === event.pointerId) {
      this.nodeDragPointerId = null;
      this.nodeDragNodeId = null;
      this.notifyGraphChange();
      return;
    }

    if (this.panPointerId === event.pointerId) {
      this.panPointerId = null;
      this.root.releasePointerCapture(event.pointerId);
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    const rect = this.root.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - this.viewport.x) / this.viewport.zoom;
    const worldY = (cursorY - this.viewport.y) / this.viewport.zoom;

    const direction = event.deltaY < 0 ? 1 : -1;
    const nextIndex = Math.min(Math.max(this.zoomIndex + direction, 0), ZOOM_LEVELS.length - 1);
    if (nextIndex === this.zoomIndex) {
      return;
    }

    this.setZoomIndex(nextIndex);
    this.viewport.x = cursorX - worldX * this.viewport.zoom;
    this.viewport.y = cursorY - worldY * this.viewport.zoom;
    this.applyViewport();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return;
    }

    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      return;
    }

    event.preventDefault();
    this.deleteSelectedNode();
  }

  private tryCreateEdge(sourceNodeId: string, targetNodeId: string): void {
    const duplicate = this.graph.edges.some(
      (edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId,
    );
    if (duplicate || sourceNodeId === targetNodeId) {
      return;
    }

    const edge = createFlowEdge(sourceNodeId, targetNodeId);
    this.graph.edges.push(edge);
    this.renderEdges();
    this.notifyGraphChange();
  }

  private selectNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;

    for (const element of this.nodesLayer.querySelectorAll('[data-node-id]')) {
      element.classList.toggle(
        'flow-canvas__node--selected',
        element.getAttribute('data-node-id') === nodeId,
      );
    }

    const node = nodeId ? (this.graph.nodes.find((entry) => entry.id === nodeId) ?? null) : null;
    this.options.onSelectionChange?.(node);
  }

  private renderNode(node: FlowNode): void {
    const element = document.createElement('article');
    element.className = 'flow-canvas__node';
    element.dataset.nodeId = node.id;
    element.dataset.categoryId = node.categoryId;
    element.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    element.setAttribute('aria-label', node.name);

    const inputPort = document.createElement('button');
    inputPort.type = 'button';
    inputPort.className = 'flow-canvas__port flow-canvas__port--input';
    inputPort.dataset.port = 'input';
    inputPort.setAttribute('aria-label', `${node.name} input`);
    inputPort.tabIndex = -1;

    const body = document.createElement('div');
    body.className = 'flow-canvas__node-body';

    const category = document.createElement('span');
    category.className = 'flow-canvas__node-category';
    category.textContent = formatCategoryLabel(node.categoryId);

    const title = document.createElement('span');
    title.className = 'flow-canvas__node-title';
    title.textContent = node.name;

    body.append(category, title);

    const outputPort = document.createElement('button');
    outputPort.type = 'button';
    outputPort.className = 'flow-canvas__port flow-canvas__port--output';
    outputPort.dataset.port = 'output';
    outputPort.setAttribute('aria-label', `${node.name} output`);
    outputPort.tabIndex = -1;

    element.append(inputPort, body, outputPort);
    this.nodesLayer.append(element);
    this.renderEdges();
  }

  private updateNodePosition(node: FlowNode): void {
    const element = this.nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
    if (element instanceof HTMLElement) {
      element.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    }
  }

  private renderEdges(): void {
    this.edgesLayer.replaceChildren();

    for (const edge of this.graph.edges) {
      const source = this.getPortCenter(edge.sourceNodeId, 'output');
      const target = this.getPortCenter(edge.targetNodeId, 'input');
      if (!source || !target) {
        continue;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('flow-canvas__edge');
      path.setAttribute('d', createEdgePath(source, target));
      path.dataset.edgeId = edge.id;
      this.edgesLayer.append(path);
    }

    if (this.connectionPreviewLine) {
      this.edgesLayer.append(this.connectionPreviewLine);
    }
  }

  private getPortCenter(nodeId: string, port: 'input' | 'output'): { x: number; y: number } | null {
    const node = this.graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return null;
    }

    const y = node.position.y + NODE_HEIGHT / 2;
    const x =
      port === 'input'
        ? node.position.x
        : node.position.x + NODE_WIDTH;

    return { x, y };
  }

  private ensureConnectionPreview(): void {
    if (this.connectionPreviewLine) {
      return;
    }

    this.connectionPreviewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.connectionPreviewLine.classList.add('flow-canvas__edge', 'flow-canvas__edge--preview');
  }

  private updateConnectionPreview(clientX: number, clientY: number): void {
    if (!this.connectionDraft || !this.connectionPreviewLine) {
      return;
    }

    const source = this.getPortCenter(this.connectionDraft.nodeId, 'output');
    if (!source) {
      return;
    }

    const target = this.clientToWorld(clientX, clientY);
    this.connectionPreviewLine.setAttribute('d', createEdgePath(source, target));
    this.renderEdges();
  }

  private clearConnectionDraft(): void {
    this.connectionDraft = null;
    this.connectionPreviewLine = null;
    this.renderEdges();
  }

  private applyViewport(): void {
    this.surface.style.transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.zoom})`;
  }

  private setZoomIndex(index: number): void {
    this.zoomIndex = index;
    this.viewport.zoom = (ZOOM_LEVELS[index] ?? 100) / 100;
    this.applyViewport();
  }

  private findNearestZoomIndex(zoom: number): number {
    let nearestIndex = DEFAULT_ZOOM_INDEX;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < ZOOM_LEVELS.length; index += 1) {
      const level = (ZOOM_LEVELS[index] ?? 100) / 100;
      const distance = Math.abs(level - zoom);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }

  private getViewportCenterPosition(): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    const center = this.clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    };
  }

  private clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.viewport.x) / this.viewport.zoom,
      y: (clientY - rect.top - this.viewport.y) / this.viewport.zoom,
    };
  }

  private getGraphBounds(): {
    minX: number;
    minY: number;
    width: number;
    height: number;
  } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of this.graph.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
    }

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private syncEmptyState(): void {
    const hasNodes = this.graph.nodes.length > 0;
    this.emptyState.hidden = hasNodes;
    this.root.classList.toggle('flow-canvas--has-nodes', hasNodes);
  }

  private notifyGraphChange(): void {
    this.options.onGraphChange?.(this.getGraph());
  }
}

export function serializeComponentTemplate(template: FlowNodeTemplate): string {
  return JSON.stringify(template);
}

export function parseComponentPayload(payload: string): FlowNodeTemplate | null {
  try {
    const parsed = JSON.parse(payload) as Partial<FlowNodeTemplate>;
    if (
      typeof parsed.typeId === 'string' &&
      typeof parsed.name === 'string' &&
      typeof parsed.categoryId === 'string'
    ) {
      return {
        typeId: parsed.typeId,
        name: parsed.name,
        categoryId: parsed.categoryId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function createEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
): string {
  const deltaX = Math.max(Math.abs(target.x - source.x) * 0.5, 40);
  const controlOffset = Math.min(deltaX, 120);
  const c1x = source.x + controlOffset;
  const c1y = source.y;
  const c2x = target.x - controlOffset;
  const c2y = target.y;
  return `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
}

function formatCategoryLabel(categoryId: string): string {
  return categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}
