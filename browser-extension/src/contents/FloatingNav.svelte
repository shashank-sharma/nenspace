<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { slide } from "svelte/transition"
  import { quintOut } from "svelte/easing"
  import {
    authStorage,
    settingsStorage,
    watchStorage
  } from "../lib/services/plasmo-storage.service"
  import { modalStore } from "../lib/stores/modal.store"
  import { applyThemeToElement } from "../lib/config/themes"
  import { setupGlobalErrorHandlers } from "../lib/utils/error-boundary.util"

  let isHovered = false
  let isExpanded = false
  let isAuthChecked = false
  let isUserAuthenticated = false
  let mouseLeaveTimeout: number | null = null
  let rootElement: HTMLElement | null = null

  // Storage watchers for reactive updates
  let unwatchAuth: (() => void) | null = null
  let unwatchTheme: (() => void) | null = null

  // Get theme container element (within shadow DOM, isolated from page)
  function getThemeContainer(): HTMLElement | null {
    // Try to get shadow host created by Plasmo, then get its root element
    const shadowHost = document.getElementById('nenspace-floating-nav')
    if (shadowHost?.shadowRoot) {
      // Apply to the root element within shadow DOM
      return shadowHost.shadowRoot.querySelector('.floating-nav-wrapper') as HTMLElement || 
             shadowHost.shadowRoot.firstElementChild as HTMLElement
    }
    // Fallback to component root element
    return rootElement
  }

  function applyTheme(theme: string) {
    const container = getThemeContainer()
    if (container) {
      applyThemeToElement(container, theme)
    }
  }

  onMount(async () => {
    // Setup global error handlers
    setupGlobalErrorHandlers()

    // Initial load - apply theme only to shadow container, not document root
    const themeResult = await settingsStorage.getTheme()
    const theme = themeResult.success ? themeResult.data : 'dark'
    applyTheme(theme)

    isUserAuthenticated = await authStorage.isAuthenticated()
    isAuthChecked = true

    // Set up reactive watchers using Plasmo storage
    unwatchAuth = watchStorage.watchAuth((auth) => {
      isUserAuthenticated =
        auth !== null && !!auth.primaryToken && !!auth.userId
    })

    unwatchTheme = watchStorage.watchTheme((theme) => {
      applyTheme(theme)
    })

    return () => {
      // Clean up watchers
      if (unwatchAuth) {
        unwatchAuth()
      }
      if (unwatchTheme) {
        unwatchTheme()
      }

      if (mouseLeaveTimeout !== null) {
        clearTimeout(mouseLeaveTimeout)
      }
    }
  })

  function handleQuickAdd() {
    // Open modal at center of screen (no position parameter)
    modalStore.openModal("bookmark")
    handleClose()
  }

  function handleOpenCommandPalette() {
    // Open command palette at center of screen (no position parameter)
    modalStore.toggleCommandPalette()
    handleClose()
  }

  function handleOpenHome() {
    // Open modal at center of screen (no position parameter)
    modalStore.openModal("home")
    handleClose()
  }

  function handleClose() {
    isExpanded = false
    isHovered = false
  }

  function handleCardMouseLeave() {
    // Debounce close to prevent accidental dismissal
    mouseLeaveTimeout = window.setTimeout(() => {
      isExpanded = false
      isHovered = false
    }, 200)
  }

  function handleCardMouseEnter() {
    // Cancel pending close if mouse returns
    if (mouseLeaveTimeout) {
      clearTimeout(mouseLeaveTimeout)
      mouseLeaveTimeout = null
    }
  }
</script>

{#if isAuthChecked}
  <div class="floating-nav-wrapper" bind:this={rootElement}>
    <!-- Hover trigger zone - hidden when card is visible -->
    {#if !isHovered && !isExpanded}
      <div
        class="trigger-zone"
        role="button"
        tabindex="0"
        on:mouseenter={() => (isHovered = true)}
        on:click={() => (isHovered = true)}
        on:keydown={(e) => e.key === "Enter" && (isHovered = true)} />
    {/if}

    <!-- Floating card -->
    {#if isHovered || isExpanded}
      <div
        class="card"
        class:expanded={isExpanded}
        role="dialog"
        aria-label="Quick navigation"
        on:mouseenter={handleCardMouseEnter}
        on:mouseleave={handleCardMouseLeave}
        transition:slide={{ duration: 300, easing: quintOut, axis: "y" }}>
        {#if !isExpanded}
          <!-- Hover state - minimal pill -->
          <button
            class="pill"
            on:click={() => (isExpanded = true)}
            aria-label="Expand navigation menu">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        {:else}
          <!-- Expanded state -->
          <div class="card-body">
            <button
              class="close-btn"
              on:click={handleClose}
              aria-label="Close navigation menu">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {#if !isUserAuthenticated}
              <!-- Not authenticated - show login -->
              <div class="auth-content">
                <p class="auth-text">Sign in to continue</p>
                <button class="btn-login" on:click={handleOpenHome}>
                  Sign In
                </button>
              </div>
            {:else}
              <!-- Authenticated - show navigation -->
              <div class="nav">
                <button class="btn btn-accent" on:click={() => handleQuickAdd()}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5">
                    <path
                      d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="10" y1="11" x2="14" y2="11" />
                  </svg>
                  <span>Quick Add</span>
                </button>

                <button class="btn" on:click={() => handleOpenCommandPalette()}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <span>Search</span>
                </button>

                <button class="btn" on:click={() => handleOpenHome()}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Home</span>
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/floating-nav-styles.util.ts
  Injected via: src/contents/floating-nav.tsx getStyle API
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See floating-nav-styles.util.ts */
</style>
