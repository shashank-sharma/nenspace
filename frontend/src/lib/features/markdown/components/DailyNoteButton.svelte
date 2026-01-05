<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { dailyNotesService } from '../services'
  import { notesStore, vaultStore } from '../stores'
  import { Calendar } from 'lucide-svelte'

  async function handleClick() {
    if (!vaultStore.activeVault) return

    try {
      let note = await dailyNotesService.getTodayNote()

      if (!note) {
        note = await dailyNotesService.createDailyNote(new Date())
      }

      await notesStore.loadNote(vaultStore.activeVault.id, note.path)
    } catch {
    }
  }
</script>

<Button
  variant="ghost"
  size="sm"
  on:click={handleClick}
  title="Open today's note"
>
  <Calendar class="w-4 h-4" />
</Button>

