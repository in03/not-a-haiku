<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import { X, Edit, Check, ChevronDown, Trash2 } from 'lucide-svelte';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  
  export let haiku = null;
  export let isOpen = false;
  
  const dispatch = createEventDispatcher();
  
  // Local state
  let statusDropdownOpen = false;
  let statusDropdownElement;
  let showDeleteConfirmation = false;
  
  // Close viewer
  function closeViewer() {
    isOpen = false;
    dispatch('close');
  }
  
  // Handle edit
  function editHaiku() {
    dispatch('edit', haiku);
    closeViewer();
  }

  // Handle delete haiku
  function deleteHaiku() {
    showDeleteConfirmation = true;
  }

  // Confirm delete
  async function confirmDelete() {
    if (!haiku || !haiku.id) {
      console.error('No haiku to delete');
      return;
    }
    
    try {
      await haikuStore.delete(haiku.id);
      dispatch('delete', haiku);
      closeViewer();
    } catch (error) {
      console.error('Failed to delete haiku:', error);
      alert('Failed to delete haiku. Please try again.');
    }
  }

  // Cancel delete
  function cancelDelete() {
    showDeleteConfirmation = false;
  }
  
  // Handle status change
  async function changeStatus(newStatus) {
    if (!haiku || !$settingsStore.enableTaskTracking) return;
    
    try {
      await haikuStore.update(haiku.id, { status: newStatus });
      // Update the local haiku object immediately for UI reactivity
      haiku.status = newStatus;
      dispatch('haikuUpdated');
      statusDropdownOpen = false;
    } catch (error) {
      console.error('Failed to update haiku status:', error);
    }
  }
  
  // Handle tag removal
  async function removeTag(tagToRemove) {
    if (!haiku) return;
    
    try {
      const updatedTags = haiku.tags.filter(tag => tag !== tagToRemove);
      await haikuStore.update(haiku.id, { tags: updatedTags });
      // Update the local haiku object immediately for UI reactivity
      haiku.tags = updatedTags;
      dispatch('haikuUpdated');
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
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
  
  // Get status color
  function getStatusColor(status) {
    switch (status) {
      case 'todo': return '#fbbf24';
      case 'in_progress': return '#3b82f6';
      case 'done': return '#10b981';
      default: return '#6b7280';
    }
  }
  
  // Format date
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Generate consistent color for tag based on its name
  function getTagColor(tagName) {
    // Predefined color palette for tags
    const colors = [
      '#ef4444', // red-500
      '#f97316', // orange-500
      '#eab308', // yellow-500
      '#22c55e', // green-500
      '#06b6d4', // cyan-500
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#d946ef', // fuchsia-500
      '#ec4899', // pink-500
      '#6b7280', // gray-500
      '#84cc16', // lime-500
      '#14b8a6', // teal-500
      '#6366f1', // indigo-500
      '#a855f7', // purple-500
      '#f43f5e'  // rose-500
    ];
    
    // Simple hash function to get consistent color for same tag name
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash + tagName.charCodeAt(i)) & 0xffffffff;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  // Handle click outside status dropdown using capture phase
  function handleClickOutside(event) {
    if (statusDropdownElement && !statusDropdownElement.contains(event.target)) {
      statusDropdownOpen = false;
    }
  }

  // Use capture phase to handle clicks before stopPropagation
  onMount(() => {
    document.addEventListener('click', handleClickOutside, true); // true = capture phase
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside, true);
  });

  // Prevent clicks inside status dropdown from closing it
  function handleStatusDropdownClick(event) {
    event.stopPropagation();
  }
  
  // Close dropdown when component closes
  $: if (!isOpen) {
    statusDropdownOpen = false;
  }
</script>

{#if isOpen && haiku}
  <div class="viewer-overlay" on:click={closeViewer}>
    <div class="viewer-modal" on:click|stopPropagation>
      <!-- Header -->
      <div class="viewer-header">
        <div class="viewer-title">
          <h2>{haiku.title}</h2>
          <span class="viewer-date">{formatDate(haiku.updatedAt)}</span>
        </div>
        
        <button class="close-button" on:click={closeViewer}>
          <X size="20" />
        </button>
      </div>
      
      <!-- Toolbar -->
      <div class="viewer-toolbar">
        <div class="toolbar-left">
          <!-- Status Dropdown -->
          {#if $settingsStore.enableTaskTracking}
            <div class="status-dropdown" bind:this={statusDropdownElement}>
              <button 
                class="status-button" 
                on:click={() => statusDropdownOpen = !statusDropdownOpen}
                style="border-color: {getStatusColor(haiku.status)}; color: {getStatusColor(haiku.status)}"
              >
                <span>{getStatusText(haiku.status)}</span>
                <ChevronDown size="14" class={statusDropdownOpen ? 'rotated' : ''} />
              </button>
              
              {#if statusDropdownOpen}
                <div class="status-dropdown-menu" on:click={handleStatusDropdownClick}>
                  <button 
                    class="status-option" 
                    class:active={haiku.status === 'todo'}
                    on:click={() => changeStatus('todo')}
                  >
                    <div class="status-indicator" style="background-color: #fbbf24;"></div>
                    <span>To Do</span>
                    {#if haiku.status === 'todo'}<Check size="14" />{/if}
                  </button>
                  <button 
                    class="status-option" 
                    class:active={haiku.status === 'in_progress'}
                    on:click={() => changeStatus('in_progress')}
                  >
                    <div class="status-indicator" style="background-color: #3b82f6;"></div>
                    <span>In Progress</span>
                    {#if haiku.status === 'in_progress'}<Check size="14" />{/if}
                  </button>
                  <button 
                    class="status-option" 
                    class:active={haiku.status === 'done'}
                    on:click={() => changeStatus('done')}
                  >
                    <div class="status-indicator" style="background-color: #10b981;"></div>
                    <span>Done</span>
                    {#if haiku.status === 'done'}<Check size="14" />{/if}
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Edit Button -->
          <button class="toolbar-button primary" on:click={editHaiku}>
            <Edit size="16" />
            <span>Edit</span>
          </button>
          
          <!-- Delete Button -->
          <button class="toolbar-button danger" on:click={deleteHaiku}>
            <Trash2 size="16" />
            <span>Delete</span>
          </button>
        </div>
        
        <!-- Tags -->
        <div class="toolbar-tags">
          {#if haiku.tags && haiku.tags.length > 0}
            {#each haiku.tags as tag}
              <div class="tag-item" style="background-color: {getTagColor(tag)}20; border-color: {getTagColor(tag)}40;">
                <span class="tag-text" style="color: {getTagColor(tag)};">{tag}</span>
                <button class="tag-remove" on:click={() => removeTag(tag)} title="Remove tag" style="color: {getTagColor(tag)};">
                  <X size="10" />
                </button>
              </div>
            {/each}
          {:else}
            <div class="no-tags-message">
              <span class="no-tags-text">No tags to see here 🏷️👀</span>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Content -->
      <div class="viewer-content">
        <div class="haiku-display">
          <div class="quote-open">"</div>
          {#each haiku.lines as line}
            <div class="haiku-line">{line}</div>
          {/each}
          <div class="quote-close">"</div>
        </div>
        
        <!-- Analysis -->
        {#if haiku.analysis}
          <div class="haiku-analysis">
            <div class="analysis-header">
              <h3>Analysis</h3>
              {#if haiku.analysis.rating > 0}
                <div class="rating-display">
                  {#each Array(5) as _, i}
                    <span class="star" class:filled={i < haiku.analysis.rating}>★</span>
                  {/each}
                </div>
              {/if}
            </div>
            {#if haiku.analysis.commentary}
              <p class="analysis-text">{haiku.analysis.commentary}</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Dialog -->
<ConfirmationDialog
  bind:isOpen={showDeleteConfirmation}
  title="Delete Haiku"
  message='Are you sure you want to delete "{haiku?.title}"? This action cannot be undone.'
  confirmText="Delete"
  cancelText="Cancel"
  type="danger"
  on:confirm={confirmDelete}
  on:cancel={cancelDelete}
/>


<style>
  .viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .viewer-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: 0 25px 50px var(--card-shadow);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(10px);
  }
  
  .viewer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 24px 24px 16px 24px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .viewer-title h2 {
    margin: 0 0 4px 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
  }
  
  .viewer-date {
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .close-button {
    padding: 8px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .close-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .viewer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    gap: 16px;
    flex-wrap: wrap;
  }
  
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }
  
  .toolbar-button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .toolbar-button.primary {
    background: var(--border-focus);
    border-color: var(--border-focus);
    color: white;
  }
  
  .toolbar-button.primary:hover {
    background: color-mix(in srgb, var(--border-focus) 90%, black);
  }

  .toolbar-button.danger {
    background: #ef4444;
    border-color: #ef4444;
    color: white;
  }

  .toolbar-button.danger:hover {
    background: #dc2626;
    border-color: #dc2626;
  }
  
  .status-dropdown {
    position: relative;
  }
  
  .status-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 2px solid;
    border-radius: 8px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }
  
  .status-button:hover {
    background: var(--bg-secondary);
  }
  
  .status-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 140px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px var(--card-shadow);
    z-index: 10;
    margin-top: 4px;
  }
  
  .status-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }
  
  .status-option:hover {
    background: var(--bg-secondary);
  }
  
  .status-option.active {
    background: var(--bg-tertiary);
  }
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .toolbar-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    max-width: 400px;
    min-height: 32px;
  }
  
  .no-tags-message {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    min-height: 24px;
  }
  
  .no-tags-text {
    color: var(--text-tertiary);
    font-size: 11px;
    font-style: italic;
  }
  
  .tag-item {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    min-height: 24px;
    transition: all 0.2s ease;
  }
  
  .tag-item:hover {
    opacity: 0.8;
    transform: translateY(-1px);
  }
  
  .tag-text {
    font-weight: 500;
    white-space: nowrap;
  }
  
  .tag-remove {
    padding: 1px;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }
  
  .tag-remove:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }
  
  .viewer-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px 24px;
  }
  
  .haiku-display {
    text-align: center;
    margin-bottom: 32px;
    position: relative;
    padding: 10px 30px;
  }
  
  .quote-open,
  .quote-close {
    font-size: 48px;
    font-weight: 300;
    color: var(--text-tertiary);
    line-height: 1;
    font-family: Georgia, 'Times New Roman', serif;
    position: absolute;
  }
  
  .quote-open {
    top: -5px;
    left: 5px;
  }
  
  .quote-close {
    bottom: -10px;
    right: 5px;
  }
  
  .haiku-line {
    font-size: 18px;
    line-height: 1.8;
    color: var(--text-primary);
    margin-bottom: 8px;
    font-weight: 400;
    font-style: italic;
  }
  
  .haiku-line:last-child {
    margin-bottom: 0;
  }
  
  .haiku-analysis {
    border-top: 1px solid var(--border-color);
    padding-top: 24px;
  }
  
  .analysis-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .analysis-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .rating-display {
    display: flex;
    gap: 2px;
  }
  
  .star {
    color: #e5e7eb;
    font-size: 16px;
  }
  
  .star.filled {
    color: #fbbf24;
  }
  
  .analysis-text {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
    font-size: 14px;
  }
  
  .rotated {
    transform: rotate(180deg);
  }

  /* Mobile Responsiveness */
  @media (max-width: 768px) {
    .viewer-overlay {
      padding: 10px;
    }

    .viewer-modal {
      max-height: 95vh;
      border-radius: 12px;
    }

    .viewer-header {
      padding: 16px 16px 12px 16px;
      gap: 12px;
    }

    .viewer-title h2 {
      font-size: 18px;
      line-height: 1.3;
    }

    .viewer-date {
      font-size: 12px;
    }

    .close-button {
      padding: 6px;
      flex-shrink: 0;
    }

    .close-button :global(svg) {
      width: 18px;
      height: 18px;
    }

    .viewer-toolbar {
      padding: 12px 16px;
      gap: 8px;
      flex-wrap: wrap;
    }

    .toolbar-left {
      gap: 8px;
      flex-wrap: wrap;
    }

    .toolbar-button {
      font-size: 13px;
      padding: 8px 12px;
      gap: 6px;
    }

    .status-button {
      font-size: 13px;
      padding: 8px 12px;
      min-width: 100px;
    }

    .toolbar-tags {
      max-width: 100%;
      margin-top: 8px;
    }

    .tag-item {
      font-size: 11px;
      padding: 3px 6px;
      min-height: 22px;
    }

    .haiku-display {
      padding: 16px 20px;
      margin: 12px 16px;
    }

    .haiku-display .haiku-text {
      font-size: 16px;
      line-height: 1.6;
    }

    .quote-open,
    .quote-close {
      font-size: 36px;
    }

    .quote-open {
      top: -3px;
      left: 3px;
    }

    .quote-close {
      bottom: -8px;
      right: 3px;
    }

    /* Mobile status dropdown */
    .status-dropdown-menu {
      right: 0;
      left: auto;
      min-width: 120px;
    }

    .status-option {
      font-size: 13px;
      padding: 8px 12px;
    }
  }

  @media (max-width: 480px) {
    .viewer-header {
      padding: 12px;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .viewer-title {
      text-align: center;
    }

    .viewer-title h2 {
      font-size: 16px;
    }

    .close-button {
      align-self: flex-end;
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .viewer-toolbar {
      padding: 8px 12px;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .toolbar-left {
      flex-direction: column;
      gap: 8px;
    }

    .toolbar-button,
    .status-button {
      width: 100%;
      justify-content: center;
      font-size: 14px;
      padding: 10px 16px;
    }

    .toolbar-tags {
      margin-top: 0;
      justify-content: center;
    }

    .haiku-display {
      padding: 12px 16px;
      margin: 8px 12px;
    }

    .haiku-display .haiku-text {
      font-size: 15px;
      line-height: 1.5;
    }

    .quote-open,
    .quote-close {
      font-size: 30px;
    }
  }
</style>
