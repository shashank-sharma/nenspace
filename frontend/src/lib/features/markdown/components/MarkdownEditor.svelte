<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView, basicSetup } from 'codemirror'
  import { markdown } from '@codemirror/lang-markdown'
  import { lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
  import { Compartment } from '@codemirror/state'
  import { wikiLinkExtension, tagExtension, blockRefExtension, linkAutocompleteExtension } from './editor/extensions'
  import { debounce } from '../utils'
  import { Card, CardContent, CardHeader } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import {
    Bold,
    Italic,
    Code,
    Link,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    Strikethrough,
    Undo,
    Redo,
    Search,
    Eye,
    EyeOff,
    FileText,
    Download,
    Save,
    Check,
    Loader2,
    MoreVertical,
    Minus,
    Hash
  } from 'lucide-svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Input } from '$lib/components/ui/input'
  import type { Note } from '../types'

  interface Props {
    note?: Note | null
    onSave?: ((content: string) => Promise<void>) | null
    class?: string
    showCard?: boolean
    autoSave?: boolean
    saveDelay?: number
    enableWikiLinks?: boolean
    enableTags?: boolean
    enableBlockRefs?: boolean
  }

  let {
    note = null,
    onSave = null,
    class: className = '',
    showCard = true,
    autoSave = true,
    saveDelay = 2000,
    enableWikiLinks = true,
    enableTags = true,
    enableBlockRefs = true
  }: Props = $props()

  let editorView: EditorView | null = null
  let editorElement: HTMLDivElement
  let isDirty = $state(false)
  let isSaving = $state(false)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  let showLineNumbers = $state(true)
  let showPreview = $state(false)
  let showSearch = $state(false)
  let searchQuery = $state('')
  let focusMode = $state(false)
  let wordCount = $state(0)
  let readingTime = $state(0)
  let charCount = $state(0)
  let lineNumbersCompartment = new Compartment()
  let focusModeCompartment = new Compartment()

  const debouncedSave = debounce(async (content: string) => {
    if (onSave && note && autoSave) {
      isSaving = true
      try {
        await onSave(content)
        isDirty = false
      } finally {
        isSaving = false
      }
    }
  }, saveDelay)

  function calculateStats(content: string) {
    const words = content.trim().split(/\s+/).filter(Boolean)
    wordCount = words.length
    charCount = content.length
    readingTime = Math.ceil(wordCount / 200)
  }

  function insertText(before: string, after: string = '') {
    if (!editorView) return

    const selection = editorView.state.selection.main
    const from = selection.from
    const to = selection.to
    const selectedText = editorView.state.doc.sliceString(from, to)

    editorView.dispatch({
      changes: {
        from,
        to,
        insert: before + selectedText + after
      },
      selection: {
        anchor: from + before.length + selectedText.length + after.length
      }
    })
    editorView.focus()
  }

  function insertAtLineStart(text: string) {
    if (!editorView) return

    const selection = editorView.state.selection.main
    const line = editorView.state.doc.lineAt(selection.from)
    const lineStart = line.from

    editorView.dispatch({
      changes: {
        from: lineStart,
        insert: text
      },
      selection: {
        anchor: lineStart + text.length
      }
    })
    editorView.focus()
  }

  function formatCommand(command: string) {
    if (!editorView) return

    switch (command) {
      case 'bold':
        insertText('**', '**')
        break
      case 'italic':
        insertText('*', '*')
        break
      case 'strikethrough':
        insertText('~~', '~~')
        break
      case 'code':
        insertText('`', '`')
        break
      case 'codeBlock':
        insertText('```\n', '\n```')
        break
      case 'link':
        insertText('[', '](url)')
        break
      case 'image':
        insertText('![', '](url)')
        break
      case 'heading1':
        insertAtLineStart('# ')
        break
      case 'heading2':
        insertAtLineStart('## ')
        break
      case 'heading3':
        insertAtLineStart('### ')
        break
      case 'quote':
        insertAtLineStart('> ')
        break
      case 'list':
        insertAtLineStart('- ')
        break
      case 'orderedList':
        insertAtLineStart('1. ')
        break
      case 'horizontalRule':
        insertAtLineStart('---\n')
        break
    }
  }

  async function handleSave() {
    if (!editorView || !onSave || !note) return
    const content = editorView.state.doc.toString()
    isSaving = true
    try {
      await onSave(content)
      isDirty = false
    } finally {
      isSaving = false
    }
  }

  function toggleLineNumbers() {
    showLineNumbers = !showLineNumbers
    if (editorView) {
      updateEditorExtensions()
    }
  }

  function toggleFocusMode() {
    focusMode = !focusMode
  }

  function toggleSearch() {
    showSearch = !showSearch
    if (showSearch && editorView) {
      setTimeout(() => {
        editorView?.focus()
      }, 100)
    }
  }

  function updateEditorExtensions() {
    if (!editorView) return

    if (showLineNumbers) {
      editorView.dispatch({
        effects: lineNumbersCompartment.reconfigure(lineNumbers())
      })
    } else {
      editorView.dispatch({
        effects: lineNumbersCompartment.reconfigure([])
      })
    }

    if (focusMode) {
      editorView.dispatch({
        effects: focusModeCompartment.reconfigure(
          EditorView.theme({
            '.cm-content': { maxWidth: '800px', margin: '0 auto', padding: '2rem' }
          })
        )
      })
    } else {
      editorView.dispatch({
        effects: focusModeCompartment.reconfigure([])
      })
    }
  }

  function exportMarkdown() {
    if (!editorView) return
    const content = editorView.state.doc.toString()
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note?.title || 'note'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  onMount(() => {
    if (!editorElement) return

    const extensions = [
      basicSetup,
      markdown(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      ...(enableWikiLinks ? [wikiLinkExtension()] : []),
      ...(enableTags ? [tagExtension()] : []),
      ...(enableBlockRefs ? [blockRefExtension()] : []),
      ...(enableWikiLinks ? [linkAutocompleteExtension()] : []),
      lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
      focusModeCompartment.of(
        focusMode
          ? EditorView.theme({
              '.cm-content': { maxWidth: '800px', margin: '0 auto', padding: '2rem' }
            })
          : []
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && note) {
          isDirty = true
          const content = update.state.doc.toString()
          calculateStats(content)
          if (saveTimeout) clearTimeout(saveTimeout)
          saveTimeout = setTimeout(() => {
            debouncedSave(content)
          }, saveDelay)
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-editor': {
          height: '100%',
          color: 'hsl(var(--foreground))'
        },
        '.cm-scroller': { height: '100%', overflow: 'auto' },
        '.cm-content': {
          color: 'hsl(var(--foreground))',
          caretColor: 'hsl(var(--foreground))'
        },
        '.cm-cursor': {
          borderLeftColor: 'hsl(var(--foreground))',
          borderLeftWidth: '2px',
          marginLeft: '-1px'
        },
        '.cm-dropCursor': {
          borderLeftColor: 'hsl(var(--foreground))',
          borderLeftWidth: '2px'
        },
        '.cm-wiki-link': { color: '#7c3aed', cursor: 'pointer' },
        '.cm-block-ref': { color: '#059669', fontFamily: 'monospace' },
        '.cm-tag': { color: '#dc2626' },
        '.cm-gutters': {
          backgroundColor: 'hsl(var(--muted))',
          color: 'hsl(var(--muted-foreground))',
          border: 'none'
        },
        '.cm-lineNumbers .cm-lineNumber': {
          color: 'hsl(var(--muted-foreground))'
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'hsl(var(--muted))',
          color: 'hsl(var(--foreground))'
        },
        '.cm-activeLine': {
          backgroundColor: 'hsl(var(--muted) / 0.5)'
        },
        '.cm-line:hover': {
          backgroundColor: 'hsl(var(--muted) / 0.3)'
        },
        '.cm-lineNumbers .cm-lineNumber.cm-activeLineGutter': {
          color: 'hsl(var(--foreground))',
          fontWeight: 'bold'
        },
        '&.cm-focused .cm-gutters': {
          backgroundColor: 'hsl(var(--muted))'
        },
        '&.cm-focused .cm-activeLineGutter': {
          backgroundColor: 'hsl(var(--muted))'
        }
      })
    ]

    editorView = new EditorView({
      doc: note?.content || '',
      extensions,
      parent: editorElement
    })

    if (note?.content) {
      calculateStats(note.content)
    }

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
      calculateStats(note.content)
      isDirty = false
    }
  })

  $effect(() => {
    if (editorView && (showLineNumbers !== undefined || focusMode !== undefined)) {
      updateEditorExtensions()
    }
  })
</script>

{#if showCard}
  <Card class="markdown-editor-card h-full flex flex-col {className}">
    <CardHeader class="p-0">
      <div class="flex items-center justify-between p-3 border-b">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('bold')}
              title="Bold (Ctrl+B)"
            >
              <Bold class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('italic')}
              title="Italic (Ctrl+I)"
            >
              <Italic class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('strikethrough')}
              title="Strikethrough"
            >
              <Strikethrough class="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" class="h-6" />
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('heading1')}
              title="Heading 1"
            >
              <Heading1 class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('heading2')}
              title="Heading 2"
            >
              <Heading2 class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('heading3')}
              title="Heading 3"
            >
              <Heading3 class="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" class="h-6" />
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('list')}
              title="Bullet List"
            >
              <List class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('orderedList')}
              title="Numbered List"
            >
              <ListOrdered class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('quote')}
              title="Quote"
            >
              <Quote class="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" class="h-6" />
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('code')}
              title="Inline Code"
            >
              <Code class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('link')}
              title="Link"
            >
              <Link class="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" class="h-6" />
            <Button
              variant="ghost"
              size="sm"
              on:click={() => formatCommand('horizontalRule')}
              title="Horizontal Rule"
            >
              <Minus class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {#if showSearch}
            <div class="flex items-center gap-1">
              <Input
                bind:value={searchQuery}
                placeholder="Search..."
                class="h-8 w-48"
                on:keydown={(e) => {
                  if (e.key === 'Escape') {
                    showSearch = false
                    searchQuery = ''
                  }
                }}
              />
            </div>
          {/if}

          <Button
            variant="ghost"
            size="sm"
            on:click={toggleSearch}
            title="Search (Ctrl+F)"
          >
            <Search class="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            on:click={toggleLineNumbers}
            title="Toggle Line Numbers"
          >
            <Hash class="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            on:click={toggleFocusMode}
            title="Focus Mode"
          >
            {#if focusMode}
              <EyeOff class="w-4 h-4" />
            {:else}
              <Eye class="w-4 h-4" />
            {/if}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild let:builder>
              <Button variant="ghost" size="sm" builders={[builder]}>
                <MoreVertical class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem on:click={exportMarkdown}>
                <Download class="w-4 h-4 mr-2" />
                Export Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Undo class="w-4 h-4 mr-2" />
                Undo (Ctrl+Z)
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Redo class="w-4 h-4 mr-2" />
                Redo (Ctrl+Shift+Z)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {#if onSave && note}
            <Button
              variant="ghost"
              size="sm"
              on:click={handleSave}
              disabled={!isDirty || isSaving}
              title="Save (Ctrl+S)"
            >
              {#if isSaving}
                <Loader2 class="w-4 h-4 animate-spin" />
              {:else if isDirty}
                <Save class="w-4 h-4" />
              {:else}
                <Check class="w-4 h-4 text-green-600" />
              {/if}
            </Button>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-1.5 border-b text-xs text-muted-foreground bg-muted/30">
        <div class="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span>{readingTime} min read</span>
        </div>
        {#if isDirty}
          <div class="flex items-center gap-1 text-orange-600">
            <div class="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
            <span>Unsaved changes</span>
          </div>
        {:else if isSaving}
          <div class="flex items-center gap-1">
            <Loader2 class="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        {:else}
          <div class="flex items-center gap-1 text-green-600">
            <Check class="w-3 h-3" />
            <span>Saved</span>
          </div>
        {/if}
      </div>
    </CardHeader>

    <CardContent class="flex-1 p-0 overflow-hidden relative">
      <div bind:this={editorElement} class="h-full w-full"></div>
      {#if note}
        <div class="absolute bottom-2 left-4 text-xs text-muted-foreground pointer-events-none z-10">
          {note.path}
        </div>
      {/if}
    </CardContent>
  </Card>
{:else}
  <div class="markdown-editor h-full flex flex-col relative {className}">
    <div class="flex items-center justify-between p-2 border-b">
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" on:click={() => formatCommand('bold')}>
          <Bold class="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" on:click={() => formatCommand('italic')}>
          <Italic class="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" on:click={() => formatCommand('code')}>
          <Code class="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" on:click={() => formatCommand('link')}>
          <Link class="w-4 h-4" />
        </Button>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        {#if isDirty}
          <span class="text-orange-600">Unsaved</span>
        {/if}
      </div>
    </div>
    <div bind:this={editorElement} class="flex-1 overflow-hidden relative">
      {#if note}
        <div class="absolute bottom-2 left-4 text-xs text-muted-foreground pointer-events-none z-10">
          {note.path}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.markdown-editor-card .cm-editor),
  :global(.markdown-editor .cm-editor) {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    line-height: 1.6;
  }

  :global(.markdown-editor-card .cm-wiki-link:hover),
  :global(.markdown-editor .cm-wiki-link:hover) {
    text-decoration: underline;
  }

  :global(.markdown-editor-card .cm-focused),
  :global(.markdown-editor .cm-focused) {
    outline: none;
  }

  :global(.markdown-editor-card .cm-gutters),
  :global(.markdown-editor .cm-gutters) {
    background-color: hsl(var(--muted)) !important;
    border-right: 1px solid hsl(var(--border));
  }

  :global(.markdown-editor-card .cm-lineNumbers .cm-lineNumber),
  :global(.markdown-editor .cm-lineNumbers .cm-lineNumber) {
    color: hsl(var(--muted-foreground)) !important;
  }

  :global(.markdown-editor-card .cm-activeLineGutter),
  :global(.markdown-editor .cm-activeLineGutter) {
    background-color: hsl(var(--muted)) !important;
    color: hsl(var(--foreground)) !important;
  }

  :global(.markdown-editor-card .cm-lineNumbers .cm-lineNumber.cm-activeLineGutter),
  :global(.markdown-editor .cm-lineNumbers .cm-lineNumber.cm-activeLineGutter) {
    color: hsl(var(--foreground)) !important;
    font-weight: bold;
  }

  :global(.markdown-editor-card .cm-activeLine),
  :global(.markdown-editor .cm-activeLine) {
    background-color: hsl(var(--muted) / 0.5) !important;
  }

  :global(.markdown-editor-card .cm-line:hover),
  :global(.markdown-editor .cm-line:hover) {
    background-color: hsl(var(--muted) / 0.3) !important;
  }

  :global(.markdown-editor-card .cm-content),
  :global(.markdown-editor .cm-content) {
    color: hsl(var(--foreground)) !important;
    caret-color: hsl(var(--foreground)) !important;
  }

  :global(.markdown-editor-card .cm-cursor),
  :global(.markdown-editor .cm-cursor) {
    border-left-color: hsl(var(--foreground)) !important;
    border-left-width: 2px !important;
    border-left-style: solid !important;
    margin-left: -1px !important;
    animation: blink 1s step-end infinite !important;
  }

  :global(.markdown-editor-card .cm-dropCursor),
  :global(.markdown-editor .cm-dropCursor) {
    border-left-color: hsl(var(--foreground)) !important;
    border-left-width: 2px !important;
    border-left-style: solid !important;
  }

  @keyframes blink {
    0%, 50% {
      opacity: 1;
    }
    51%, 100% {
      opacity: 0;
    }
  }

  :global(.markdown-editor-card .cm-focused .cm-gutters),
  :global(.markdown-editor .cm-focused .cm-gutters) {
    background-color: hsl(var(--muted)) !important;
  }

  :global(.markdown-editor-card .cm-focused .cm-activeLineGutter),
  :global(.markdown-editor .cm-focused .cm-activeLineGutter) {
    background-color: hsl(var(--muted)) !important;
  }

  :global(.markdown-editor-card .cm-focused .cm-cursor),
  :global(.markdown-editor .cm-focused .cm-cursor) {
    border-left-color: hsl(var(--foreground)) !important;
  }
</style>

