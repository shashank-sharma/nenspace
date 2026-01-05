<script lang="ts">
  import { onMount } from "svelte"
  import {
    authStorage,
    settingsStorage,
    profileStorage,
    devTokenStorage
  } from "../../lib/services/plasmo-storage.service"
  import { authFlowService } from "../../features/auth/services/auth-flow.service"
  import { validateUrl } from "../../lib/utils/validation.util"
  import { THEMES } from "../../lib/config/constants"
  import { applyThemeToElement } from "../../lib/config/themes"
  import type { StoredAuth } from "../../lib/types"
  import { createLogger } from "../../lib/utils/logger.util"

  const logger = createLogger("[Settings]")

  export let onBack: () => void
  export let onLogout: () => void
  export let onNavigateToShortcuts: () => void

  let authData: StoredAuth | null = null
  let currentTheme = THEMES.AUTO
  let backendUrl = ""
  let isSaving = false
  let saveMessage = ""
  let profileId: string | null = null

  // Version info
  const APP_VERSION = "0.0.1"
  const BUILD_ENV = "development"

  // Dev token state
  let devTokenInput = ""
  let tokenError = ""
  let isSavingToken = false
  let hasStoredToken = false

  onMount(async () => {
    const authResult = await authStorage.get()
    authData = authResult.success ? authResult.data : null
    if (authData) {
      backendUrl = authData.backendUrl
    }
    
    await loadStoredToken()
    const themeResult = await settingsStorage.getTheme()
    const theme = themeResult.success ? themeResult.data : THEMES.AUTO
    if (
      theme === THEMES.LIGHT ||
      theme === THEMES.DARK ||
      theme === THEMES.AUTO
    ) {
      currentTheme = theme as typeof THEMES.AUTO
    }

    applyTheme(currentTheme)
    const profileIdResult = await profileStorage.getProfileId()
    profileId = profileIdResult.success ? profileIdResult.data : null
  })

  async function loadStoredToken() {
    try {
      const storedTokenResult = await devTokenStorage.get()
      const storedToken = storedTokenResult.success ? storedTokenResult.data : null
      if (storedToken) {
        if (storedToken.includes('.')) {
          const parts = storedToken.split('.')
          if (parts.length === 2 && parts[0] && parts[1]) {
            devTokenInput = parts[1]
          } else {
            devTokenInput = storedToken
          }
        } else {
          devTokenInput = storedToken
        }
        hasStoredToken = true
        logger.info("Loaded stored dev token")
      } else {
        hasStoredToken = false
      }
    } catch (error) {
      logger.error("Failed to load stored token", error)
      hasStoredToken = false
    }
  }

  function validateTokenFormat(token: string): string | null {
    if (!token || !token.trim()) {
      return "Token cannot be empty"
    }
    
    if (token.includes(".")) {
      const parts = token.split(".")
      if (parts.length !== 2) {
        return 'Token cannot contain more than one "." separator'
      }
    }
    
    return null
  }

  function formatTokenWithUserId(token: string): string {
    if (token.includes(".")) {
      const parts = token.split(".")
      if (parts.length === 2 && parts[0] && parts[1]) {
        return token
      }
    }
    
    if (authData?.userId) {
      return `${authData.userId}.${token}`
    }
    
    return token
  }

  async function handleSaveToken() {
    tokenError = ""
    isSavingToken = true

    try {
      const trimmedToken = devTokenInput.trim()
      
      const validationError = validateTokenFormat(trimmedToken)
      if (validationError) {
        tokenError = validationError
        return
      }

      if (!authData?.userId) {
        tokenError = "User ID not found. Please ensure you are logged in."
        return
      }

      const formattedToken = formatTokenWithUserId(trimmedToken)
      
      logger.info("Saving dev token", {
        hasUserId: !!authData.userId,
        tokenLength: formattedToken.length,
        hasPrefix: formattedToken.includes('.')
      })

      await devTokenStorage.save(formattedToken)
      hasStoredToken = true
      
      logger.info("Dev token saved successfully")

      try {
        const { sendToBackground } = await import("@plasmohq/messaging")
        await sendToBackground({
          name: "dev-token-updated"
        })
        logger.info("Notified background script of token update")
      } catch (error) {
        logger.error("Failed to notify background script", error)
      }

      tokenError = ""
    } catch (error: any) {
      logger.error("Failed to save dev token", error)
      tokenError = error.message || "Failed to save token"
    } finally {
      isSavingToken = false
    }
  }

  async function handleClearToken() {
    if (!confirm("Are you sure you want to clear the dev token? This will disable sync functionality.")) {
      return
    }

    try {
      await devTokenStorage.clear()
      devTokenInput = ""
      hasStoredToken = false
      tokenError = ""

      try {
        const { sendToBackground } = await import("@plasmohq/messaging")
        await sendToBackground({
          name: "dev-token-updated"
        })
      } catch (error) {
        logger.error("Failed to notify background script", error)
      }

      logger.info("Dev token cleared")
    } catch (error) {
      logger.error("Failed to clear dev token", error)
      tokenError = "Failed to clear token"
    }
  }

  async function handleSaveSettings() {
    const urlError = validateUrl(backendUrl)
    if (urlError) {
      saveMessage = urlError
      return
    }

    isSaving = true
    saveMessage = ""

    try {
      await settingsStorage.saveBackendUrl(backendUrl)
      await settingsStorage.saveTheme(currentTheme)

      applyTheme(currentTheme)

      saveMessage = "Settings saved successfully!"
      setTimeout(() => {
        saveMessage = ""
      }, 3000)
    } catch (error) {
      saveMessage = "Failed to save settings"
    } finally {
      isSaving = false
    }
  }

  function applyTheme(theme: string) {
    let themeToApply = theme

    if (theme === THEMES.AUTO) {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        themeToApply = "modern-dark"
      } else {
        themeToApply = "light"
      }
    } else if (theme === THEMES.DARK) {
      themeToApply = "modern-dark"
    } else if (theme === THEMES.LIGHT) {
      themeToApply = "light"
    }

    applyThemeToElement(document.documentElement, themeToApply)
  }

  async function handleLogout() {
    try {
      try {
        await devTokenStorage.clear()
      } catch (clearError) {
        logger.error("Failed to clear dev token on logout", clearError)
      }

      await authFlowService.logout()
      onLogout()
    } catch (error) {
      logger.error("Logout failed", error)
    }
  }
</script>

<div class="max-w-[400px] mx-auto p-6">
  <!-- Header -->
  <div class="section-header">
    <button class="back-btn" on:click={onBack}>←</button>
    <h1 class="section-title">Settings</h1>
  </div>

  <div class="flex flex-col gap-6">
    <!-- Appearance Section -->
    <div class="card p-4">
      <span class="card-corner-bl"></span>
      <span class="card-corner-br"></span>
      
      <h2 class="text-base font-semibold text-foreground mb-3">Appearance</h2>
      <div class="flex flex-col gap-1.5">
        <label for="theme" class="label">Theme</label>
        <select id="theme" class="input" bind:value={currentTheme}>
          <option value={THEMES.LIGHT}>Light</option>
          <option value={THEMES.DARK}>Dark</option>
          <option value={THEMES.AUTO}>Auto (System)</option>
        </select>
      </div>
    </div>

    <!-- Backend Configuration -->
    <div class="card p-4">
      <span class="card-corner-bl"></span>
      <span class="card-corner-br"></span>
      
      <h2 class="text-base font-semibold text-foreground mb-3">Backend Configuration</h2>
      <div class="flex flex-col gap-1.5">
        <label for="backendUrl" class="label">Backend URL</label>
        <input
          id="backendUrl"
          type="text"
          class="input"
          bind:value={backendUrl}
          placeholder="http://localhost:8090" />
        <p class="text-xs text-muted-foreground mt-1">
          Change this only if you're using a custom backend server
        </p>
      </div>
    </div>

    <!-- Account Information -->
    {#if authData}
      <div class="card p-4">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        
        <h2 class="text-base font-semibold text-foreground mb-3">Account Information</h2>
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center p-3 bg-muted">
            <span class="text-sm font-semibold text-muted-foreground">Email</span>
            <span class="text-sm text-foreground break-all">{authData.email}</span>
          </div>
          {#if authData.email}
            <div class="flex justify-between items-center p-3 bg-muted">
              <span class="text-sm font-semibold text-muted-foreground">Name</span>
              <span class="text-sm text-foreground">{authData.email.split("@")[0]}</span>
            </div>
          {/if}
          <div class="flex justify-between items-center p-3 bg-muted">
            <span class="text-sm font-semibold text-muted-foreground">User ID</span>
            <span class="text-sm text-foreground break-all">{authData.userId}</span>
          </div>
        </div>
      </div>

      <!-- Developer Token -->
      <div class="card p-4">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-base font-semibold text-foreground">Developer Token</h2>
        </div>
        <p class="text-xs text-muted-foreground mb-3">
          Enter your dev token. Your user ID will be added automatically.
        </p>

        <div class="flex flex-col gap-1.5 mb-4">
          <label for="devTokenInput" class="label">Dev Token</label>
          <textarea
            id="devTokenInput"
            class="input min-h-[60px] resize-y {tokenError ? 'border-destructive' : ''}"
            bind:value={devTokenInput}
            placeholder="your-token-here"
            rows="3"
          ></textarea>
          {#if tokenError}
            <p class="error-text">{tokenError}</p>
          {/if}
          {#if hasStoredToken && !tokenError}
            <p class="success-text">✓ Token stored and ready to use</p>
          {/if}
        </div>

        <div class="flex gap-3">
          <button
            class="btn-primary flex-1"
            on:click={handleSaveToken}
            disabled={isSavingToken || !devTokenInput.trim()}>
            {isSavingToken ? "Saving..." : hasStoredToken ? "Update Token" : "Save Token"}
          </button>
          {#if hasStoredToken}
            <button
              class="btn-danger flex-1"
              on:click={handleClearToken}>
              Clear Token
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Save Message -->
    {#if saveMessage}
      <div class="{saveMessage.includes('success') ? 'success-banner' : 'error-banner'} text-center">
        {saveMessage}
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="flex flex-col gap-3">
      <button
        class="btn-primary"
        on:click={handleSaveSettings}
        disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Settings"}
      </button>
      <button class="btn-secondary" on:click={onNavigateToShortcuts}>
        Keyboard Shortcuts
      </button>
      <button class="btn-danger" on:click={handleLogout}>Logout</button>
    </div>

    <!-- System Info -->
    <div class="card p-4">
      <span class="card-corner-bl"></span>
      <span class="card-corner-br"></span>
      
      <div class="flex flex-col gap-2 text-xs">
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground font-semibold">Version:</span>
          <span class="text-foreground font-medium">{APP_VERSION}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground font-semibold">Build:</span>
          <span class="text-foreground font-medium">{BUILD_ENV}</span>
        </div>
        {#if profileId}
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground font-semibold">Profile ID:</span>
            <span class="text-foreground font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border">{profileId}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
