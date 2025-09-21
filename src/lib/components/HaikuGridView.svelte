<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import HaikuViewer from './HaikuViewer.svelte';
  import ConfirmationDialog from './ConfirmationDialog.svelte';
  import TagMultiSelect from './TagMultiSelect.svelte';
  import { Check, X, Filter, SortAsc, SortDesc, Calendar, Type, Tag, MoreVertical, Edit, Trash2, Search, Grid3X3, ChevronDown } from 'lucide-svelte';
  
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
  let searchInput;
  
  // Viewer state
  let viewerOpen = false;
  let selectedHaiku = null;
  
  // Keyboard navigation state
  let selectedIndex = -1;
  let haikuCards = [];
  let selectedHaikus = new Set(); // Multi-select state
  let lastSelectedIndex = -1;
  let showDeleteConfirmation = false;
  
  // Dropdown state
  let statusDropdownOpen = false;
  let sortDropdownOpen = false;
  let statusDropdownElement;
   let sortDropdownElement;
   let showMobileStatusSelector = false;
   let mobileStatusDropdownElement;
  
  // Available filter options
  let availableTags = [];
  
  // Update available tags when haikus change
  $: if (haikus.length > 0) {
    const tagSet = new Set();
    haikus.forEach(haiku => {
      if (haiku.tags && haiku.tags.length > 0) {
      haiku.tags.forEach(tag => tagSet.add(tag));
      }
    });
    availableTags = Array.from(tagSet).sort();
  }
  
  // Track when sort/filter state changes (not individual haiku updates)
  let lastSortState = '';
  let lastFilterState = '';
  let filteredHaikus = [];
  
  // Filter and sort haikus
  $: {
    const currentSortState = `${sortBy}-${sortOrder}`;
    const currentFilterState = `${filterStatus}-${filterTags.join(',')}-${searchQuery}`;
    const currentHaikusLength = haikus.length; // Track haikus array changes (for deletions/additions)
    
    // Re-sort if sort/filter state changed OR if haikus array changed (deletions/additions)
    if (currentSortState !== lastSortState || currentFilterState !== lastFilterState || currentHaikusLength !== filteredHaikus.length) {
      lastSortState = currentSortState;
      lastFilterState = currentFilterState;
      
      filteredHaikus = haikus
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
    }
  }
  
  // Handle checkbox toggle - simple toggle between current status and "done"
  async function toggleHaikuStatus(haiku) {
    if (!$settingsStore.enableTaskTracking) return;
    
    dismissMultiSelect(); // Dismiss multiselect when toggling individual status
    
    const newStatus = haiku.status === 'done' ? 'todo' : 'done';
    
    // Trigger confetti animation if marking as done
    if (newStatus === 'done') {
        dispatch('confetti');
    }
    
    try {
      await haikuStore.update(haiku.id, { status: newStatus });
      // Update the local haiku object immediately for UI reactivity
      haiku.status = newStatus;
      // Force Svelte to detect the change by reassigning the array
      filteredHaikus = filteredHaikus;
      dispatch('haikuUpdated');
    } catch (error) {
      console.error('Failed to update haiku status:', error);
    }
  }
  
  // Handle sorting
  function handleSort(field) {
    dismissMultiSelect(); // Dismiss multiselect when changing sort
    if (sortBy === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortOrder = 'desc';
    }
  }
  
  
  // Clear filters
  function clearFilters() {
    dismissMultiSelect(); // Dismiss multiselect when clearing filters
    filterStatus = '';
    filterTags = [];
    searchQuery = '';
  }

  
  // Close grid view
  function closeGridView() {
    isOpen = false;
    selectedIndex = -1; // Reset selection
    clearSelection(); // Clear multi-select
     statusDropdownOpen = false; // Close dropdowns
     sortDropdownOpen = false;
     showMobileStatusSelector = false;
    dispatch('close');
  }
  
  // Handle view haiku
  function viewHaiku(haiku) {
    selectedHaiku = haiku;
    viewerOpen = true;
    dispatch('viewerOpen');
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
  
  // Close viewer
  function closeViewer() {
    viewerOpen = false;
    selectedHaiku = null;
    dispatch('viewerClose');
    // Don't reset selectedIndex, keep selection when returning to grid
  }
  
  // Multi-select functions
  function handleHaikuClick(event, haiku, index) {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd click: toggle selection
      event.preventDefault();
      if (selectedHaikus.has(haiku.id)) {
        selectedHaikus.delete(haiku.id);
      } else {
        selectedHaikus.add(haiku.id);
      }
      lastSelectedIndex = index;
      selectedIndex = index;
    } else if (event.shiftKey && lastSelectedIndex !== -1) {
      // Shift click: range selection
      event.preventDefault();
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (filteredHaikus[i]) {
          selectedHaikus.add(filteredHaikus[i].id);
        }
      }
    } else {
      // Normal click: clear multiselect and open viewer
      selectedHaikus.clear();
      lastSelectedIndex = index;
      selectedIndex = index;
      viewHaiku(haiku);
    }
    // Trigger reactivity
    selectedHaikus = selectedHaikus;
  }
  
  function selectAll() {
    selectedHaikus.clear();
    filteredHaikus.forEach(haiku => selectedHaikus.add(haiku.id));
    selectedHaikus = selectedHaikus;
  }
  
  function clearSelection() {
    selectedHaikus.clear();
    selectedIndex = -1;
    lastSelectedIndex = -1;
    selectedHaikus = selectedHaikus;
  }
  
  // Auto-dismiss multiselect for non-selection actions
  function dismissMultiSelect() {
    if (selectedHaikus.size > 0) {
      clearSelection();
    }
  }
  
  async function markSelectedAsDone() {
    const selectedArray = Array.from(selectedHaikus);
    for (const haikuId of selectedArray) {
      const haiku = filteredHaikus.find(h => h.id === haikuId);
      if (haiku && $settingsStore.enableTaskTracking) {
        await toggleHaikuStatus(haiku);
      }
    }
    clearSelection();
    dispatch('haikuUpdated');
  }
  
  function deleteSelected() {
    showDeleteConfirmation = true;
  }

  async function confirmDelete() {
    const selectedArray = Array.from(selectedHaikus);
    
    try {
      for (const haikuId of selectedArray) {
        await haikuStore.delete(haikuId);
      }
      clearSelection();
      dispatch('haikuUpdated');
    } catch (error) {
      console.error('Failed to delete haikus:', error);
      alert('Failed to delete some haikus. Please try again.');
    }
  }

  function cancelDelete() {
    showDeleteConfirmation = false;
  }
  
  // Handle viewer edit
  function handleViewerEdit(event) {
    dispatch('edit', event.detail);
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

  // Get status color
  function getStatusColor(status) {
    switch (status) {
      case 'todo': return '#fbbf24';
      case 'in_progress': return '#3b82f6';
      case 'done': return '#10b981';
      default: return '#6b7280';
    }
  }

  // Get sort display text
  function getSortText(sortBy) {
    switch (sortBy) {
      case 'updatedAt': return 'Updated';
      case 'createdAt': return 'Created';
      case 'title': return 'Title';
      default: return sortBy;
    }
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

  // Handle dropdown clicks
  function handleStatusDropdownClick(event) {
    event.stopPropagation();
  }

  function handleSortDropdownClick(event) {
    event.stopPropagation();
  }

   // Handle click outside dropdowns
   function handleClickOutside(event) {
     if (statusDropdownElement && !statusDropdownElement.contains(event.target)) {
       statusDropdownOpen = false;
     }
     if (sortDropdownElement && !sortDropdownElement.contains(event.target)) {
       sortDropdownOpen = false;
     }
     if (showMobileStatusSelector && mobileStatusDropdownElement && !mobileStatusDropdownElement.contains(event.target)) {
       showMobileStatusSelector = false;
     }
   }

   // Mobile dropdown click handlers
   function handleMobileStatusClick(event) {
     event.stopPropagation();
   }


  // Handle keyboard shortcuts and navigation
  function handleKeydown(event) {
    if (!isOpen) return;
    
    // CMD/CTRL + K to focus search
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      if (searchInput) {
        searchInput.focus();
      }
      return;
    }
    
    // Escape to close
    if (event.key === 'Escape') {
      if (viewerOpen) {
        closeViewer();
      } else {
        closeGridView();
      }
      return;
    }
    
    // Keyboard navigation for haiku selection
    if (!viewerOpen && filteredHaikus.length > 0) {
      const gridColumns = 3; // Assume 3 columns for responsive grid
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          const downIndex = selectedIndex + gridColumns;
          if (downIndex < filteredHaikus.length) {
            selectedIndex = downIndex;
          } else {
            // Wrap to first column of current row
            const currentRow = Math.floor(selectedIndex / gridColumns);
            selectedIndex = Math.min(currentRow * gridColumns, filteredHaikus.length - 1);
          }
          scrollToSelected();
          break;
        case 'ArrowUp':
          event.preventDefault();
          const upIndex = selectedIndex - gridColumns;
          if (upIndex >= 0) {
            selectedIndex = upIndex;
          } else {
            // Wrap to last column of last row
            const lastRow = Math.floor((filteredHaikus.length - 1) / gridColumns);
            const lastRowStart = lastRow * gridColumns;
            const lastRowEnd = Math.min(lastRowStart + gridColumns - 1, filteredHaikus.length - 1);
            selectedIndex = lastRowEnd;
          }
          scrollToSelected();
          break;
        case 'ArrowRight':
          event.preventDefault();
          const rightIndex = selectedIndex + 1;
          if (rightIndex < filteredHaikus.length) {
            selectedIndex = rightIndex;
            scrollToSelected();
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          const leftIndex = selectedIndex - 1;
          if (leftIndex >= 0) {
            selectedIndex = leftIndex;
            scrollToSelected();
          }
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < filteredHaikus.length) {
            event.preventDefault();
            const haiku = filteredHaikus[selectedIndex];
            if (event.ctrlKey || event.metaKey) {
              // Ctrl/Cmd + Enter: toggle selection
              handleHaikuClick(event, haiku, selectedIndex);
            } else {
              // Normal Enter: open viewer
              viewHaiku(haiku);
            }
          }
          break;
        case 'a':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            selectAll();
          }
          break;
        case 'Escape':
          if (selectedHaikus.size > 0) {
            event.preventDefault();
            clearSelection();
          }
          break;
      }
    }
  }
  
  // Scroll to selected haiku
  function scrollToSelected() {
    if (selectedIndex >= 0 && haikuCards[selectedIndex]) {
      haikuCards[selectedIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }


  // Clear all filters
  function clearAllFilters() {
    filterStatus = '';
    filterTags = [];
    searchQuery = '';
  }

  // Reset selection when filtered results change
  $: if (filteredHaikus.length > 0) {
    if (selectedIndex >= filteredHaikus.length) {
      selectedIndex = filteredHaikus.length - 1;
    }
    // Clear multi-select when results change significantly
    if (selectedHaikus.size > 0) {
      const validSelections = Array.from(selectedHaikus).filter(id => 
        filteredHaikus.some(haiku => haiku.id === id)
      );
      if (validSelections.length === 0) {
        clearSelection();
      }
    }
  } else {
    selectedIndex = -1;
  }
  
  // Focus search when component opens
  $: if (isOpen) {
    setTimeout(() => {
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  // Add event listeners
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClickOutside, true);
    };
  });
</script>

{#if isOpen}
  <div class="grid-view-overlay" on:click={closeGridView}>
    <div class="grid-view-modal" on:click|stopPropagation>
      <!-- Header -->
      <div class="grid-view-header">
        <!-- Desktop Header -->
        <div class="desktop-header">
          <div class="grid-view-title">
            <Search class="search-icon" size="20" />
            <h2>Browse Haikus</h2>
            <span class="haiku-count">{filteredHaikus.length} of {haikus.length}</span>
          </div>
          
          <!-- Search Input -->
          <div class="header-search-section">
            <div class="header-search-container">
              <input
                type="text"
                class="header-search-input"
                placeholder="Search haikus by title, content, or tags..."
                bind:value={searchQuery}
                bind:this={searchInput}
              />
              {#if searchQuery}
                <button class="search-clear" on:click={() => searchQuery = ''} title="Clear search">
                  <X size="16" />
                </button>
              {/if}
            </div>
          </div>
          
          <div class="grid-view-actions">
            <button class="close-button" on:click={closeGridView}>
              <X size="20" />
            </button>
          </div>
        </div>

        <!-- Mobile Header -->
        <div class="mobile-header">
          <!-- Top row: Back button, Search input -->
          <div class="mobile-header-top">
            <button class="mobile-back-button" on:click={closeGridView} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
            </button>
            
            <div class="mobile-search-container">
              <input
                type="text"
                class="mobile-search-input"
                placeholder="Search haikus..."
                bind:value={searchQuery}
                bind:this={searchInput}
              />
              {#if searchQuery}
                <button class="mobile-search-clear" on:click={() => searchQuery = ''} title="Clear search">
                  <X size="16" />
                </button>
              {/if}
            </div>
          </div>
          
           <!-- Bottom row: Compact filter dropdowns -->
          <div class="mobile-filters-row">
             {#if $settingsStore.enableTaskTracking}
               <div class="mobile-status-dropdown" bind:this={mobileStatusDropdownElement}>
                 <button 
                   class="mobile-filter-button mobile-status-button" 
                   class:active={filterStatus !== ''}
                   on:click={() => showMobileStatusSelector = !showMobileStatusSelector}
                   title="Filter by status"
                 >
                   {filterStatus ? getStatusText(filterStatus) : 'Status'}
                   <ChevronDown size="12" class={showMobileStatusSelector ? 'rotated' : ''} />
                 </button>
                 
                 {#if showMobileStatusSelector}
                   <div class="mobile-status-dropdown-menu" on:click={handleMobileStatusClick}>
                     <button 
                       class="mobile-status-option" 
                       class:active={filterStatus === ''}
                       on:click={() => { filterStatus = ''; showMobileStatusSelector = false; }}
                     >
                       All Status
                     </button>
                     <button 
                       class="mobile-status-option" 
                       class:active={filterStatus === 'todo'}
                       on:click={() => { filterStatus = 'todo'; showMobileStatusSelector = false; }}
                     >
                       <div class="status-indicator" style="background-color: {getStatusColor('todo')};"></div>
              Todo
            </button>
                     <button 
                       class="mobile-status-option" 
                       class:active={filterStatus === 'in_progress'}
                       on:click={() => { filterStatus = 'in_progress'; showMobileStatusSelector = false; }}
                     >
                       <div class="status-indicator" style="background-color: {getStatusColor('in_progress')};"></div>
              In Progress
            </button>
                     <button 
                       class="mobile-status-option" 
                       class:active={filterStatus === 'done'}
                       on:click={() => { filterStatus = 'done'; showMobileStatusSelector = false; }}
                     >
                       <div class="status-indicator" style="background-color: {getStatusColor('done')};"></div>
              Done
            </button>
                   </div>
                 {/if}
               </div>
             {/if}
             
             <div class="mobile-tags-container">
               <TagMultiSelect
                 availableTags={availableTags}
                 bind:selectedTags={filterTags}
                 placeholder="Filter by tags..."
                 on:change={() => {}}
                 compact={false}
               />
             </div>
             
             <div class="mobile-sort-dropdown" bind:this={sortDropdownElement}>
               <div class="hybrid-sort-control mobile-hybrid-sort">
                 <!-- Sort Field Dropdown -->
                 <button 
                   class="sort-field-button mobile-sort-field" 
                   on:click={() => sortDropdownOpen = !sortDropdownOpen}
                 >
                   <span>{getSortText(sortBy)}</span>
                   <ChevronDown size="12" class={sortDropdownOpen ? 'rotated' : ''} />
                 </button>
                 
                 <!-- Divider Line -->
                 <div class="sort-divider mobile-sort-divider"></div>
                 
                 <!-- Sort Order Toggle -->
                 <button 
                   class="sort-order-button mobile-sort-order" 
                   on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                   title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                 >
                   {#if sortOrder === 'asc'}
                     <SortAsc size="12" />
                   {:else}
                     <SortDesc size="12" />
                   {/if}
                 </button>
                 
                 {#if sortDropdownOpen}
                   <div class="sort-dropdown-menu" on:click={handleSortDropdownClick}>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'updatedAt'}
                       on:click={() => { sortBy = 'updatedAt'; sortDropdownOpen = false; }}
                     >
                       <span>Updated</span>
                       {#if sortBy === 'updatedAt'}<Check size="12" />{/if}
                     </button>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'createdAt'}
                       on:click={() => { sortBy = 'createdAt'; sortDropdownOpen = false; }}
                     >
                       <span>Created</span>
                       {#if sortBy === 'createdAt'}<Check size="12" />{/if}
                     </button>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'title'}
                       on:click={() => { sortBy = 'title'; sortDropdownOpen = false; }}
                     >
                       <span>Title</span>
                       {#if sortBy === 'title'}<Check size="12" />{/if}
                     </button>
                   </div>
                 {/if}
               </div>
             </div>
            <button class="mobile-clear-button" on:click={clearAllFilters} title="Clear all filters">
              Clear
            </button>
          </div>
        </div>
      </div>
      

      
      <!-- Filters -->
        <div class="filters-section">
          {#if selectedHaikus.size > 0}
            <!-- Multi-select actions -->
            <div class="multi-select-actions">
              <span class="selected-count">{selectedHaikus.size} selected</span>
              <button class="action-button" on:click={selectAll} title="Select All (Ctrl+A)">
                Select All
              </button>
              {#if $settingsStore.enableTaskTracking}
                <button class="action-button" on:click={markSelectedAsDone} title="Mark as Done">
                  Mark Done
                </button>
              {/if}
              <button class="action-button danger" on:click={deleteSelected} title="Delete Selected">
                Delete
              </button>
              <button class="action-button" on:click={clearSelection} title="Clear Selection (ESC)">
                Clear
              </button>
            </div>
        {:else}
          <!-- Compact filter toolbar -->
          <div class="filter-toolbar">
            {#if $settingsStore.enableTaskTracking}
              <div class="filter-toolbar-group">
                <div class="status-dropdown" bind:this={statusDropdownElement}>
                  <button 
                    class="status-button compact" 
                    on:click={() => statusDropdownOpen = !statusDropdownOpen}
                    style="border-color: {getStatusColor(filterStatus)}; color: {getStatusColor(filterStatus)}"
                  >
                    <span>{filterStatus ? getStatusText(filterStatus) : 'All Statuses'}</span>
                    <ChevronDown size="14" class={statusDropdownOpen ? 'rotated' : ''} />
                  </button>
                  
                  {#if statusDropdownOpen}
                    <div class="status-dropdown-menu" on:click={handleStatusDropdownClick}>
                      <button 
                        class="status-option" 
                        class:active={filterStatus === ''}
                        on:click={() => { filterStatus = ''; statusDropdownOpen = false; }}
                      >
                        <span>All Statuses</span>
                        {#if filterStatus === ''}<Check size="14" />{/if}
                      </button>
                      <button 
                        class="status-option" 
                        class:active={filterStatus === 'todo'}
                        on:click={() => { filterStatus = 'todo'; statusDropdownOpen = false; }}
                      >
                        <div class="status-indicator" style="background-color: #fbbf24;"></div>
                        <span>To Do</span>
                        {#if filterStatus === 'todo'}<Check size="14" />{/if}
                      </button>
                      <button 
                        class="status-option" 
                        class:active={filterStatus === 'in_progress'}
                        on:click={() => { filterStatus = 'in_progress'; statusDropdownOpen = false; }}
                      >
                        <div class="status-indicator" style="background-color: #3b82f6;"></div>
                        <span>In Progress</span>
                        {#if filterStatus === 'in_progress'}<Check size="14" />{/if}
                      </button>
                      <button 
                        class="status-option" 
                        class:active={filterStatus === 'done'}
                        on:click={() => { filterStatus = 'done'; statusDropdownOpen = false; }}
                      >
                        <div class="status-indicator" style="background-color: #10b981;"></div>
                        <span>Done</span>
                        {#if filterStatus === 'done'}<Check size="14" />{/if}
                      </button>
              </div>
                  {/if}
            </div>
                </div>
            {/if}
            
            <div class="filter-toolbar-group">
              <div class="hybrid-sort-control" bind:this={sortDropdownElement}>
                <!-- Sort Field Dropdown -->
                <button 
                  class="sort-field-button" 
                  on:click={() => sortDropdownOpen = !sortDropdownOpen}
                >
                  <span>{getSortText(sortBy)}</span>
                  <ChevronDown size="14" class={sortDropdownOpen ? 'rotated' : ''} />
                </button>
                
                <!-- Divider Line -->
                <div class="sort-divider"></div>
                
                <!-- Sort Order Toggle -->
                <button 
                  class="sort-order-button" 
                  on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {#if sortOrder === 'asc'}
                    <SortAsc size="14" />
                  {:else}
                    <SortDesc size="14" />
                  {/if}
                </button>
                
                 {#if sortDropdownOpen}
                   <div class="sort-dropdown-menu" on:click={handleSortDropdownClick}>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'updatedAt'}
                       on:click={() => { sortBy = 'updatedAt'; sortDropdownOpen = false; }}
                     >
                       <span>Updated</span>
                       {#if sortBy === 'updatedAt'}<Check size="14" />{/if}
                     </button>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'createdAt'}
                       on:click={() => { sortBy = 'createdAt'; sortDropdownOpen = false; }}
                     >
                       <span>Created</span>
                       {#if sortBy === 'createdAt'}<Check size="14" />{/if}
                     </button>
                     <button 
                       class="sort-option" 
                       class:active={sortBy === 'title'}
                       on:click={() => { sortBy = 'title'; sortDropdownOpen = false; }}
                     >
                       <span>Title</span>
                       {#if sortBy === 'title'}<Check size="14" />{/if}
                     </button>
                   </div>
                 {/if}
              </div>
          </div>
          
             <div class="filter-toolbar-group">
                 <TagMultiSelect
                   availableTags={availableTags}
                   bind:selectedTags={filterTags}
                 placeholder="Tags..."
                   on:change={() => dismissMultiSelect()}
                 compact={false}
                 />
               </div>
            
            {#if filterStatus || filterTags.length > 0 || searchQuery}
              <div class="filter-toolbar-group">
                <button class="clear-filters compact" on:click={clearFilters}>
                  Clear
                </button>
            </div>
          {/if}
        </div>
      {/if}
      </div>
      
      <!-- Grid Content -->
      <div class="grid-view-content">
        {#if filteredHaikus.length === 0}
          <div class="empty-state">
            {#if haikus.length === 0}
              <div class="empty-icon">📝</div>
              <h3>No haikus yet</h3>
              <div class="empty-state-content">
                <p class="desktop-only">Start writing haikus to see them here</p>
                <div class="keyboard-shortcuts desktop-only">
                <ul>
                  <li><strong>Quick search:</strong> <kbd><strong>Ctrl</strong></kbd> + <kbd><strong>K</strong></kbd></li>
                  <li><strong>Navigate:</strong> Arrow keys, <kbd><strong>Enter</strong></kbd> to open, <kbd><strong>ESC</strong></kbd> to close</li>
                  <li><strong>Multi-select:</strong> <kbd><strong>Ctrl</strong></kbd>/<kbd><strong>Shift</strong></kbd> + click</li>
                </ul>
                </div>
                <p class="mobile-only">Start writing haikus to see them here</p>
              </div>
            {:else}
              <div class="empty-icon">🔍</div>
              <h3>No matching haikus</h3>
              <p>Try adjusting your filters or search terms</p>
            {/if}
          </div>
        {:else}
          <div class="haiku-grid">
             {#each filteredHaikus as haiku, index}
               <div
                 class="haiku-card"
                 class:selected={selectedIndex === index}
                 class:multi-selected={selectedHaikus.has(haiku.id)}
                 bind:this={haikuCards[index]}
                 on:click={(e) => handleHaikuClick(e, haiku, index)}
                 on:keydown={(e) => e.key === 'Enter' && handleHaikuClick(e, haiku, index)}
                 tabindex="0"
                 role="button"
               >
                <!-- Card Header -->
                <div class="haiku-card-header">
                  <div class="haiku-title-section">
                     <h3 class="haiku-title">{haiku.title}</h3>
                   </div>
                   
                    {#if $settingsStore.enableTaskTracking}
                      <button
                       class="task-checkbox"
                        class:done={haiku.status === 'done'}
                       on:click|stopPropagation={() => toggleHaikuStatus(haiku)}
                       title={haiku.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                      >
                        {#if haiku.status === 'done'}
                          <Check size="14" />
                        {/if}
                      </button>
                    {/if}
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
                          <span class="haiku-tag" style="background-color: {getTagColor(tag)}20; border-color: {getTagColor(tag)}40; color: {getTagColor(tag)};">{tag}</span>
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
  
  <!-- Haiku Viewer -->
  <HaikuViewer 
    haiku={selectedHaiku} 
    isOpen={viewerOpen} 
    on:close={closeViewer}
    on:edit={handleViewerEdit}
    on:haikuUpdated={() => dispatch('haikuUpdated')}
  />

  <!-- Confirmation Dialog -->
  <ConfirmationDialog
    bind:isOpen={showDeleteConfirmation}
    title="Delete Haikus"
    message='Are you sure you want to delete {selectedHaikus.size} haiku{selectedHaikus.size === 1 ? "" : "s"}? This action cannot be undone.'
    confirmText="Delete"
    cancelText="Cancel"
    type="danger"
    on:confirm={confirmDelete}
    on:cancel={cancelDelete}
  />
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
    backdrop-filter: blur(10px);
  }

  .grid-view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    gap: 16px;
  }

  .grid-view-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .grid-view-title h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
  }

  .haiku-count {
    font-size: 14px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .header-search-section {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .header-search-container {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }

  .header-search-input {
    width: 100%;
    padding: 12px 32px 12px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    outline: none;
    font-size: 14px;
    transition: all 0.2s ease;
    color: var(--text-primary);
  }

  .header-search-input:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--border-focus) 15%, transparent);
  }

  .header-search-input::placeholder {
    color: var(--text-tertiary);
  }

  .grid-view-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
    flex-shrink: 0;
  }

  .close-button {
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--bg-tertiary);
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  /* Prominent Search Section */
  .prominent-search-section {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .search-container {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: var(--text-secondary);
    pointer-events: none;
  }

  .prominent-search-input {
    width: 100%;
    padding: 16px 50px 16px 48px;
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    outline: none;
    font-size: 16px;
    transition: all 0.2s ease;
    color: var(--text-primary);
  }

  .prominent-search-input:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-focus) 15%, transparent);
  }

  .prominent-search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-clear:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }


  .search-empty-header {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    margin-bottom: 8px;
  }
  
  .search-empty-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  
  .keyboard-shortcuts {
    margin-top: 20px;
    text-align: left;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .keyboard-shortcuts ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .keyboard-shortcuts li {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    position: relative;
    padding-left: 16px;
  }
  
  .keyboard-shortcuts li:last-child {
    margin-bottom: 0;
  }
  
  .keyboard-shortcuts li::before {
    content: "•";
    color: var(--text-tertiary);
    position: absolute;
    left: 0;
  }
  
  .keyboard-shortcuts kbd {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 2px 5px;
    font-size: 10px;
    margin: 0 1px;
    font-weight: 600;
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
    color: var(--text-primary);
  }

  .haiku-count {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .grid-view-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    background: var(--bg-secondary);
    border-color: var(--border-focus);
    color: var(--text-primary);
  }

  
  .multi-select-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-focus);
    border-radius: 6px;
  }
  
  .selected-count {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .action-button {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-button:hover {
    border-color: var(--border-focus);
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .action-button.danger {
    color: #ef4444;
    border-color: #ef4444;
  }
  
  .action-button.danger:hover {
    background: #ef4444;
    color: white;
  }

  .filters-section {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .filter-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .filter-toolbar-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Hybrid Sort Control */
  .hybrid-sort-control {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: visible;
    min-width: 140px;
  }

  .sort-field-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .sort-field-button:hover {
    background: var(--bg-secondary);
  }

  .sort-divider {
    width: 1px;
    height: 24px;
    background: var(--border-color);
    flex-shrink: 0;
  }

  .hybrid-sort-control .sort-order-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .hybrid-sort-control .sort-order-button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .filter-select.compact {
    padding: 6px 8px;
    font-size: 13px;
    min-width: 100px;
  }

  .sort-order-button.compact {
    padding: 6px;
    min-width: auto;
  }

  .clear-filters.compact {
    padding: 6px 12px;
    font-size: 13px;
  }

  /* Custom Dropdown Styles */
  .status-dropdown,
  .sort-dropdown {
    position: relative;
    min-width: 100px;
  }

  .status-button,
  .sort-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    font-weight: 500;
    min-width: 100px;
    justify-content: space-between;
  }

  .status-button.compact,
  .sort-button.compact {
    padding: 6px 8px;
    font-size: 13px;
    min-width: 100px;
  }

  .status-button:hover,
  .sort-button:hover {
    background: var(--bg-secondary);
  }

  .status-dropdown-menu,
  .sort-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 140px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 8px 24px var(--card-shadow);
    z-index: 10;
    margin-top: 4px;
  }

  .status-option,
  .sort-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
  }

  .status-option:hover,
  .sort-option:hover {
    background: var(--bg-secondary);
  }

  .status-option.active,
  .sort-option.active {
    background: var(--bg-tertiary);
  }

  .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .rotated {
    transform: rotate(180deg);
  }

  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  .empty-state-content {
    text-align: center;
  }

  .filter-row {
    display: flex;
    align-items: end;
    gap: 16px;
    margin-bottom: 12px;
    flex-wrap: wrap;
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
    color: var(--text-secondary);
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
    background: var(--text-secondary);
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
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--border-focus) 15%, transparent);
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
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-order-button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .tag-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-filter {
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
  }

  .tag-filter:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .tag-filter.active {
    background: var(--border-focus);
    border-color: var(--border-focus);
    color: white;
  }

  .clear-filters {
    padding: 6px 12px;
    background: #dc2626;
    border: 1px solid #dc2626;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
  }

  .clear-filters:hover {
    background: #b91c1c;
    border-color: #b91c1c;
    color: white;
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
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .haiku-grid {
    display: grid;
     grid-template-columns: repeat(auto-fit, 400px);
    gap: 20px;
     justify-content: center;
  }

  .haiku-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
    position: relative;
    cursor: pointer;
    user-select: none; /* Prevent text selection during multi-select */
  }

  .haiku-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--card-shadow);
    border-color: var(--border-focus);
  }
  
  .haiku-card:focus {
    outline: none;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--card-shadow);
    border-color: var(--border-focus);
  }
  
  .haiku-card.selected {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--border-focus) 20%, transparent);
    transform: translateY(-1px);
  }
  
  .haiku-card.selected:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--card-shadow), 0 0 0 2px color-mix(in srgb, var(--border-focus) 20%, transparent);
  }
  
  .haiku-card.multi-selected {
    border-color: var(--border-focus);
    background: var(--bg-tertiary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    transform: translateY(-1px);
  }
  
  .haiku-card.multi-selected:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--card-shadow), 0 0 0 2px rgba(59, 130, 246, 0.4);
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

  .task-checkbox {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: transparent;
  }
  
  .task-checkbox:hover {
    border-color: var(--border-focus);
    background: var(--bg-secondary);
  }
  
  .task-checkbox.done {
    border-color: #10b981;
    background: #10b981;
    color: white;
  }

  .task-checkbox.done:hover {
    background: #059669;
  }


  .haiku-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }


  .haiku-content {
    padding: 16px;
    text-align: center;
  }

  .haiku-line {
    color: var(--text-primary);
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
    border-radius: 4px;
    border: 1px solid;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
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
    color: var(--text-tertiary);
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

   /* Tablet Responsiveness (480px - 768px) */
   @media (max-width: 768px) and (min-width: 481px) {
     /* Tablet-specific styles for tags dropdown */
     .mobile-tags-container :global(.tag-multiselect) {
       min-width: 140px;
       max-width: 180px;
     }

     .mobile-tags-container :global(.tag-multiselect .selected-tags-container) {
       min-height: 32px;
       padding: 6px 8px;
       font-size: 12px;
     }

     /* Ensure dropdown menu can be wider than button */
     .mobile-tags-container :global(.tag-multiselect .tag-dropdown-menu) {
       min-width: 200px;
       max-width: 300px;
     }
    .grid-view-overlay {
      padding: 10px;
    }

    .grid-view-modal {
      max-height: 95vh;
    }

    .grid-view-header {
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
      gap: 12px;
    }

    .grid-view-title {
      justify-content: space-between;
      gap: 8px;
    }

    .grid-view-title h2 {
      font-size: 18px;
      flex: 1;
    }

    .haiku-count {
      font-size: 12px;
      padding: 3px 6px;
      flex-shrink: 0;
    }

    .header-search-section {
      gap: 8px;
    }

    .header-search-container {
      min-width: 0;
      flex: 1;
    }

    .header-search-input {
      font-size: 16px; /* Prevent zoom on iOS */
      padding: 10px 35px 10px 10px;
    }


    .grid-view-actions {
      margin-left: 0;
      justify-content: flex-end;
    }

    .close-button {
      width: 28px;
      height: 28px;
      padding: 0;
    }

    .close-button :global(svg) {
      width: 16px;
      height: 16px;
    }

    /* Mobile grid adjustments */
    .haiku-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 12px;
      max-width: 400px;
      margin: 0 auto;
    }

    .haiku-card {
      padding: 12px;
    }

    .haiku-card-header {
      gap: 8px;
      margin-bottom: 8px;
    }

    .haiku-title {
      font-size: 14px;
    }

    .haiku-content {
      margin-bottom: 8px;
    }

    .haiku-line {
      font-size: 13px;
      line-height: 1.4;
    }

    .haiku-card-footer {
      padding: 8px 0 0 0;
      gap: 8px;
    }

    .haiku-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .haiku-tags {
      gap: 3px;
    }

    .haiku-tag {
      font-size: 10px;
      padding: 2px 4px;
    }

    .haiku-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .haiku-date {
      font-size: 11px;
    }

    .haiku-status {
      font-size: 9px;
      padding: 2px 4px;
    }

    /* Mobile filters */
    .filters-section {
      padding: 12px;
    }

    .filter-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .filter-group {
      width: 100%;
    }

    .filter-label {
      font-size: 12px;
      margin-bottom: 4px;
    }

    .filter-select {
      width: 100%;
      font-size: 14px;
      padding: 8px 12px;
    }

    .sort-controls {
      flex-direction: column;
      gap: 6px;
    }

    .sort-toggle {
      font-size: 12px;
      padding: 6px 10px;
    }

    .clear-filters {
      font-size: 12px;
      padding: 6px 12px;
    }

    /* Mobile multi-select actions */
    .multi-select-actions {
      padding: 8px;
      margin-bottom: 8px;
    }

    .selected-count {
      font-size: 12px;
    }

    .action-button {
      font-size: 12px;
      padding: 6px 10px;
    }

    /* Mobile keyboard shortcuts */
    .keyboard-shortcuts {
      max-width: 100%;
      margin-top: 12px;
    }

    .keyboard-shortcuts li {
      font-size: 12px;
      margin-bottom: 6px;
    }

    .keyboard-shortcuts kbd {
      font-size: 9px;
      padding: 1px 3px;
    }
  }

  @media (max-width: 480px) {
    .grid-view-header {
      padding: 12px;
      gap: 10px;
    }

    .grid-view-title h2 {
      font-size: 16px;
    }

    .header-search-section {
      flex-direction: column;
      gap: 8px;
      align-items: stretch;
    }

    .header-search-container {
      min-width: auto;
    }


    /* Hide search icon on very small screens to save space */
    .search-icon {
      display: none;
    }

    /* Mobile responsive for empty state */
    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: block;
    }
  }

  /* Desktop Header */
  .desktop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 16px;
  }

  /* Mobile Header */
  .mobile-header {
    display: none;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mobile-header-top {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .mobile-back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mobile-back-button:hover {
    background: var(--bg-secondary);
    border-color: var(--border-focus);
  }

  .mobile-search-container {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .mobile-search-input {
    width: 100%;
    padding: 10px 35px 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 16px; /* Prevent zoom on iOS */
    transition: all 0.2s ease;
  }

  .mobile-search-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .mobile-search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-search-clear:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }

  .mobile-mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mobile-mode-toggle:hover {
    background: var(--bg-secondary);
    border-color: var(--border-focus);
  }

  .mobile-mode-toggle.active {
    background: var(--border-focus);
    border-color: var(--border-focus);
    color: white;
  }

  .mobile-filters-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    width: 100%;
  }

  .mobile-filter-button {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .mobile-filter-button:hover {
    background: var(--bg-secondary);
    border-color: var(--border-focus);
  }

  .mobile-filter-button.active {
    background: var(--border-focus);
    border-color: var(--border-focus);
    color: white;
  }


   /* Mobile Hybrid Sort Control */
   .mobile-hybrid-sort {
     min-width: 120px;
   }

   .mobile-sort-field {
     font-size: 12px;
     padding: 6px 8px;
   }

   .mobile-sort-divider {
     height: 20px;
   }

   .mobile-sort-order {
     padding: 6px;
   }

   .mobile-sort-dropdown {
     position: relative;
   }

   /* Mobile Tags Container */
   .mobile-tags-container {
     flex: 1;
     min-width: 0;
   }

  .mobile-clear-button {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .mobile-clear-button:hover {
    background: var(--bg-secondary);
    border-color: var(--border-focus);
  }

   /* Mobile Dropdowns */
   .mobile-status-dropdown {
     position: relative;
   }

   .mobile-status-button {
     display: flex;
     align-items: center;
     gap: 4px;
   }

   .mobile-status-dropdown-menu {
     position: absolute;
     top: 100%;
     left: 0;
     right: 0;
     background: var(--bg-primary);
     border: 1px solid var(--border-color);
     border-radius: 8px;
     box-shadow: 0 8px 24px var(--card-shadow);
     z-index: 1000;
     margin-top: 4px;
     padding: 8px;
     min-width: 200px;
   }

   .mobile-status-option {
     width: 100%;
     display: flex;
     align-items: center;
     gap: 8px;
     padding: 8px 12px;
     border: none;
     background: none;
     color: var(--text-primary);
     cursor: pointer;
     border-radius: 6px;
     transition: all 0.2s ease;
     text-align: left;
     font-size: 14px;
   }

   .mobile-status-option:hover {
     background: var(--bg-secondary);
   }

   .mobile-status-option.active {
     background: var(--border-focus);
     color: white;
   }

   .mobile-status-option .status-indicator {
     width: 8px;
     height: 8px;
     border-radius: 50%;
     flex-shrink: 0;
   }

  /* Mobile Responsiveness (480px and below) */
  @media (max-width: 480px) {
    .grid-view-overlay {
      padding: 10px;
    }

    .grid-view-modal {
      max-height: 95vh;
    }

    .grid-view-header {
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
      gap: 12px;
    }

    .grid-view-title {
      justify-content: space-between;
      gap: 8px;
    }

    .grid-view-title h2 {
      font-size: 18px;
      flex: 1;
    }

    .haiku-count {
      font-size: 12px;
      padding: 3px 6px;
      flex-shrink: 0;
    }

    .header-search-section {
      gap: 8px;
    }

    .header-search-container {
      min-width: 0;
      flex: 1;
    }

    .header-search-input {
      font-size: 16px; /* Prevent zoom on iOS */
      padding: 10px 35px 10px 10px;
    }

    .grid-view-actions {
      margin-left: 0;
      justify-content: flex-end;
    }

    .close-button {
      width: 28px;
      height: 28px;
      padding: 0;
    }

    .close-button :global(svg) {
      width: 16px;
      height: 16px;
    }

    /* Mobile grid adjustments */
    .haiku-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 12px;
      max-width: 400px;
      margin: 0 auto;
    }

    .haiku-card {
      padding: 12px;
    }

    .haiku-card-header {
      gap: 8px;
      margin-bottom: 8px;
    }

    .haiku-title {
      font-size: 14px;
    }

    .haiku-content {
      margin-bottom: 8px;
    }

    .haiku-line {
      font-size: 13px;
      line-height: 1.4;
    }

    .haiku-card-footer {
      padding: 8px 0 0 0;
      gap: 8px;
    }

    .haiku-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .haiku-tags {
      gap: 3px;
    }

    .haiku-tag {
      font-size: 10px;
      padding: 2px 4px;
    }

    .haiku-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .haiku-date {
      font-size: 11px;
    }

    .haiku-status {
      font-size: 9px;
      padding: 2px 4px;
    }

    /* Mobile filters */
    .filters-section {
      padding: 12px;
    }

    .filter-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .filter-group {
      width: 100%;
    }

    .filter-label {
      font-size: 12px;
      margin-bottom: 4px;
    }

    .filter-select {
      width: 100%;
      font-size: 14px;
      padding: 8px 12px;
    }

    .sort-controls {
      flex-direction: column;
      gap: 6px;
    }

    .sort-toggle {
      font-size: 12px;
      padding: 6px 10px;
    }

    .clear-filters {
      font-size: 12px;
      padding: 6px 12px;
    }

    /* Mobile multi-select actions */
    .multi-select-actions {
      padding: 8px;
      margin-bottom: 8px;
    }

    .selected-count {
      font-size: 12px;
    }

    .action-button {
      font-size: 12px;
      padding: 6px 10px;
    }

    /* Mobile keyboard shortcuts */
    .keyboard-shortcuts {
      max-width: 100%;
      margin-top: 12px;
    }

    .keyboard-shortcuts li {
      font-size: 12px;
      margin-bottom: 6px;
    }

    .keyboard-shortcuts kbd {
      font-size: 9px;
      padding: 1px 3px;
    }
  }

    /* Hide desktop header on mobile */
  @media (max-width: 768px) {
    .desktop-header {
      display: none;
    }

    /* Show mobile header on mobile */
    .mobile-header {
      display: flex;
    }

    /* Hide desktop filters on mobile */
    .filters-section {
      display: none;
    }
  }

   @media (max-width: 480px) {
     .mobile-filters-row {
       gap: 4px;
     }

     .mobile-filter-button {
       padding: 4px 8px;
       font-size: 11px;
     }

     .mobile-clear-button {
       padding: 4px 8px;
       font-size: 11px;
     }

     /* Compact variants for <480px */
     .mobile-hybrid-sort {
       min-width: 100px;
     }

     .mobile-sort-field {
       font-size: 11px;
       padding: 4px 6px;
     }

     .mobile-sort-divider {
       height: 18px;
     }

     .mobile-sort-order {
       padding: 4px;
     }

     .mobile-sort-order :global(svg) {
       width: 10px;
       height: 10px;
     }

     .mobile-tags-container {
       min-width: 120px;
     }

     .mobile-tags-container :global(.tag-multiselect) {
       min-width: 120px;
     }

     .mobile-tags-container :global(.tag-multiselect .selected-tags-container) {
       min-height: 28px;
       padding: 4px 6px;
       font-size: 11px;
     }
   }

</style>
