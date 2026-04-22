import { describe, expect, it } from 'vitest';
import { mythEdges, mythNodes } from '../data/mythSeed';
import {
  buildEdgeId,
  edgeIsVisible,
  getAvailableEras,
  getLinkedEdges,
  getVisibleNodeIds,
  nodeMatchesFilters,
  normalizeSearchQuery,
  slugifyNodeId,
  type AtlasFilterState
} from './atlas-utils';

describe('atlas-utils', () => {
  describe('slugifyNodeId', () => {
    it('creates predictable ids from normal labels', () => {
      expect(slugifyNodeId('Aetherion')).toBe('n-aetherion');
      expect(slugifyNodeId('Sylvar of Reed')).toBe('n-sylvar-of-reed');
    });

    it('normalizes symbols and spaces', () => {
      expect(slugifyNodeId('  Ember   Gate!!!  ')).toBe('n-ember-gate');
      expect(slugifyNodeId('Night/Harvest')).toBe('n-night-harvest');
    });

    it('falls back to untitled when label has no alphanumerics', () => {
      expect(slugifyNodeId('---')).toBe('n-untitled');
    });
  });

  describe('buildEdgeId', () => {
    it('builds deterministic edge id from source target and seed', () => {
      expect(buildEdgeId('n-a', 'n-b', 42)).toBe('e-n-a-n-b-42');
    });
  });

  describe('normalizeSearchQuery', () => {
    it('trims and lowercases text', () => {
      expect(normalizeSearchQuery('  Dawn AGE  ')).toBe('dawn age');
    });
  });

  describe('getAvailableEras', () => {
    it('returns unique sorted eras', () => {
      expect(getAvailableEras(mythNodes)).toEqual(['Bronze Tide', 'Dawn Age', 'Glass Epoch', 'Iron Bloom']);
    });
  });

  describe('nodeMatchesFilters', () => {
    const base: AtlasFilterState = {
      typeFilter: 'all',
      eraFilter: 'all',
      searchQuery: ''
    };

    it('matches everything when all filters are neutral', () => {
      for (const node of mythNodes) {
        expect(nodeMatchesFilters(node, base)).toBe(true);
      }
    });

    it('matches by type', () => {
      const deityNode = mythNodes.find((n) => n.type === 'deity');
      const heroNode = mythNodes.find((n) => n.type === 'hero');

      expect(nodeMatchesFilters(deityNode!, { ...base, typeFilter: 'deity' })).toBe(true);
      expect(nodeMatchesFilters(heroNode!, { ...base, typeFilter: 'deity' })).toBe(false);
    });

    it('matches by era', () => {
      const dawnNode = mythNodes.find((n) => n.era === 'Dawn Age');
      const ironNode = mythNodes.find((n) => n.era === 'Iron Bloom');

      expect(nodeMatchesFilters(dawnNode!, { ...base, eraFilter: 'Dawn Age' })).toBe(true);
      expect(nodeMatchesFilters(ironNode!, { ...base, eraFilter: 'Dawn Age' })).toBe(false);
    });

    it('matches by free-text in label summary and type', () => {
      const aetherion = mythNodes.find((n) => n.id === 'n-aetherion')!;
      const mirea = mythNodes.find((n) => n.id === 'n-mirea')!;

      expect(nodeMatchesFilters(aetherion, { ...base, searchQuery: 'storm-forger' })).toBe(true);
      expect(nodeMatchesFilters(mirea, { ...base, searchQuery: 'hero' })).toBe(true);
      expect(nodeMatchesFilters(mirea, { ...base, searchQuery: 'volcanic' })).toBe(false);
    });

    it('combines all filters with AND semantics', () => {
      const aetherion = mythNodes.find((n) => n.id === 'n-aetherion')!;

      expect(
        nodeMatchesFilters(aetherion, {
          typeFilter: 'deity',
          eraFilter: 'Dawn Age',
          searchQuery: 'prophecies'
        })
      ).toBe(true);

      expect(
        nodeMatchesFilters(aetherion, {
          typeFilter: 'hero',
          eraFilter: 'Dawn Age',
          searchQuery: 'prophecies'
        })
      ).toBe(false);
    });
  });

  describe('getVisibleNodeIds', () => {
    it('returns all node ids for neutral filters', () => {
      const ids = getVisibleNodeIds(mythNodes, {
        typeFilter: 'all',
        eraFilter: 'all',
        searchQuery: ''
      });

      expect(ids.size).toBe(mythNodes.length);
      expect(ids.has('n-aetherion')).toBe(true);
      expect(ids.has('n-mirea')).toBe(true);
    });

    it('returns narrowed ids for specific filters', () => {
      const ids = getVisibleNodeIds(mythNodes, {
        typeFilter: 'hero',
        eraFilter: 'all',
        searchQuery: ''
      });

      expect(ids).toEqual(new Set(['n-sylvar', 'n-mirea']));
    });
  });

  describe('edgeIsVisible', () => {
    it('shows edge only when both endpoints are visible', () => {
      const edge = mythEdges[0];
      const allVisible = new Set(['n-aetherion', 'n-lumen-vein']);
      const oneMissing = new Set(['n-aetherion']);

      expect(edgeIsVisible(edge, allVisible)).toBe(true);
      expect(edgeIsVisible(edge, oneMissing)).toBe(false);
    });
  });

  describe('getLinkedEdges', () => {
    it('returns incoming and outgoing links for a node', () => {
      const linked = getLinkedEdges('n-sylvar', mythEdges);
      expect(linked.map((e) => e.id).sort()).toEqual(['e-2', 'e-3', 'e-6']);
    });

    it('returns empty array for unknown node id', () => {
      expect(getLinkedEdges('n-missing', mythEdges)).toEqual([]);
    });
  });
});
