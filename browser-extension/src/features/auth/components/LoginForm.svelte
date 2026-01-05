<script lang="ts">
  import { onMount } from "svelte"
  import { authFlowService } from "../services/auth-flow.service"
  import {
    validateEmail,
    validateRequired,
    validateUrl
  } from "../../../lib/utils/validation.util"
  import { DEFAULT_BACKEND_URL, THEMES } from "../../../lib/config/constants"
  import { createLogger } from "../../../lib/utils/logger.util"
  import { applyThemeToElement } from "../../../lib/config/themes"
  import { settingsStorage } from "../../../lib/services/plasmo-storage.service"

  const logger = createLogger("[LoginForm]")

  // Props
  export let onSuccess: (needsProfileSelection?: boolean) => void

  // Form state
  let backendUrl = DEFAULT_BACKEND_URL
  let email = ""
  let password = ""

  // UI state
  let isLoading = false
  let error = ""
  let currentStep = ""
  let stepMessage = ""
  let showAdvanced = false

  // Validation errors
  let errors = {
    backendUrl: "",
    email: "",
    password: ""
  }

  // Validate form
  function validateForm(): boolean {
    errors = {
      backendUrl: validateUrl(backendUrl) || "",
      email: validateEmail(email) || "",
      password: validateRequired(password, "Password") || ""
    }

    return !Object.values(errors).some((e) => e !== "")
  }

  // Handle form submission
  async function handleSubmit(e: Event) {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    isLoading = true
    error = ""
    currentStep = ""
    stepMessage = ""

    const result = await authFlowService.completeAuthFlow(
      backendUrl,
      email,
      password,
      "", // deviceName not used anymore
      (step, message) => {
        currentStep = step
        stepMessage = message
      }
    )

    isLoading = false

    if (result.success) {
      onSuccess(result.needsProfileSelection)
    } else {
      logger.error("Login failed", result.error)
      error = result.error || "Authentication failed"
    }
  }

  // Clear error when user types
  function clearError(field: keyof typeof errors) {
    errors[field] = ""
    error = ""
  }

  // Apply theme on mount
  onMount(async () => {
    try {
      const theme = await settingsStorage.getTheme()
      let themeToApply = theme
      
      if (theme === THEMES.AUTO) {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          themeToApply = 'modern-dark'
        } else {
          themeToApply = 'light'
        }
      } else if (theme === THEMES.DARK) {
        themeToApply = 'modern-dark'
      } else if (theme === THEMES.LIGHT) {
        themeToApply = 'light'
      }
      
      applyThemeToElement(document.documentElement, themeToApply)
    } catch (error) {
      // Fallback to default theme
      applyThemeToElement(document.documentElement, 'modern-dark')
    }
  })
</script>

<div class="max-w-[400px] mx-auto p-6">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold mb-2 text-foreground">
      Sign In
    </h1>
    <p class="text-sm text-muted-foreground">Connect your Nenspace account</p>
  </div>

  <!-- Login Form Card -->
  <div class="card p-6">
    <span class="card-corner-bl"></span>
    <span class="card-corner-br"></span>
    
    <form on:submit={handleSubmit} class="flex flex-col gap-5">
      <!-- Advanced Configuration Toggle -->
      <button
        type="button"
        class="w-full px-3 py-2.5 bg-transparent border border-dashed border-border text-sm font-medium text-muted-foreground cursor-pointer text-left transition-colors hover:border-primary hover:text-primary hover:bg-muted"
        on:click={() => (showAdvanced = !showAdvanced)}>
        {showAdvanced ? "▼" : "▶"} Advanced Configuration
      </button>

      {#if showAdvanced}
        <div class="flex flex-col gap-4 p-4 bg-muted">
          <div class="flex flex-col gap-1.5">
            <label for="backendUrl" class="label">Backend URL</label>
            <input
              id="backendUrl"
              type="text"
              class="input"
              bind:value={backendUrl}
              on:input={() => clearError("backendUrl")}
              disabled={isLoading}
              placeholder="http://localhost:8090" />
            {#if errors.backendUrl}
              <span class="error-text">{errors.backendUrl}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Email Field -->
      <div class="flex flex-col gap-1.5">
        <label for="email" class="label">Email</label>
        <input
          id="email"
          type="email"
          class="input"
          bind:value={email}
          on:input={() => clearError("email")}
          disabled={isLoading}
          placeholder="you@example.com"
          autocomplete="email" />
        {#if errors.email}
          <span class="error-text">{errors.email}</span>
        {/if}
      </div>

      <!-- Password Field -->
      <div class="flex flex-col gap-1.5">
        <label for="password" class="label">Password</label>
        <input
          id="password"
          type="password"
          class="input"
          bind:value={password}
          on:input={() => clearError("password")}
          disabled={isLoading}
          placeholder="••••••••"
          autocomplete="current-password" />
        {#if errors.password}
          <span class="error-text">{errors.password}</span>
        {/if}
      </div>

      <!-- Error Banner -->
      {#if error}
        <div class="error-banner">
          {error}
        </div>
      {/if}

      <!-- Progress Indicator -->
      {#if isLoading && stepMessage}
        <div class="flex items-center gap-3 p-3 bg-primary/5 text-sm text-primary">
          <div class="spinner-sm"></div>
          <span>{stepMessage}</span>
        </div>
      {/if}

      <!-- Submit Button -->
      <button 
        type="submit" 
        class="btn-primary" 
        disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  </div>
</div>
