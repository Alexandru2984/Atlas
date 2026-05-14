import type { MythEdge, MythNode, MythNodeType } from '../data/mythSeed';

export type AtlasFilterState = {
  typeFilter: 'all' | MythNodeType;
  eraFilter: string;
  searchQuery: string;
};

export function slugifyNodeId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `n-${base || 'untitled'}`;
}

export function buildEdgeId(source: string, target: string, seed: number): string {
  return `e-${source}-${target}-${seed}`;
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function getAvailableEras(nodes: MythNode[]): string[] {
  return [...new Set(nodes.map((node) => node.era))].sort((left, right) => left.localeCompare(right));
}

export function nodeMatchesFilters(node: MythNode, filters: AtlasFilterState): boolean {
  const matchesType = filters.typeFilter === 'all' || node.type === filters.typeFilter;
  const matchesEra = filters.eraFilter === 'all' || node.era === filters.eraFilter;
  const needle = normalizeSearchQuery(filters.searchQuery);
  const matchesSearch = !needle
    || [node.label, node.summary, node.era, node.type].some((value) => value.toLowerCase().includes(needle));

  return matchesType && matchesEra && matchesSearch;
}

export function getVisibleNodeIds(nodes: MythNode[], filters: AtlasFilterState): Set<string> {
  return new Set(nodes.filter((node) => nodeMatchesFilters(node, filters)).map((node) => node.id));
}

export function edgeIsVisible(edge: MythEdge, visibleNodeIds: Set<string>): boolean {
  return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
}

export function updateNode(nodes: MythNode[], updated: MythNode): MythNode[] {
  return nodes.map((node) => (node.id === updated.id ? updated : node));
}

export function updateEdge(edges: MythEdge[], updated: MythEdge): MythEdge[] {
  return edges.map((edge) => (edge.id === updated.id ? updated : edge));
}

export function removeNode(nodes: MythNode[], edges: MythEdge[], nodeId: string): { nodes: MythNode[]; edges: MythEdge[] } {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
  };
}

export function removeEdge(edges: MythEdge[], edgeId: string): MythEdge[] {
  return edges.filter((edge) => edge.id !== edgeId);
}

export function getLinkedEdges(nodeId: string, edges: MythEdge[]): MythEdge[] {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}