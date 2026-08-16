import {
  createEmptyFlowGraph,
  createFlowEdge,
  createFlowNode,
  type FlowGraph,
  type FlowNode,
  type FlowNodeTemplate,
} from '../../shared/domain/flow-graph.js';
import {
  getCategoryLabel,
  getComponentDefinition,
  getNodeCanvasSubtitle,
  hasLabeledBranchOutputs,
  type ComponentPortDefinition,
} from '../../shared/domain/component-registry.js';

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
  portId: string;
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

  loadGraph(graph: FlowGraph): void {
    this.graph = {
      nodes: graph.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
        config: { ...node.config },
      })),
      edges: graph.edges.map((edge) => ({ ...edge })),
    };

    this.selectedNodeId = null;
    this.nodesLayer.replaceChildren();
    this.clearConnectionDraft();

    for (const node of this.graph.nodes) {
      if (getComponentDefinition(node.typeId)) {
        this.renderNode(node);
      }
    }

    this.renderEdges();
    this.syncEmptyState();
    this.options.onSelectionChange?.(null);
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

  addNode(template: FlowNodeTemplate, position?: { x: number; y: number }): FlowNode | null {
    if (!getComponentDefinition(template.typeId)) {
      return null;
    }

    const nodePosition = position ?? this.getViewportCenterPosition();
    const node = createFlowNode(template, nodePosition);
    this.graph.nodes.push(node);
    this.renderNode(node);
    this.selectNode(node.id);
    this.syncEmptyState();
    this.notifyGraphChange();
    return node;
  }

  updateNodeConfig(nodeId: string, fieldId: string, value: unknown): void {
    const node = this.graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }

    node.config[fieldId] = value;
    this.updateNodeDisplayInPlace(nodeId);
    this.notifyGraphChange();
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
        const portId = port.getAttribute('data-port-id');
        if (!portId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.connectionDraft = { nodeId, portId, pointerId: event.pointerId };
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
      const targetPortId = port?.getAttribute('data-port-id') ?? null;

      if (
        targetNodeId &&
        targetPortId &&
        targetNodeId !== this.connectionDraft.nodeId
      ) {
        this.tryCreateEdge(
          this.connectionDraft.nodeId,
          this.connectionDraft.portId,
          targetNodeId,
          targetPortId,
        );
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

  private tryCreateEdge(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): void {
    const sourceDefinition = this.getNodeDefinition(sourceNodeId);
    const targetDefinition = this.getNodeDefinition(targetNodeId);
    if (!sourceDefinition || !targetDefinition) {
      return;
    }

    const sourcePort = sourceDefinition.outputs.find((port) => port.id === sourcePortId);
    const targetPort = targetDefinition.inputs.find((port) => port.id === targetPortId);
    if (!sourcePort || !targetPort) {
      return;
    }

    const duplicate = this.graph.edges.some(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.sourcePortId === sourcePortId &&
        edge.targetNodeId === targetNodeId &&
        edge.targetPortId === targetPortId,
    );
    if (duplicate || sourceNodeId === targetNodeId) {
      return;
    }

    const edge = createFlowEdge(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
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
    const definition = getComponentDefinition(node.typeId);
    if (!definition) {
      return;
    }

    const portCount = Math.max(definition.inputs.length, definition.outputs.length, 1);
    const nodeHeight = getNodeHeight(portCount);

    const element = document.createElement('article');
    element.className = 'flow-canvas__node';
    element.dataset.nodeId = node.id;
    element.dataset.categoryId = node.categoryId;
    element.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    element.style.minHeight = `${nodeHeight}px`;
    element.setAttribute('aria-label', node.name);

    const inputPorts = document.createElement('div');
    inputPorts.className = 'flow-canvas__ports flow-canvas__ports--input';
    for (const [index, port] of definition.inputs.entries()) {
      inputPorts.appendChild(
        this.createPortElement(node, port, index, definition.inputs.length, nodeHeight),
      );
    }

    const body = document.createElement('div');
    body.className = 'flow-canvas__node-body';

    const category = document.createElement('span');
    category.className = 'flow-canvas__node-category';
    category.textContent = getCategoryLabel(node.categoryId);

    const title = document.createElement('span');
    title.className = 'flow-canvas__node-title';
    title.textContent = node.name;

    body.append(category, title);

    const subtitle = getNodeCanvasSubtitle(node.typeId, node.config);
    if (subtitle) {
      const subtitleElement = document.createElement('span');
      subtitleElement.className = 'flow-canvas__node-subtitle';
      subtitleElement.textContent = subtitle;
      body.appendChild(subtitleElement);
    }

    const outputPorts = document.createElement('div');
    outputPorts.className = 'flow-canvas__ports flow-canvas__ports--output';
    const showPortLabels = hasLabeledBranchOutputs(node.typeId);
    for (const [index, port] of definition.outputs.entries()) {
      outputPorts.appendChild(
        this.createPortElement(node, port, index, definition.outputs.length, nodeHeight, showPortLabels),
      );
    }

    if (definition.inputs.length > 0) {
      element.appendChild(inputPorts);
    }
    element.appendChild(body);
    if (definition.outputs.length > 0) {
      element.appendChild(outputPorts);
    }
    this.nodesLayer.append(element);
    this.renderEdges();
  }

  private createPortElement(
    node: FlowNode,
    port: ComponentPortDefinition,
    index: number,
    portCount: number,
    nodeHeight: number,
    showLabel = false,
  ): HTMLElement {
    const portOffsetY = getPortOffsetY(index, portCount, nodeHeight);
    const container =
      showLabel && port.direction === 'output'
        ? document.createElement('div')
        : null;

    if (container) {
      container.className = 'flow-canvas__port-row';
      container.style.top = `${portOffsetY}px`;
    }

    const portElement = document.createElement('button');
    portElement.type = 'button';
    portElement.className = `flow-canvas__port flow-canvas__port--${port.direction}`;
    portElement.dataset.port = port.direction;
    portElement.dataset.portId = port.id;
    portElement.setAttribute('aria-label', `${node.name} ${port.label} ${port.direction}`);
    portElement.title = port.label;
    portElement.tabIndex = -1;

    if (!container) {
      portElement.style.top = `${portOffsetY}px`;
    }

    if (container) {
      const label = document.createElement('span');
      label.className = 'flow-canvas__port-label';
      label.textContent = port.label;
      container.append(label, portElement);
      return container;
    }

    return portElement;
  }

  private updateNodeDisplayInPlace(nodeId: string): void {
    const node = this.graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }

    const element = this.nodesLayer.querySelector(`[data-node-id="${nodeId}"]`);
    if (!element) {
      return;
    }

    const subtitle = getNodeCanvasSubtitle(node.typeId, node.config);
    const existingSubtitle = element.querySelector('.flow-canvas__node-subtitle');

    if (subtitle) {
      if (existingSubtitle instanceof HTMLElement) {
        existingSubtitle.textContent = subtitle;
      } else {
        const subtitleElement = document.createElement('span');
        subtitleElement.className = 'flow-canvas__node-subtitle';
        subtitleElement.textContent = subtitle;
        element.querySelector('.flow-canvas__node-body')?.appendChild(subtitleElement);
      }
      return;
    }

    existingSubtitle?.remove();
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
      const source = this.getPortCenter(edge.sourceNodeId, 'output', edge.sourcePortId);
      const target = this.getPortCenter(edge.targetNodeId, 'input', edge.targetPortId);
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

  private getPortCenter(
    nodeId: string,
    direction: 'input' | 'output',
    portId: string,
  ): { x: number; y: number } | null {
    const node = this.graph.nodes.find((entry) => entry.id === nodeId);
    const definition = node ? getComponentDefinition(node.typeId) : undefined;
    if (!node || !definition) {
      return null;
    }

    const ports = direction === 'input' ? definition.inputs : definition.outputs;
    const portIndex = ports.findIndex((port) => port.id === portId);
    if (portIndex < 0) {
      return null;
    }

    const portCount = Math.max(definition.inputs.length, definition.outputs.length, 1);
    const nodeHeight = getNodeHeight(portCount);
    const y = node.position.y + getPortOffsetY(portIndex, ports.length, nodeHeight);
    const x =
      direction === 'input'
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

    const source = this.getPortCenter(
      this.connectionDraft.nodeId,
      'output',
      this.connectionDraft.portId,
    );
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
      const definition = getComponentDefinition(node.typeId);
      const portCount = Math.max(definition?.inputs.length ?? 1, definition?.outputs.length ?? 1, 1);
      const nodeHeight = getNodeHeight(portCount);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
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

  private getNodeDefinition(nodeId: string) {
    const node = this.graph.nodes.find((entry) => entry.id === nodeId);
    return node ? getComponentDefinition(node.typeId) : undefined;
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
    const parsed = JSON.parse(payload) as Partial<FlowNodeTemplate> & {
      name?: string;
      categoryId?: string;
    };
    if (typeof parsed.typeId === 'string' && getComponentDefinition(parsed.typeId)) {
      return { typeId: parsed.typeId };
    }
  } catch {
    return null;
  }

  return null;
}

const NODE_MIN_HEIGHT = 72;
const PORT_SPACING = 28;

function getNodeHeight(portCount: number): number {
  if (portCount <= 1) {
    return NODE_MIN_HEIGHT;
  }

  return Math.max(NODE_MIN_HEIGHT, (portCount - 1) * PORT_SPACING + 48);
}

function getPortOffsetY(index: number, portCount: number, nodeHeight: number): number {
  if (portCount <= 1) {
    return nodeHeight / 2;
  }

  const spacing = Math.min(PORT_SPACING, nodeHeight / (portCount + 1));
  const totalSpan = spacing * (portCount - 1);
  const startY = (nodeHeight - totalSpan) / 2;
  return startY + index * spacing;
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
