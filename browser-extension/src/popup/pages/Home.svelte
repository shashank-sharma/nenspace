<script lang="ts">
  import SharedHome from "../../lib/components/shared/SharedHome.svelte"

  export let onLogout: () => void
  export let onNavigateToSettings: () => void
  export let onNavigateToSyncSettings: () => void
</script>

<div class="max-w-[400px] mx-auto p-6">
  <SharedHome {onNavigateToSettings} {onNavigateToSyncSettings} {onLogout} />
</div>
