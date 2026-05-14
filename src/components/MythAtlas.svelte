<script lang="ts">
import { onMount } from 'svelte';
  import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
  import type { MythEdge, MythNode, MythNodeType } from '../data/mythSeed';
  import { hasSupabaseConfig, signInWithEmail, signOutUser, supabase } from '../lib/supabase';
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
  type Panel = 'inspect' | 'add-node' | 'add-edge' | 'edit-node' | 'edit-edge';
  let activePanel = $state<Panel>('inspect');

  const emptyNode = () => ({ label: '', type: 'deity' as MythNodeType, era: '', summary: '' });
  const emptyEdge = () => ({ source: '', target: '', relation: '', weight: 3 });
  let newNode = $state(emptyNode());
  let newEdge = $state(emptyEdge());
  let editingNodeId = $state<string | null>(null);
  let editingEdgeId = $state<string | null>(null);
  let saving = $state(false);
  let saveError = $state('');
  let nodeState = $state<MythNode[]>([]);
  let edgeState = $state<MythEdge[]>([]);
  let typeFilter = $state<'all' | MythNodeType>('all');
  let eraFilter = $state('all');
  let searchQuery = $state('');
  let currentUser: any = $state(null);
  let authEmail = $state('');
  let authPassword = $state('');
  let authError = $state('');
  let authLoading = $state(false);
  let supabaseChannel: any = null;
  let authSubscription: any = null;

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

  const resetEditState = () => {
    editingNodeId = null;
    editingEdgeId = null;
    newNode = emptyNode();
    newEdge = emptyEdge();
  };

  const startEditNode = (node: MythNode) => {
    editingNodeId = node.id;
    newNode = { ...node };
    activePanel = 'edit-node';
    saveError = '';
  };

  const startEditEdge = (edge: MythEdge) => {
    editingEdgeId = edge.id;
    newEdge = { ...edge };
    activePanel = 'edit-edge';
    saveError = '';
  };

  const cancelEdit = () => {
    resetEditState();
    activePanel = 'inspect';
  };

  const canMutate = () => !hasSupabaseConfig || Boolean(currentUser);

  const signIn = async () => {
    if (!supabase) return;
    authLoading = true;
    authError = '';

    const { data, error } = await signInWithEmail(authEmail, authPassword);
    if (error) {
      authError = error.message || 'Unable to sign in';
      authLoading = false;
      return;
    }

    currentUser = data.user;
    authLoading = false;
  };

  const signOut = async () => {
    if (!supabase) return;
    await signOutUser();
    currentUser = null;
  };

  const updateNodeInState = (node: MythNode) => {
    nodeState = nodeState.map((n) => (n.id === node.id ? node : n));
    if (selectedNode?.id === node.id) {
      selectedNode = node;
    }
    const cyNode = cy?.getElementById(node.id);
    if (cyNode?.length) {
      cyNode.data({ label: node.label, type: node.type, color: nodeColors[node.type] });
    }
  };

  const updateEdgeInState = (edge: MythEdge) => {
    edgeState = edgeState.map((e) => (e.id === edge.id ? edge : e));
    if (selectedNode) {
      linkedEdges = getLinkedEdges(selectedNode.id, edgeState);
    }
    const cyEdge = cy?.getElementById(edge.id);
    if (cyEdge?.length) {
      cyEdge.data({ relation: edge.relation, weight: edge.weight });
    }
  };

  const removeNodeFromState = (id: string) => {
    nodeState = nodeState.filter((node) => node.id !== id);
    edgeState = edgeState.filter((edge) => edge.source !== id && edge.target !== id);
    if (selectedNode?.id === id) {
      selectedNode = null;
    }
    cy?.getElementById(id).remove();
    cy?.edges().filter((edge) => edge.source().id() === id || edge.target().id() === id).remove();
  };

  const removeEdgeFromState = (id: string) => {
    edgeState = edgeState.filter((edge) => edge.id !== id);
    if (selectedNode) {
      linkedEdges = getLinkedEdges(selectedNode.id, edgeState);
    }
    cy?.getElementById(id).remove();
  };

  const fitGraph = () => {
    if (!cy) return;
    const visibleElements = cy.elements().filter((el) => el.style('display') !== 'none');
    cy.fit(visibleElements.length ? visibleElements : cy.elements(), 48);
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
    if (!canMutate()) {
      saveError = 'Sign in to make changes.';
      return;
    }
    saving = true;
    saveError = '';
    const node: MythNode = {
      id: editingNodeId ?? slugifyNodeId(newNode.label),
      ...newNode
    };

    if (supabase) {
      const result = editingNodeId
        ? await supabase.from('myth_nodes').update({ label: node.label, type: node.type, era: node.era, summary: node.summary }).eq('id', node.id)
        : await supabase.from('myth_nodes').insert(node);
      if (result.error) { saveError = result.error.message; saving = false; return; }
    }

    if (editingNodeId) {
      updateNodeInState(node);
    } else {
      addNodeToCy(node);
      selectNodeById(node.id);
    }

    resetEditState();
    saving = false;
    activePanel = 'inspect';
  };

  const handleAddEdge = async () => {
    if (!newEdge.source || !newEdge.target || !newEdge.relation.trim()) return;
    if (!canMutate()) {
      saveError = 'Sign in to make changes.';
      return;
    }
    saving = true;
    saveError = '';
    const edge: MythEdge = {
      id: editingEdgeId ?? buildEdgeId(newEdge.source, newEdge.target, Date.now()),
      ...newEdge,
      weight: Number(newEdge.weight)
    };

    if (supabase) {
      const result = editingEdgeId
        ? await supabase.from('myth_edges').update({ source: edge.source, target: edge.target, relation: edge.relation, weight: edge.weight }).eq('id', edge.id)
        : await supabase.from('myth_edges').insert(edge);
      if (result.error) { saveError = result.error.message; saving = false; return; }
    }

    if (editingEdgeId) {
      updateEdgeInState(edge);
    } else {
      addEdgeToCy(edge);
    }

    resetEditState();
    saving = false;
    activePanel = 'inspect';
  };

  const handleDeleteNode = async (id: string) => {
    if (!window.confirm('Delete this node and its linked threads?')) return;
    if (!canMutate()) {
      saveError = 'Sign in to make changes.';
      return;
    }
    saving = true;
    saveError = '';

    if (supabase) {
      const { error: edgeError } = await supabase.from('myth_edges').delete().or(`source.eq.${id},target.eq.${id}`);
      if (edgeError) { saveError = edgeError.message; saving = false; return; }

      const { error } = await supabase.from('myth_nodes').delete().eq('id', id);
      if (error) { saveError = error.message; saving = false; return; }
    }

    removeNodeFromState(id);
    saving = false;
    activePanel = 'inspect';
  };

  const handleDeleteEdge = async (id: string) => {
    if (!window.confirm('Delete this mythic thread?')) return;
    if (!canMutate()) {
      saveError = 'Sign in to make changes.';
      return;
    }
    saving = true;
    saveError = '';

    if (supabase) {
      const { error } = await supabase.from('myth_edges').delete().eq('id', id);
      if (error) { saveError = error.message; saving = false; return; }
    }

    removeEdgeFromState(id);
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

  onMount(async () => {
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

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      currentUser = data.session?.user ?? null;

      const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user ?? null;
      });
      authSubscription = authData?.subscription ?? null;
    }

    // Real-time: add new nodes live if Supabase is connected
    if (supabase) {
      supabaseChannel = supabase
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
      if (supabaseChannel) {
        supabaseChannel.unsubscribe();
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
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

      <button type="button" class="btn-action" onclick={fitGraph}>Fit graph</button>
      <button type="button" class="btn-reset" onclick={resetFilters}>Reset</button>
    </div>

    <div bind:this={cyContainer} class="graph-canvas" aria-label="Myth relationship graph"></div>
  </div>

  <aside class="panel info">
    <nav class="tab-bar">
      <button type="button" class:active={activePanel === 'inspect'} onclick={() => activePanel = 'inspect'}>Inspect</button>
      <button
        type="button"
        class:active={activePanel === 'add-node'}
        onclick={() => activePanel = 'add-node'}
        disabled={hasSupabaseConfig && !currentUser}
        title={hasSupabaseConfig && !currentUser ? 'Sign in to add nodes' : 'Add a new node'}
      >
        + Node
      </button>
      <button
        type="button"
        class:active={activePanel === 'add-edge'}
        onclick={() => activePanel = 'add-edge'}
        disabled={hasSupabaseConfig && !currentUser}
        title={hasSupabaseConfig && !currentUser ? 'Sign in to add threads' : 'Add a new thread'}
      >
        + Thread
      </button>
    </nav>

    {#if activePanel === 'inspect'}
      <p class="eyebrow">Atlas Node</p>
      {#if selectedNode}
        {#if canMutate()}
          <div class="panel-actions">
            <button type="button" class="btn-edit" onclick={() => startEditNode(selectedNode)}>Edit Node</button>
            <button type="button" class="btn-delete" onclick={() => handleDeleteNode(selectedNode.id)}>Delete Node</button>
          </div>
        {:else}
          <p class="auth-hint">Sign in to edit or delete this node.</p>
        {/if}
        <h2>{selectedNode.label}</h2>
        <p class="meta">Type: {selectedNode.type} | Era: {selectedNode.era}</p>
        <p class="summary">{selectedNode.summary}</p>
        <h3>Linked Threads</h3>
        <ul>
          {#each linkedEdges as edge}
            <li>
              <span>{edge.relation} ({edge.source === selectedNode.id ? 'to' : 'from'} {edge.source === selectedNode.id ? edge.target : edge.source})</span>
              {#if canMutate()}
                <div class="edge-actions">
                  <button type="button" class="btn-edit small" onclick={() => startEditEdge(edge)}>Edit</button>
                  <button type="button" class="btn-delete small" onclick={() => handleDeleteEdge(edge.id)}>Delete</button>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Click a node in the graph to inspect its mythic threads.</p>
      {/if}

    {:else if activePanel === 'add-node' || activePanel === 'edit-node'}
      <p class="eyebrow">{editingNodeId ? 'Edit Myth Node' : 'New Myth Node'}</p>
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
        <div class="form-row">
          <button type="submit" class="btn-save" disabled={saving || !canMutate()}>
            {saving ? 'Saving…' : editingNodeId ? 'Save Node' : 'Add to Atlas'}
          </button>
          {#if editingNodeId}
            <button type="button" class="btn-reset" onclick={cancelEdit}>Cancel</button>
          {/if}
        </div>
        {#if hasSupabaseConfig && !currentUser}
          <p class="auth-hint">Sign in to persist node changes in Supabase.</p>
        {/if}
      </form>

    {:else if activePanel === 'add-edge' || activePanel === 'edit-edge'}
      <p class="eyebrow">{editingEdgeId ? 'Edit Mythic Thread' : 'New Mythic Thread'}</p>
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
        <div class="form-row">
          <button type="submit" class="btn-save" disabled={saving || !canMutate()}>
            {saving ? 'Saving…' : editingEdgeId ? 'Save Thread' : 'Weave Thread'}
          </button>
          {#if editingEdgeId}
            <button type="button" class="btn-reset" onclick={cancelEdit}>Cancel</button>
          {/if}
        </div>
        {#if hasSupabaseConfig && !currentUser}
          <p class="auth-hint">Sign in to persist thread changes in Supabase.</p>
        {/if}
      </form>
    {/if}

    <div class="status {hasSupabaseConfig ? 'ok' : 'warn'}">
      {#if hasSupabaseConfig}
        {#if currentUser}
          Signed in as <strong>{currentUser.email ?? currentUser.id}</strong> — changes persist in real-time.
        {:else}
          Supabase connected — sign in to add, edit, or delete graph content.
        {/if}
      {:else}
        Local mode — add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env.
      {/if}
    </div>

    {#if hasSupabaseConfig}
      <div class="auth-panel">
        {#if currentUser}
          <p>Authenticated as <strong>{currentUser.email ?? currentUser.id}</strong>.</p>
          <button type="button" class="btn-signout" onclick={signOut}>Sign out</button>
        {:else}
          <p class="eyebrow">Sign in to manage the Atlas</p>
          <label>
            Email
            <input type="email" bind:value={authEmail} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" bind:value={authPassword} placeholder="••••••••" />
          </label>
          {#if authError}<p class="form-error">{authError}</p>{/if}
          <button type="button" class="btn-save" onclick={signIn} disabled={authLoading}>
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
        {/if}
      </div>
    {/if}
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
    grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(120px, 0.7fr)) auto;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
  }

  .control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .btn-action {
    align-self: end;
    min-height: 42px;
    padding: 0.55rem 0.9rem;
    border: 2px solid #ccdaea;
    border-radius: 10px;
    background: #11243f;
    color: #fff;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .btn-action:hover {
    background: #0c1930;
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

  .form-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .panel-actions {
    display: flex;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }

  .edge-actions {
    display: inline-flex;
    gap: 0.4rem;
    margin-left: 0.8rem;
  }

  .btn-edit,
  .btn-delete,
  .btn-reset {
    min-height: 42px;
    padding: 0.55rem 0.9rem;
    border-radius: 10px;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .btn-edit {
    border: 2px solid #83a6ff;
    background: #f0f4ff;
    color: #0d2f64;
  }

  .btn-edit:hover {
    background: #d8e4ff;
  }

  .btn-delete {
    border: 2px solid #f5c6cb;
    background: #fde8eb;
    color: #8d1b1f;
  }

  .btn-delete:hover {
    background: #f8d7da;
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

  .auth-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.85rem 0.8rem;
    border-radius: 18px;
    background: #f7fbff;
    margin-top: 0.75rem;
  }

  .btn-signout {
    align-self: start;
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

  .auth-hint {
    margin: 0;
    color: #6b4f1a;
    font-size: 0.9rem;
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