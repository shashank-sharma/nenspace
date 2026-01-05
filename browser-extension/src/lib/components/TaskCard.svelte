<script lang="ts">
  import IconCheck from "./icons/IconCheck.svelte"

  export let title: string
  export let deadline: string
  export let completed: boolean = false
  export let inProgress: boolean = false
  export let onToggle: (() => void) | undefined = undefined
  export let category: 'backend' | 'frontend' | 'default' = 'default'
</script>

<div 
  class="task-card" 
  class:completed
  class:in-progress={inProgress}
  on:click={onToggle}
  on:keydown={(e) => e.key === 'Enter' && onToggle?.()}
  role="button"
  tabindex="0"
>
  <div class="checkbox-container">
    {#if completed}
      <div class="checkbox checked">
        <IconCheck size={16} color="var(--nenspace-text-primary)" />
      </div>
    {:else}
      <div class="checkbox" />
    {/if}
  </div>
  
  <div class="content">
    <div class="deadline">{deadline}</div>
    <div class="task-title" class:completed-text={completed}>{title}</div>
  </div>
  
  {#if category !== 'default'}
    <div class="category-indicator" class:backend={category === 'backend'} class:frontend={category === 'frontend'} />
  {/if}
</div>

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getTaskCardStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getTaskCardStyles() */
</style>

