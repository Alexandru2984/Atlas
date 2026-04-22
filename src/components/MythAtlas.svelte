<script lang="ts">
  import { onMount } from 'svelte';
  import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
  import type { MythEdge, MythNode, MythNodeType } from '../data/mythSeed';
  import { hasSupabaseConfig, supabase } from '../lib/supabase';
  import {
    buildEdgeId,
    edgeIsVisible,
    getAvailableEras,
    getLinkedEdges,
    getVisibleNodeIds,
    slugifyNodeId
  } from '../lib/atlas-utils';

  type Props = {
    nodes: MythNode[];
    edges: MythEdge[];
  };

  let { nodes, edges }: Props = $props();

  let cyContainer: HTMLDivElement | null = null;
  let cy: Core | null = null;
  let selectedNode = $state<MythNode | null>(null);
  let linkedEdges = $state<MythEdge[]>([]);

  // ── Form state ────────────────────────────────────────────
  type Panel = 'inspect' | 'add-node' | 'add-edge';
  let activePanel = $state<Panel>('inspect');

  const emptyNode = () => ({ label: '', type: 'deity' as MythNodeType, era: '', summary: '' });
  const emptyEdge = () => ({ source: '', target: '', relation: '', weight: 3 });
  let newNode = $state(emptyNode());
  let newEdge = $state(emptyEdge());
  let saving = $state(false);
  let saveError = $state('');
  let nodeState = $state<MythNode[]>([]);
  let edgeState = $state<MythEdge[]>([]);
  let typeFilter = $state<'all' | MythNodeType>('all');
  let eraFilter = $state('all');
  let searchQuery = $state('');

  const nodeColors: Record<MythNodeType, string> = {
    deity: '#f96f5d',
    hero: '#f4c95d',
    artifact: '#69c9b9',
    realm: '#83a6ff',
    event: '#f17cb0'
  };

  // ── Helpers ───────────────────────────────────────────────
  const getErasForUi = () => getAvailableEras(nodeState);

  const applyGraphFilters = () => {
    if (!cy) {
      return;
    }

    const visibleNodeIds = getVisibleNodeIds(nodeState, {
      typeFilter,
      eraFilter,
      searchQuery
    });

    cy.nodes().forEach((node) => {
      const isVisible = visibleNodeIds.has(node.id());
      node.style('display', isVisible ? 'element' : 'none');
      node.style('opacity', isVisible ? 1 : 0);
      node.style('border-color', searchQuery.trim() && isVisible ? '#00193a' : '#fefefe');
      node.style('border-width', searchQuery.trim() && isVisible ? 4 : 2);
    });

    cy.edges().forEach((edge) => {
      const isVisible = edgeIsVisible(
        {
          id: edge.id(),
          source: edge.source().id(),
          target: edge.target().id(),
          relation: String(edge.data('relation') ?? ''),
          weight: Number(edge.data('weight') ?? 1)
        },
        visibleNodeIds
      );
      edge.style('display', isVisible ? 'element' : 'none');
      edge.style('opacity', isVisible ? 1 : 0);
    });

    cy.layout({ name: 'cose', animate: true, padding: 26, gravity: 0.25, nodeRepulsion: 16000, idealEdgeLength: 140 } as any).run();
  };

  const resetFilters = () => {
    typeFilter = 'all';
    eraFilter = 'all';
    searchQuery = '';
  };

  const addNodeToCy = (n: MythNode) => {
    if (cy?.getElementById(n.id).length) return;
    nodeState = [...nodeState, n];
    cy?.add({ data: { id: n.id, label: n.label, type: n.type, color: nodeColors[n.type] } });
    cy?.layout({ name: 'cose', animate: true, padding: 26, gravity: 0.25, nodeRepulsion: 16000, idealEdgeLength: 140 } as any).run();
  };

  const addEdgeToCy = (e: MythEdge) => {
    if (cy?.getElementById(e.id).length) return;
    edgeState = [...edgeState, e];
    cy?.add({ data: { id: e.id, source: e.source, target: e.target, relation: e.relation, weight: e.weight } });
    if (selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id)) {
      linkedEdges = edgeState.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id);
    }
  };

  // ── Form submit handlers ──────────────────────────────────
  const handleAddNode = async () => {
    if (!newNode.label.trim() || !newNode.era.trim()) return;
    saving = true;
    saveError = '';
    const node: MythNode = { id: slugifyNodeId(newNode.label), ...newNode };

    if (supabase) {
      const { error } = await supabase.from('myth_nodes').insert(node);
      if (error) { saveError = error.message; saving = false; return; }
    }
    addNodeToCy(node);
    selectNodeById(node.id);
    newNode = emptyNode();
    saving = false;
    activePanel = 'inspect';
  };

  const handleAddEdge = async () => {
    if (!newEdge.source || !newEdge.target || !newEdge.relation.trim()) return;
    saving = true;
    saveError = '';
    const edge: MythEdge = {
      id: buildEdgeId(newEdge.source, newEdge.target, Date.now()),
      ...newEdge,
      weight: Number(newEdge.weight)
    };

    if (supabase) {
      const { error } = await supabase.from('myth_edges').insert(edge);
      if (error) { saveError = error.message; saving = false; return; }
    }
    addEdgeToCy(edge);
    newEdge = emptyEdge();
    saving = false;
    activePanel = 'inspect';
  };

  const selectNodeById = (id: string) => {
    selectedNode = nodeState.find((node) => node.id === id) ?? null;
    linkedEdges = getLinkedEdges(id, edgeState);
  };

  $effect(() => {
    nodeState;
    edgeState;
    typeFilter;
    eraFilter;
    searchQuery;
    applyGraphFilters();
  });

  onMount(() => {
    if (!cyContainer) {
      return;
    }

    nodeState = [...nodes];
    edgeState = [...edges];

    const elements: ElementDefinition[] = [
      ...nodeState.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          color: nodeColors[node.type]
        }
      })),
      ...edgeState.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
          weight: edge.weight
        }
      }))
    ];

    cy = cytoscape({
      container: cyContainer,
      elements,
      layout: {
        name: 'cose',
        animate: true,
        padding: 26,
        gravity: 0.25,
        nodeRepulsion: 16000,
        idealEdgeLength: 140
      },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#0b1726',
            'font-size': 11,
            'font-weight': 700,
            'text-valign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 72,
            'background-color': 'data(color)',
            width: 54,
            height: 54,
            'border-width': 2,
            'border-color': '#fefefe'
          }
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 5, 1, 4)',
            'line-color': '#9fb0c8',
            'target-arrow-color': '#9fb0c8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(relation)',
            color: '#273c57',
            'font-size': 9,
            'text-background-opacity': 0.9,
            'text-background-color': '#f5f9ff',
            'text-background-padding': 2
          }
        },
        {
          selector: ':selected',
          style: {
            'overlay-opacity': 0,
            'border-color': '#00193a',
            'border-width': 4
          }
        }
      ]
    });

    cy.on('tap', 'node', (event) => {
      selectNodeById(event.target.id());
    });

    if (nodeState[0]) {
      selectNodeById(nodeState[0].id);
    }

    // Real-time: add new nodes live if Supabase is connected
    if (supabase) {
      supabase
        .channel('myth_nodes_rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'myth_nodes' }, (payload) => {
          const n = payload.new as MythNode;
          addNodeToCy(n);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'myth_edges' }, (payload) => {
          const e = payload.new as MythEdge;
          addEdgeToCy(e);
        })
        .subscribe();
    }

    return () => {
      cy?.destroy();
      cy = null;
    };
  });
</script>

<section class="atlas-shell">
  <div class="panel graph">
    <div class="graph-controls">
      <label class="control search">
        <span>Search</span>
        <input type="text" bind:value={searchQuery} placeholder="Name, era, summary..." />
      </label>

      <label class="control compact">
        <span>Type</span>
        <select bind:value={typeFilter}>
          <option value="all">All types</option>
          <option value="deity">Deity</option>
          <option value="hero">Hero</option>
          <option value="artifact">Artifact</option>
          <option value="realm">Realm</option>
          <option value="event">Event</option>
        </select>
      </label>

      <label class="control compact">
        <span>Era</span>
        <select bind:value={eraFilter}>
          <option value="all">All eras</option>
          {#each getErasForUi() as era}
            <option value={era}>{era}</option>
          {/each}
        </select>
      </label>

      <button type="button" class="btn-reset" onclick={resetFilters}>Reset</button>
    </div>

    <div bind:this={cyContainer} class="graph-canvas" aria-label="Myth relationship graph"></div>
  </div>

  <aside class="panel info">
    <nav class="tab-bar">
      <button type="button" class:active={activePanel === 'inspect'} onclick={() => activePanel = 'inspect'}>Inspect</button>
      <button type="button" class:active={activePanel === 'add-node'} onclick={() => activePanel = 'add-node'}>+ Node</button>
      <button type="button" class:active={activePanel === 'add-edge'} onclick={() => activePanel = 'add-edge'}>+ Thread</button>
    </nav>

    {#if activePanel === 'inspect'}
      <p class="eyebrow">Atlas Node</p>
      {#if selectedNode}
        <h2>{selectedNode.label}</h2>
        <p class="meta">Type: {selectedNode.type} | Era: {selectedNode.era}</p>
        <p class="summary">{selectedNode.summary}</p>
        <h3>Linked Threads</h3>
        <ul>
          {#each linkedEdges as edge}
            <li>
              {edge.relation} ({edge.source === selectedNode.id ? 'to' : 'from'}
              {edge.source === selectedNode.id ? edge.target : edge.source})
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Click a node in the graph to inspect its mythic threads.</p>
      {/if}

    {:else if activePanel === 'add-node'}
      <p class="eyebrow">New Myth Node</p>
      <form onsubmit={(event) => { event.preventDefault(); handleAddNode(); }}>
        <label>
          Name *
          <input type="text" bind:value={newNode.label} placeholder="e.g. Velarion the Blind" required />
        </label>
        <label>
          Type *
          <select bind:value={newNode.type}>
            <option value="deity">Deity</option>
            <option value="hero">Hero</option>
            <option value="artifact">Artifact</option>
            <option value="realm">Realm</option>
            <option value="event">Event</option>
          </select>
        </label>
        <label>
          Era *
          <input type="text" bind:value={newNode.era} placeholder="e.g. Silver Dusk" required />
        </label>
        <label>
          Summary
          <textarea bind:value={newNode.summary} rows="3" placeholder="Brief description..."></textarea>
        </label>
        {#if saveError}<p class="form-error">{saveError}</p>{/if}
        <button type="submit" class="btn-save" disabled={saving}>
          {saving ? 'Saving…' : 'Add to Atlas'}
        </button>
      </form>

    {:else if activePanel === 'add-edge'}
      <p class="eyebrow">New Mythic Thread</p>
      <form onsubmit={(event) => { event.preventDefault(); handleAddEdge(); }}>
        <label>
          From *
          <select bind:value={newEdge.source} required>
            <option value="">— select node —</option>
            {#each nodeState as n}
              <option value={n.id}>{n.label}</option>
            {/each}
          </select>
        </label>
        <label>
          To *
          <select bind:value={newEdge.target} required>
            <option value="">— select node —</option>
            {#each nodeState as n}
              <option value={n.id}>{n.label}</option>
            {/each}
          </select>
        </label>
        <label>
          Relation *
          <input type="text" bind:value={newEdge.relation} placeholder="e.g. betrayed, forged, dreamed of" required />
        </label>
        <label>
          Strength (1–5): {newEdge.weight}
          <input type="range" min="1" max="5" bind:value={newEdge.weight} />
        </label>
        {#if saveError}<p class="form-error">{saveError}</p>{/if}
        <button type="submit" class="btn-save" disabled={saving}>
          {saving ? 'Saving…' : 'Weave Thread'}
        </button>
      </form>
    {/if}

    <div class="status {hasSupabaseConfig ? 'ok' : 'warn'}">
      {#if hasSupabaseConfig}
        Supabase connected — changes persist in real-time.
      {:else}
        Local mode — add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env.
      {/if}
    </div>
  </aside>
</section>

<style>
  .atlas-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
    gap: 1rem;
  }

  .panel {
    border-radius: 22px;
    background: rgba(245, 249, 255, 0.82);
    box-shadow: 0 12px 36px rgba(18, 36, 62, 0.14);
    backdrop-filter: blur(4px);
  }

  .graph {
    padding: 0.75rem;
  }

  .graph-controls {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(140px, 0.7fr)) auto;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
  }

  .control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .control span {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #44658d;
    font-weight: 700;
  }

  .control.compact select,
  .control.search input {
    min-height: 42px;
  }

  .btn-reset {
    align-self: end;
    min-height: 42px;
    padding: 0.55rem 0.9rem;
    border: 2px solid #ccdaea;
    border-radius: 10px;
    background: #f5f9ff;
    color: #183150;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .graph-canvas {
    width: 100%;
    min-height: 68vh;
    border-radius: 18px;
    background: radial-gradient(circle at 20% 20%, #fef4e4 0%, #edf4ff 34%, #e5f7f5 100%);
  }

  .info {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tab-bar {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .tab-bar button {
    flex: 1;
    padding: 0.45rem 0.5rem;
    border: 2px solid #ccdaea;
    border-radius: 10px;
    background: transparent;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    color: #3a6080;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab-bar button.active,
  .tab-bar button:hover {
    background: #11243f;
    color: #fff;
    border-color: #11243f;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: #2f4f73;
  }

  input[type='text'],
  select,
  textarea {
    padding: 0.45rem 0.6rem;
    border: 2px solid #ccdaea;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.9rem;
    color: #0c1f35;
    background: #f5f9ff;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type='text']:focus,
  select:focus,
  textarea:focus {
    border-color: #4a8abf;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #11243f;
  }

  textarea {
    resize: vertical;
  }

  .btn-save {
    margin-top: 0.3rem;
    padding: 0.55rem 1rem;
    border: none;
    border-radius: 12px;
    background: #11243f;
    color: #fff;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-error {
    margin: 0;
    color: #c0392b;
    font-size: 0.85rem;
  }

  .hint {
    color: #44658d;
    font-size: 0.95rem;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    color: #44658d;
  }

  h2 {
    margin: 0.2rem 0 0.3rem;
    font-size: 1.8rem;
    line-height: 1.1;
    color: #11243f;
  }

  .meta {
    margin: 0;
    color: #2f4f73;
    font-size: 0.92rem;
  }

  .summary {
    margin: 1rem 0;
    color: #183150;
  }

  h3 {
    margin: 1rem 0 0.6rem;
    color: #183150;
    font-size: 1rem;
  }

  ul {
    margin: 0;
    padding-left: 1rem;
    color: #1f3d60;
    font-size: 0.94rem;
  }

  li + li {
    margin-top: 0.42rem;
  }

  .status {
    margin-top: 1.2rem;
    border-radius: 12px;
    padding: 0.7rem 0.8rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .status.ok {
    background: #dff4ee;
    color: #145540;
  }

  .status.warn {
    background: #fff2dd;
    color: #6f4e00;
  }

  @media (max-width: 900px) {
    .atlas-shell {
      grid-template-columns: 1fr;
    }

    .graph-controls {
      grid-template-columns: 1fr 1fr;
    }

    .control.search {
      grid-column: 1 / -1;
    }

    .btn-reset {
      grid-column: 1 / -1;
    }

    .graph-canvas {
      min-height: 55vh;
    }
  }
</style>