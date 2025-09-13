<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { Check, ChevronDown } from 'lucide-svelte';

  export let availableTags = [];
  export let selectedTags = [];
  export let placeholder = "Select tags...";
  export let maxHeight = "200px";

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let searchQuery = '';
  let dropdownElement;
  let searchInput;

  // Generate consistent color for tag based on its name
  function getTagColor(tagName) {
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
    
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash + tagName.charCodeAt(i)) & 0xffffffff;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  // Filter tags based on search query (show all tags, including selected ones)
  $: filteredTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle tag selection
  function toggleTag(tag) {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    
    selectedTags = newSelectedTags;
    dispatch('change', newSelectedTags);
  }


  // Toggle dropdown
  function toggleDropdown() {
    isOpen = !isOpen;
    if (isOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 0);
    }
  }

  // Close dropdown
  function closeDropdown() {
    isOpen = false;
    searchQuery = '';
  }

  // Handle click outside
  function handleClickOutside(event) {
    if (isOpen && dropdownElement && !dropdownElement.contains(event.target)) {
      closeDropdown();
    }
  }

  // Use capture phase to handle clicks before stopPropagation
  onMount(() => {
    document.addEventListener('click', handleClickOutside, true); // true = capture phase
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside, true);
  });


  // Prevent clicks inside dropdown from closing it
  function handleDropdownClick(event) {
    event.stopPropagation();
  }

  // Handle click on container to toggle dropdown
  function handleContainerClick(event) {
    event.stopPropagation();
    toggleDropdown();
  }

  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!isOpen) return;
    
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

  <div class="tag-multiselect" bind:this={dropdownElement}>
  <!-- Selected Tags Display -->
  <div class="selected-tags-container" on:click={handleContainerClick}>
    {#if selectedTags.length === 0}
      <span class="placeholder">{placeholder}</span>
    {:else}
      <div class="selected-tags-scroll">
        <div class="selected-tags">
          {#each selectedTags as tag}
            <div class="selected-tag" style="background-color: {getTagColor(tag)}20; border-color: {getTagColor(tag)}40;">
              <span class="tag-text" style="color: {getTagColor(tag)};">{tag}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <div class="dropdown-arrow" class:open={isOpen}>
      <ChevronDown size="16" />
    </div>
  </div>

  <!-- Dropdown -->
  {#if isOpen}
    <div class="dropdown-menu" on:click={handleDropdownClick}>
      <!-- Search Input -->
      <div class="search-container">
        <input
          type="text"
          bind:value={searchQuery}
          bind:this={searchInput}
          placeholder="Search tags..."
          class="search-input"
        />
      </div>

      <!-- Tag Options -->
      <div class="tag-options" style="max-height: {maxHeight};">
        {#if filteredTags.length === 0}
          <div class="no-tags">
            {#if searchQuery}
              <p>No tags match "{searchQuery}"</p>
            {:else}
              <p>All tags selected</p>
            {/if}
          </div>
        {:else}
          {#each filteredTags as tag}
            <button 
              class="tag-option"
              on:click={() => toggleTag(tag)}
              style="border-left-color: {getTagColor(tag)};"
            >
              <div class="tag-color-indicator" style="background-color: {getTagColor(tag)};"></div>
              <span class="tag-name">{tag}</span>
              {#if selectedTags.includes(tag)}
                <Check size="16" class="check-icon" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <!-- Clear All Button -->
      {#if selectedTags.length > 0}
        <div class="dropdown-footer">
          <button class="clear-all" on:click={() => { selectedTags = []; dispatch('change', []); }}>
            Clear All
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-multiselect {
    position: relative;
    width: 200px; /* Fixed width to match other dropdowns */
    min-width: 200px;
  }

  .selected-tags-container {
    min-height: 40px;
    max-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .selected-tags-container:hover {
    border-color: var(--border-focus);
  }

  .selected-tags-container:focus-within {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .placeholder {
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .selected-tags-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .selected-tags-scroll::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }

  .selected-tags {
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
    min-width: max-content;
  }

  .selected-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .selected-tag:hover {
    opacity: 0.8;
  }

  .tag-text {
    font-weight: 500;
  }

  .dropdown-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 1000;
    margin-top: 4px;
    overflow: hidden;
  }

  .search-container {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .search-input:focus {
    border-color: var(--border-focus);
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .tag-options {
    overflow-y: auto;
    max-height: 200px;
  }

  .tag-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border: none;
    background: none;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-left: 3px solid transparent;
    text-align: left;
  }

  .tag-option:hover {
    background: var(--bg-secondary);
  }

  .tag-color-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-name {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  }

  .check-icon {
    color: var(--border-focus);
    flex-shrink: 0;
  }

  .no-tags {
    padding: 16px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .dropdown-footer {
    padding: 8px 12px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .clear-all {
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .clear-all:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
</style>
