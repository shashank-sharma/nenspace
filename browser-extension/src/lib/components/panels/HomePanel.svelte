<script lang="ts">
  import SharedHome from "../shared/SharedHome.svelte"

  export let onClose: () => void
  export let onNavigateToSettings: () => void
</script>

<SharedHome {onNavigateToSettings} onLogout={onClose} />
