<script lang="ts">
  import { onMount } from 'svelte';
  import { createLogger } from '../utils/logger.util';

  const logger = createLogger('[ErrorBoundary]');

  export let fallback: string = 'An error occurred';
  export let onError: ((error: Error) => void) | null = null;

  let error: Error | null = null;
  let errorInfo: string | null = null;

  function handleError(event: ErrorEvent) {
    error = new Error(event.message);
    errorInfo = `Error: ${event.message}\nStack: ${event.error?.stack || 'No stack trace'}`;
    logger.error('Error boundary caught error', error);
    
    if (onError) {
      try {
        onError(error);
      } catch (e) {
        logger.error('Error in onError callback', e);
      }
    }
  }

  onMount(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', (event) => {
      error = new Error(event.reason?.message || 'Unhandled promise rejection');
      errorInfo = `Unhandled rejection: ${event.reason}`;
      logger.error('Error boundary caught unhandled rejection', error);
      
      if (onError) {
        try {
          onError(error);
        } catch (e) {
          logger.error('Error in onError callback', e);
        }
      }
    });

    return () => {
      window.removeEventListener('error', handleError);
    };
  });
</script>

{#if error}
  <div
    class="error-boundary-fallback"
    role="alert"
    aria-live="assertive"
    style="display: flex; align-items: center; justify-content: center; padding: 1rem; color: white; background: rgba(220, 38, 38, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 0.25rem; min-height: 40px;">
    <div style="font-size: 0.875rem;">
      <p style="font-weight: 500; margin: 0;">{fallback}</p>
      {#if errorInfo}
        <p style="font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.75;">{errorInfo}</p>
      {/if}
    </div>
  </div>
{:else}
  <slot />
{/if}

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getErrorBoundaryStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getErrorBoundaryStyles() */
</style>
