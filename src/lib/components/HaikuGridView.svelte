<script>
  import { createEventDispatcher } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import { Check, X, Filter, SortAsc, SortDesc, Calendar, Type, Tag, MoreVertical, Edit, Trash2 } from 'lucide-svelte';
  
  export let haikus = [];
  export let isOpen = false;
  
  const dispatch = createEventDispatcher();
  
  // State management
  let sortBy = 'updatedAt';
  let sortOrder = 'desc';
  let filterStatus = '';
  let filterTags = [];
  let searchQuery = '';
  let showFilters = false;
  
  // Available filter options
  let availableTags = [];
  
  // Update available tags when haikus change
  $: if (haikus.length > 0) {
    const tagSet = new Set();
    haikus.forEach(haiku => {
      haiku.tags.forEach(tag => tagSet.add(tag));
    });
    availableTags = Array.from(tagSet).sort();
  }
  
  // Filter and sort haikus
  $: filteredHaikus = haikus
    .filter(haiku => {
      // Status filter
      if (filterStatus && haiku.status !== filterStatus) return false;
      
      // Tags filter (AND operation)
      if (filterTags.length > 0 && !filterTags.every(tag => haiku.tags.includes(tag))) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          haiku.title.toLowerCase().includes(query) ||
          haiku.text.toLowerCase().includes(query) ||
          haiku.tags.some(tag => tag.toLowerCase().includes(query)) ||
          (haiku.analysis?.commentary || '').toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle string sorting
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  
  // Handle checkbox toggle
  async function toggleHaikuStatus(haiku) {
    if (!$settingsStore.enableTaskTracking) return;
    
    let newStatus;
    switch (haiku.status) {
      case 'todo':
        newStatus = 'in_progress';
        break;
      case 'in_progress':
        newStatus = 'done';
        // Trigger confetti animation
        dispatch('confetti');
        break;
      case 'done':
        newStatus = 'todo';
        break;
      default:
        newStatus = 'todo';
    }
    
    try {
      await haikuStore.update(haiku.id, { status: newStatus });
      dispatch('haikuUpdated');
    } catch (error) {
      console.error('Failed to update haiku status:', error);
    }
  }
  
  // Handle sorting
  function handleSort(field) {
    if (sortBy === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortOrder = 'desc';
    }
  }
  
  // Handle tag filter toggle
  function toggleTagFilter(tag) {
    if (filterTags.includes(tag)) {
      filterTags = filterTags.filter(t => t !== tag);
    } else {
      filterTags = [...filterTags, tag];
    }
  }
  
  // Clear filters
  function clearFilters() {
    filterStatus = '';
    filterTags = [];
    searchQuery = '';
  }
  
  // Close grid view
  function closeGridView() {
    isOpen = false;
    dispatch('close');
  }
  
  // Handle edit haiku
  function editHaiku(haiku) {
    dispatch('edit', haiku);
  }
  
  // Handle delete haiku
  async function deleteHaiku(haiku) {
    if (confirm(`Are you sure you want to delete "${haiku.title}"?`)) {
      try {
        await haikuStore.delete(haiku.id);
        dispatch('haikuDeleted');
      } catch (error) {
        console.error('Failed to delete haiku:', error);
      }
    }
  }
  
  // Format date
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
  }
  
  // Get status display text
  function getStatusText(status) {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'done': return 'Done';
      default: return status;
    }
  }
</script>

{#if isOpen}
  <div class="grid-view-overlay" on:click={closeGridView}>
    <div class="grid-view-modal" on:click|stopPropagation>
      <!-- Header -->
      <div class="grid-view-header">
        <div class="grid-view-title">
          <h2>Haiku Collection</h2>
          <span class="haiku-count">{filteredHaikus.length} of {haikus.length}</span>
        </div>
        
        <div class="grid-view-actions">
          <button class="filter-toggle" class:active={showFilters} on:click={() => showFilters = !showFilters}>
            <Filter size="16" />
            Filters
          </button>
          <button class="close-button" on:click={closeGridView}>
            <X size="20" />
          </button>
        </div>
      </div>
      
      <!-- Filters -->
      {#if showFilters}
        <div class="filters-section">
          <div class="filter-row">
            <div class="filter-group">
              <label class="filter-label">Search</label>
              <input
                type="text"
                class="filter-input"
                placeholder="Search title, content, tags..."
                bind:value={searchQuery}
              />
            </div>
            
            <div class="filter-group">
              <label class="filter-label">Status</label>
              <div class="select-wrapper">
                <select class="filter-select" bind:value={filterStatus}>
                  <option value="">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">Sort</label>
              <div class="sort-controls">
                <div class="select-wrapper">
                  <select class="filter-select" bind:value={sortBy}>
                    <option value="updatedAt">Updated</option>
                    <option value="createdAt">Created</option>
                    <option value="title">Title</option>
                  </select>
                </div>
                <button 
                  class="sort-order-button" 
                  on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {#if sortOrder === 'asc'}
                    <SortAsc size="16" />
                  {:else}
                    <SortDesc size="16" />
                  {/if}
                </button>
              </div>
            </div>
          </div>
          
          {#if availableTags.length > 0}
            <div class="filter-row">
              <div class="filter-group tags-filter">
                <label class="filter-label">Tags</label>
                <div class="tag-filters">
                  {#each availableTags as tag}
                    <button
                      class="tag-filter"
                      class:active={filterTags.includes(tag)}
                      on:click={() => toggleTagFilter(tag)}
                    >
                      {tag}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
          
          {#if filterStatus || filterTags.length > 0 || searchQuery}
            <div class="filter-row">
              <button class="clear-filters" on:click={clearFilters}>
                Clear Filters
              </button>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Grid Content -->
      <div class="grid-view-content">
        {#if filteredHaikus.length === 0}
          <div class="empty-state">
            {#if haikus.length === 0}
              <div class="empty-icon">📝</div>
              <h3>No haikus yet</h3>
              <p>Start writing haikus to see them here</p>
            {:else}
              <div class="empty-icon">🔍</div>
              <h3>No matching haikus</h3>
              <p>Try adjusting your filters or search terms</p>
            {/if}
          </div>
        {:else}
          <div class="haiku-grid">
            {#each filteredHaikus as haiku}
              <div class="haiku-card">
                <!-- Card Header -->
                <div class="haiku-card-header">
                  <div class="haiku-title-section">
                    {#if $settingsStore.enableTaskTracking}
                      <button
                        class="haiku-checkbox"
                        class:todo={haiku.status === 'todo'}
                        class:in-progress={haiku.status === 'in_progress'}
                        class:done={haiku.status === 'done'}
                        on:click={() => toggleHaikuStatus(haiku)}
                        title="Toggle status"
                      >
                        {#if haiku.status === 'done'}
                          <Check size="14" />
                        {:else if haiku.status === 'in_progress'}
                          <div class="progress-dot"></div>
                        {/if}
                      </button>
                    {/if}
                    <h3 class="haiku-title">{haiku.title}</h3>
                  </div>
                  
                  <div class="haiku-menu">
                    <button class="haiku-menu-button" title="More options">
                      <MoreVertical size="16" />
                    </button>
                    <div class="haiku-menu-dropdown">
                      <button class="menu-item" on:click={() => editHaiku(haiku)}>
                        <Edit size="14" />
                        Edit
                      </button>
                      <button class="menu-item danger" on:click={() => deleteHaiku(haiku)}>
                        <Trash2 size="14" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Haiku Content -->
                <div class="haiku-content">
                  {#each haiku.lines as line}
                    <div class="haiku-line">{line}</div>
                  {/each}
                </div>
                
                <!-- Card Footer -->
                <div class="haiku-card-footer">
                  <div class="haiku-meta">
                    {#if haiku.tags.length > 0}
                      <div class="haiku-tags">
                        {#each haiku.tags as tag}
                          <span class="haiku-tag">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                    
                    {#if haiku.analysis}
                      <div class="haiku-rating">
                        <span class="rating-stars">
                          {#each Array(5) as _, i}
                            <span class="star" class:filled={i < haiku.analysis.rating}>★</span>
                          {/each}
                        </span>
                      </div>
                    {/if}
                  </div>
                  
                  <div class="haiku-info">
                    <span class="haiku-date">{formatDate(haiku.updatedAt)}</span>
                    {#if $settingsStore.enableTaskTracking}
                      <span class="haiku-status status-{haiku.status}">
                        {getStatusText(haiku.status)}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .grid-view-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .grid-view-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 25px 50px var(--card-shadow);
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .grid-view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .grid-view-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .grid-view-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: oklch(var(--bc));
  }

  .haiku-count {
    background: oklch(var(--b3));
    color: oklch(var(--bc) / 0.7);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .grid-view-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: hsl(var(--b1));
    border: 1px solid hsl(var(--b3));
    border-radius: 6px;
    color: hsl(var(--bc) / 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    background: hsl(var(--b2));
    border-color: hsl(var(--bc) / 0.3);
    color: hsl(var(--bc));
  }

  .close-button {
    padding: 8px;
    background: none;
    border: none;
    color: hsl(var(--bc) / 0.7);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: hsl(var(--b3));
    color: hsl(var(--bc));
  }

  .filters-section {
    padding: 16px 24px;
    border-bottom: 1px solid oklch(var(--b3));
    background: oklch(var(--b2));
  }

  .filter-row {
    display: flex;
    align-items: end;
    gap: 16px;
    margin-bottom: 12px;
  }

  .filter-row:last-child {
    margin-bottom: 0;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .filter-group.tags-filter {
    flex: 1;
  }

  .filter-label {
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--bc) / 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .filter-input,
  .filter-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    transition: all 0.2s ease;
    min-width: 150px;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .select-wrapper {
    position: relative;
    display: inline-block;
  }

  .select-wrapper::after {
    content: '';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    background: oklch(var(--bc) / 0.6);
    mask: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3e%3cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3e%3c/svg%3e") no-repeat center;
    mask-size: contain;
    -webkit-mask: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3e%3cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3e%3c/svg%3e") no-repeat center;
    -webkit-mask-size: contain;
    pointer-events: none;
  }

  .filter-select {
    width: 100%;
    padding-right: 32px;
  }

  .filter-input:focus,
  .filter-select:focus {
    outline: none;
    border-color: var(--border-focus);
  }

  /* Style the dropdown options */
  .filter-select option {
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 8px 12px;
  }

  .sort-controls {
    display: flex;
    gap: 4px;
  }

  .sort-order-button {
    padding: 8px;
    background: hsl(var(--b1));
    border: 1px solid hsl(var(--b3));
    border-radius: 6px;
    color: hsl(var(--bc) / 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-order-button:hover {
    background: hsl(var(--b2));
    color: hsl(var(--bc));
  }

  .tag-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-filter {
    padding: 4px 8px;
    background: hsl(var(--b1));
    border: 1px solid hsl(var(--b3));
    border-radius: 4px;
    color: hsl(var(--bc) / 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
  }

  .tag-filter:hover {
    background: hsl(var(--b2));
    color: hsl(var(--bc));
  }

  .tag-filter.active {
    background: hsl(var(--p));
    border-color: hsl(var(--p));
    color: hsl(var(--pc));
  }

  .clear-filters {
    padding: 6px 12px;
    background: none;
    border: 1px solid hsl(var(--b3));
    border-radius: 6px;
    color: hsl(var(--bc) / 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
  }

  .clear-filters:hover {
    background: hsl(var(--er) / 0.1);
    border-color: hsl(var(--er) / 0.3);
    color: hsl(var(--er));
  }

  .grid-view-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--bc));
  }

  .empty-state p {
    margin: 0;
    color: hsl(var(--bc) / 0.7);
    line-height: 1.5;
  }

  .haiku-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .haiku-card {
    background: oklch(var(--b1));
    border: 1px solid oklch(var(--b3));
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
    position: relative;
  }

  .haiku-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: oklch(var(--bc) / 0.3);
  }

  .haiku-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 0 16px;
  }

  .haiku-title-section {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .haiku-checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid hsl(var(--b3));
    border-radius: 4px;
    background: hsl(var(--b1));
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .haiku-checkbox.todo {
    border-color: #fbbf24;
  }

  .haiku-checkbox.in-progress {
    border-color: #3b82f6;
    background: #3b82f6;
  }

  .haiku-checkbox.done {
    border-color: #10b981;
    background: #10b981;
    color: white;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
  }

  .haiku-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: oklch(var(--bc));
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .haiku-menu {
    position: relative;
  }

  .haiku-menu-button {
    padding: 4px;
    background: none;
    border: none;
    color: hsl(var(--bc) / 0.6);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .haiku-menu-button:hover {
    background: hsl(var(--b2));
    color: hsl(var(--bc) / 0.8);
  }

  .haiku-menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    background: hsl(var(--b1));
    border: 1px solid hsl(var(--b3));
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    min-width: 120px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: all 0.2s ease;
  }

  .haiku-menu:hover .haiku-menu-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    color: hsl(var(--bc));
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .menu-item:hover {
    background: hsl(var(--b2));
  }

  .menu-item.danger {
    color: hsl(var(--er));
  }

  .menu-item.danger:hover {
    background: hsl(var(--er) / 0.1);
  }

  .haiku-content {
    padding: 16px;
    text-align: center;
  }

  .haiku-line {
    color: oklch(var(--bc));
    line-height: 1.6;
    margin-bottom: 4px;
    font-size: 15px;
  }

  .haiku-line:last-child {
    margin-bottom: 0;
  }

  .haiku-card-footer {
    padding: 0 16px 16px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .haiku-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .haiku-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .haiku-tag {
    padding: 2px 6px;
    background: hsl(var(--b3));
    color: hsl(var(--bc) / 0.8);
    font-size: 11px;
    border-radius: 4px;
  }

  .haiku-rating {
    display: flex;
    align-items: center;
  }

  .rating-stars {
    display: flex;
    gap: 1px;
  }

  .star {
    color: #e5e7eb;
    font-size: 12px;
  }

  .star.filled {
    color: #fbbf24;
  }

  .haiku-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .haiku-date {
    font-size: 12px;
    color: hsl(var(--bc) / 0.6);
  }

  .haiku-status {
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-todo {
    background: #fef3c7;
    color: #92400e;
  }

  .status-in_progress {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-done {
    background: #d1fae5;
    color: #065f46;
  }
</style>
