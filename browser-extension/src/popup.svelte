<script lang="ts">
  import { onMount } from "svelte"
  import "./styles/global.css"
  import LoginForm from "./features/auth/components/LoginForm.svelte"
  import Home from "./popup/pages/Home.svelte"
  import Settings from "./popup/pages/Settings.svelte"
  import SyncSettings from "./popup/pages/SyncSettings.svelte"
  import Shortcuts from "./popup/pages/Shortcuts.svelte"
  import ProfileSelector from "./lib/components/ProfileSelector.svelte"
  import { authService } from "./lib/services/auth.service"
  import {
    profileStorage,
    settingsStorage
  } from "./lib/services/plasmo-storage.service"
  import { applyThemeToElement } from "./lib/config/themes"
  import { THEMES } from "./lib/config/constants"
  import { createLogger } from "./lib/utils/logger.util"

  const logger = createLogger("[Popup]")

  type Page =
    | "login"
    | "home"
    | "settings"
    | "sync-settings"
    | "shortcuts"
    | "profile-selection"

  let currentPage: Page = "login"
  let isCheckingAuth = true
  let currentProfileId: string | null = null

  onMount(async () => {
    try {
      // Apply theme first
      try {
        const themeResult = await settingsStorage.getTheme()
        const theme = themeResult.success ? themeResult.data : 'dark'
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
        logger.warn('Failed to apply theme', error)
      }

      await authService.initializeFromStorage()

      const authenticated = await authService.isAuthenticated()

      if (!authenticated) {
        currentPage = "login"
        isCheckingAuth = false
        return
      }

      const profileIdResult = await profileStorage.getProfileId()
      currentProfileId = profileIdResult.success ? profileIdResult.data : null

      if (!currentProfileId) {
        currentPage = "profile-selection"
        isCheckingAuth = false
        return
      }

      // Verify profile is still valid
      try {
        const authDataResult = await authService.getStoredAuth()
        if (authDataResult.success && authDataResult.data) {
          const authData = authDataResult.data
          const { verifyProfile } = await import("./lib/services/profile.service")
          const isValidProfile = await verifyProfile(
            authData.backendUrl,
            authData.primaryToken,
            currentProfileId
          )

          if (!isValidProfile) {
            await profileStorage.clearProfileId()
            currentProfileId = null
            currentPage = "profile-selection"
            isCheckingAuth = false
            return
          }
        } else {
          await profileStorage.clearProfileId()
          currentProfileId = null
          currentPage = "profile-selection"
          isCheckingAuth = false
          return
        }
      } catch (error) {
        logger.error("Error verifying profile", error)
        await profileStorage.clearProfileId()
        currentProfileId = null
        currentPage = "profile-selection"
        isCheckingAuth = false
        return
      }

      currentPage = "home"
      isCheckingAuth = false
    } catch (error) {
      logger.error("Failed to initialize popup", error)
      // Fallback: show login page if initialization fails
      currentPage = "login"
      isCheckingAuth = false
    }
  })

  async function handleLoginSuccess(needsProfileSelection?: boolean) {
    isCheckingAuth = false

    // Wait a bit to ensure auth data is fully saved
    await new Promise(resolve => setTimeout(resolve, 200))

    if (needsProfileSelection) {
      currentPage = "profile-selection"
    } else {
      currentPage = "home"
    }

    const profileIdResult = await profileStorage.getProfileId()
    currentProfileId = profileIdResult.success ? profileIdResult.data : null
  }

  async function handleProfileSelected() {
    const profileIdResult = await profileStorage.getProfileId()
    currentProfileId = profileIdResult.success ? profileIdResult.data : null
    currentPage = "home"
  }

  function handleLogout() {
    currentPage = "login"
  }

  function navigateToSettings() {
    currentPage = "settings"
  }

  function navigateToSyncSettings() {
    currentPage = "sync-settings"
  }

  function navigateToShortcuts() {
    currentPage = "shortcuts"
  }

  function navigateToHome() {
    currentPage = "home"
  }
</script>

<main class="w-[400px] h-[600px] bg-background overflow-y-auto overflow-x-hidden relative scroll-smooth overscroll-contain bg-grid-pattern [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
  {#if isCheckingAuth}
    <div class="flex flex-col items-center justify-center min-h-[500px] gap-4">
      <div class="spinner"></div>
      <p class="text-sm text-muted-foreground">Loading...</p>
    </div>
  {:else if currentPage === "login"}
    <LoginForm onSuccess={handleLoginSuccess} />
  {:else if currentPage === "profile-selection"}
    <ProfileSelector
      onProfileSelected={handleProfileSelected}
      {currentProfileId} />
  {:else if currentPage === "home"}
    <Home
      onLogout={handleLogout}
      onNavigateToSettings={navigateToSettings}
      onNavigateToSyncSettings={navigateToSyncSettings} />
  {:else if currentPage === "settings"}
    <Settings
      onBack={navigateToHome}
      onLogout={handleLogout}
      onNavigateToShortcuts={navigateToShortcuts} />
  {:else if currentPage === "sync-settings"}
    <SyncSettings onBack={navigateToHome} />
  {:else if currentPage === "shortcuts"}
    <Shortcuts onBack={navigateToSettings} />
  {/if}
</main>
