<script lang="ts">
  import { onMount } from "svelte"
  import IconUser from "./icons/IconUser.svelte"
  import IconCheck from "./icons/IconCheck.svelte"
  import {
    fetchUserProfiles,
    createProfile,
    updateLastUsed,
    getBrowserInfo,
    type BrowserProfile,
    type CreateProfileData
  } from "../services/profile.service"
  import {
    profileStorage,
    authStorage,
    settingsStorage
  } from "../services/plasmo-storage.service"
  import { createLogger } from "../utils/logger.util"

  const logger = createLogger("[ProfileSelector]")

  export let onProfileSelected: (profileId: string) => void
  export let currentProfileId: string | null = null // Previously selected profile

  let profiles: BrowserProfile[] = []
  let loading = true
  let error: string | null = null
  let showCreateForm = false
  let newProfileName = ""
  let creating = false
  let auth: any = null
  let backendUrl: string | null = null

  onMount(async () => {
    // Wait a bit for auth data to be saved and storage to be ready
    await new Promise(resolve => setTimeout(resolve, 500))
    await loadProfilesWithRetry()
    if (!currentProfileId) {
      const profileIdResult = await profileStorage.getProfileId()
      currentProfileId = profileIdResult.success ? profileIdResult.data : null
    }
  })

  async function loadProfilesWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await loadProfiles()
        if (!error) {
          return // Success, exit retry loop
        }
      } catch (err) {
        logger.warn(`Profile loading attempt ${attempt} failed`, err)
        if (attempt < maxRetries) {
          // Wait before retrying, with exponential backoff
          await new Promise(resolve => setTimeout(resolve, attempt * 200))
        }
      }
    }
  }

  async function loadProfiles() {
    try {
      loading = true
      error = null

      const authResult = await authStorage.get()
      auth = authResult.success ? authResult.data : null
      const backendUrlResult = await settingsStorage.getBackendUrl()
      backendUrl = backendUrlResult.success ? backendUrlResult.data : null

      logger.debug("Auth data retrieved", { 
        auth: auth ? { userId: auth.userId, email: auth.email, hasToken: !!auth.primaryToken } : null,
        backendUrl 
      })

      // If no backend URL in settings, use the one from auth data
      if (!backendUrl && auth?.backendUrl) {
        backendUrl = auth.backendUrl
        // Save it to settings for future use
        await settingsStorage.saveBackendUrl(backendUrl)
      }

      if (!auth) {
        logger.error("No auth data found in storage")
        throw new Error("Authentication data not available. Please try logging in again.")
      }

      if (!backendUrl) {
        throw new Error("Backend URL not available. Please check your configuration.")
      }

      logger.debug("Loading profiles", { 
        hasAuth: !!auth, 
        backendUrl, 
        userId: auth.userId,
        authKeys: auth ? Object.keys(auth) : []
      })

      profiles = await fetchUserProfiles(
        backendUrl,
        auth.primaryToken,
        auth.userId
      )
    } catch (err) {
      logger.error("Failed to load profiles", err)
      error = err instanceof Error ? err.message : "Failed to load profiles"
      throw err // Re-throw for retry logic
    } finally {
      loading = false
    }
  }

  async function selectProfile(profile: BrowserProfile) {
    try {
      // Update last used timestamp
      if (backendUrl && auth) {
        await updateLastUsed(backendUrl, auth.primaryToken, profile.id)
      }

      await profileStorage.saveProfileId(profile.id)
      onProfileSelected(profile.id)
    } catch (err) {
      logger.error("Failed to select profile", err)
      error = err instanceof Error ? err.message : "Failed to select profile"
    }
  }

  async function createNewProfile() {
    if (!newProfileName.trim() || !auth || !backendUrl) {
      return
    }

    try {
      creating = true
      error = null

      const browserInfo = getBrowserInfo()

      const profileData: CreateProfileData = {
        user: auth.userId,
        profile_name: newProfileName.trim(),
        browser_info: browserInfo
      }

      const newProfile = await createProfile(
        backendUrl,
        auth.primaryToken,
        profileData
      )

      // Save profile ID to storage
      await profileStorage.saveProfileId(newProfile.id)
      onProfileSelected(newProfile.id)
    } catch (err) {
      logger.error("Failed to create profile", err)
      error = err instanceof Error ? err.message : "Failed to create profile"
    } finally {
      creating = false
    }
  }

  function formatLastUsed(dateString?: string): string {
    if (!dateString) return "Never"

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  function formatBrowserInfo(profile: BrowserProfile): string {
    if (!profile.browser_info) return "Unknown browser"
    const { browser, os, version } = profile.browser_info
    return `${browser} ${version} on ${os}`
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && showCreateForm && newProfileName.trim()) {
      createNewProfile()
    } else if (event.key === "Escape" && showCreateForm) {
      showCreateForm = false
      newProfileName = ""
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full min-h-[500px] p-6 overflow-y-auto overflow-x-hidden">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="text-sm text-muted-foreground">Loading profiles...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <p class="text-destructive text-sm">{error}</p>
      <button class="btn-primary" on:click={() => loadProfilesWithRetry()}>Try Again</button>
    </div>
  {:else if profiles.length === 0 && !showCreateForm}
    <div class="empty-state">
      <div class="empty-state-icon">
        <IconUser size={48} />
      </div>
      <h3 class="empty-state-title">No profiles found</h3>
      <p class="empty-state-text">Create your first browser profile to get started.</p>
      <button class="btn-primary mt-4" on:click={() => (showCreateForm = true)}>
        Create Profile
      </button>
    </div>
  {:else}
    <div class="flex flex-col gap-5">
      {#if !showCreateForm}
        <!-- Header -->
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold text-foreground">Select a profile</h3>
          <button class="btn-primary text-sm px-3 py-2" on:click={() => (showCreateForm = true)}>
            Create New
          </button>
        </div>

        <!-- Profiles Grid -->
        <div class="flex flex-col gap-3">
          {#each profiles as profile (profile.id)}
            <button
              class="card p-4 text-left w-full cursor-pointer transition-all hover:border-primary hover:-translate-y-0.5 {profile.id === currentProfileId ? 'border-primary bg-primary/10' : ''}"
              on:click={() => selectProfile(profile)}>
              <span class="card-corner-bl"></span>
              <span class="card-corner-br"></span>
              
              <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground">
                  <IconUser size={20} />
                </div>
                <div class="flex-1">
                  <h4 class="text-sm font-semibold text-foreground flex items-center gap-2">
                    {profile.profile_name}
                    {#if profile.id === currentProfileId}
                      <span class="badge-primary text-[10px] uppercase tracking-wide">Current</span>
                    {/if}
                  </h4>
                  <p class="text-xs text-muted-foreground">{formatBrowserInfo(profile)}</p>
                </div>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[11px] text-muted-foreground">
                  Last used: {formatLastUsed(profile.last_used_at)}
                </span>
              </div>
            </button>
          {/each}
        </div>
      {:else}
        <!-- Create Profile Form -->
        <div class="card p-5">
          <span class="card-corner-bl"></span>
          <span class="card-corner-br"></span>
          
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-semibold text-foreground">Create New Profile</h3>
            <button class="btn-ghost text-sm px-3 py-2" on:click={() => (showCreateForm = false)}>
              Back
            </button>
          </div>

          <div class="flex flex-col gap-6">
            <!-- Profile Name Input -->
            <div class="flex flex-col gap-1.5">
              <label for="profile-name" class="label">Profile Name</label>
              <input
                id="profile-name"
                type="text"
                class="input"
                bind:value={newProfileName}
                placeholder="e.g., Work Chrome, Personal Firefox"
                maxlength="100"
                disabled={creating} />
            </div>

            <!-- Browser Info -->
            <div class="card p-4">
              <span class="card-corner-bl"></span>
              <span class="card-corner-br"></span>
              
              <h4 class="text-sm font-semibold text-foreground mb-3">Browser Information</h4>
              <div class="grid grid-cols-3 gap-3">
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Browser</span>
                  <span class="text-sm font-medium text-foreground">{getBrowserInfo().browser}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Version</span>
                  <span class="text-sm font-medium text-foreground">{getBrowserInfo().version}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">OS</span>
                  <span class="text-sm font-medium text-foreground">{getBrowserInfo().os}</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 justify-end">
              <button
                class="btn-secondary"
                on:click={() => (showCreateForm = false)}
                disabled={creating}>
                Cancel
              </button>
              <button
                class="btn-primary flex items-center gap-2"
                on:click={createNewProfile}
                disabled={!newProfileName.trim() || creating}>
                {#if creating}
                  <div class="spinner-sm"></div>
                  Creating...
                {:else}
                  <IconCheck size={16} />
                  Create Profile
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
