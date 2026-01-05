<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import DailyNoteButton from './DailyNoteButton.svelte'
  import { Bold, Italic, Code, Link, List, Heading1 } from 'lucide-svelte'

  interface Props {
    onFormat?: ((command: string) => void) | null
  }

  let { onFormat = null }: Props = $props()
</script>

<div class="editor-toolbar flex items-center gap-1 p-2 border-b">
  <DailyNoteButton />

  <div class="flex-1"></div>

  <Button variant="ghost" size="sm" on:click={() => onFormat?.('bold')}>
    <Bold class="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" on:click={() => onFormat?.('italic')}>
    <Italic class="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" on:click={() => onFormat?.('code')}>
    <Code class="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" on:click={() => onFormat?.('link')}>
    <Link class="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" on:click={() => onFormat?.('heading')}>
    <Heading1 class="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" on:click={() => onFormat?.('list')}>
    <List class="w-4 h-4" />
  </Button>
</div>

