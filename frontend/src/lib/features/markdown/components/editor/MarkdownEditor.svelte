<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView, basicSetup } from 'codemirror'
  import { markdown } from '@codemirror/lang-markdown'
  import { oneDark } from '@codemirror/theme-one-dark'
  import { wikiLinkExtension, tagExtension, blockRefExtension, linkAutocompleteExtension } from './extensions'
  import { notesStore } from '../../stores'
  import { debounce } from '../../utils'
  import type { Note } from '../../types'

  interface Props {
    note?: Note | null
    onSave?: ((content: string) => Promise<void>) | null
  }

  let { note = null, onSave = null }: Props = $props()

  let editorView: EditorView | null = null
  let editorElement: HTMLDivElement
  let isDirty = $state(false)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  const debouncedSave = debounce(async (content: string) => {
    if (onSave && note) {
      await onSave(content)
      isDirty = false
    }
  }, 2000)

  onMount(() => {
    if (!editorElement) return

    editorView = new EditorView({
      doc: note?.content || '',
      extensions: [
        basicSetup,
        markdown(),
        wikiLinkExtension(),
        tagExtension(),
        blockRefExtension(),
        linkAutocompleteExtension(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && note) {
            isDirty = true
            const content = update.state.doc.toString()
            if (saveTimeout) clearTimeout(saveTimeout)
            saveTimeout = setTimeout(() => {
              debouncedSave(content)
            }, 2000)
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': { height: '100%', overflow: 'auto' },
          '.cm-wiki-link': { color: '#7c3aed', cursor: 'pointer' },
          '.cm-block-ref': { color: '#059669', fontFamily: 'monospace' },
          '.cm-tag': { color: '#dc2626' }
        })
      ],
      parent: editorElement
    })

    return () => {
      editorView?.destroy()
    }
  })

  onDestroy(() => {
    if (saveTimeout) clearTimeout(saveTimeout)
    editorView?.destroy()
  })

  $effect(() => {
    if (note && editorView && editorView.state.doc.toString() !== note.content) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: note.content
        }
      })
      isDirty = false
    }
  })

  async function handleSave() {
    if (!editorView || !onSave || !note) return
    const content = editorView.state.doc.toString()
    await onSave(content)
    isDirty = false
  }
</script>

<div class="markdown-editor h-full flex flex-col">
  {#if isDirty}
    <div class="text-xs text-muted-foreground px-4 py-2 border-b">
      Unsaved changes
    </div>
  {/if}
  <div bind:this={editorElement} class="flex-1 overflow-hidden"></div>
</div>

<style>
  :global(.markdown-editor .cm-editor) {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
  }

  :global(.markdown-editor .cm-wiki-link:hover) {
    text-decoration: underline;
  }
</style>

