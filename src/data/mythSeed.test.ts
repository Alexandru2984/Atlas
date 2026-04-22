import { describe, expect, it } from 'vitest';
import { mythEdges, mythNodes } from './mythSeed';

describe('myth seed integrity', () => {
  it('contains at least one node and one edge', () => {
    expect(mythNodes.length).toBeGreaterThan(0);
    expect(mythEdges.length).toBeGreaterThan(0);
  });

  it('has unique node ids', () => {
    const ids = mythNodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique edge ids', () => {
    const ids = mythEdges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only existing nodes from edges', () => {
    const nodeIds = new Set(mythNodes.map((node) => node.id));

    for (const edge of mythEdges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it('keeps edge weights in the supported 1-5 range', () => {
    for (const edge of mythEdges) {
      expect(edge.weight).toBeGreaterThanOrEqual(1);
      expect(edge.weight).toBeLessThanOrEqual(5);
    }
  });

  it('uses only allowed node types', () => {
    const allowed = new Set(['deity', 'hero', 'artifact', 'realm', 'event']);

    for (const node of mythNodes) {
      expect(allowed.has(node.type)).toBe(true);
    }
  });

  it('ensures labels and eras are non-empty', () => {
    for (const node of mythNodes) {
      expect(node.label.trim().length).toBeGreaterThan(0);
      expect(node.era.trim().length).toBeGreaterThan(0);
    }
  });

  it('ensures relation text is non-empty', () => {
    for (const edge of mythEdges) {
      expect(edge.relation.trim().length).toBeGreaterThan(0);
    }
  });
});
