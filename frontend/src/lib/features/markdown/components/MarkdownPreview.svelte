<script lang="ts">
  import { onMount } from 'svelte'
  import MarkdownIt from 'markdown-it'
  import DOMPurify from 'isomorphic-dompurify'
  import type { Note } from '../types'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Edit, Eye } from 'lucide-svelte'
  import { createEventDispatcher } from 'svelte'

  interface Props {
    note?: Note | null
    class?: string
    editMode?: boolean
    onToggleEdit?: (() => void) | null
  }

  let { note = null, class: className = '', editMode = false, onToggleEdit = null }: Props = $props()

  const dispatch = createEventDispatcher<{ noteClick: { noteName: string } }>()

  let md = $state<MarkdownIt | null>(null)
  let renderedContent = $state('')
  let previewElement: HTMLDivElement

  onMount(() => {
    md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true
    })

    md.use((md) => {
      const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => {
        return self.renderToken(tokens, idx, options)
      })

      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const href = token.attrGet('href')

        if (href && href.startsWith('[[') && href.endsWith(']]')) {
          const noteName = href.slice(2, -2)
          token.attrSet('href', `#${noteName}`)
          token.attrSet('class', 'wiki-link')
          token.attrSet('data-note', noteName)
        }

        return defaultLinkOpen(tokens, idx, options, env, self)
      }
    })

    if (note?.content) {
      renderContent(note.content)
    }
  })

  $effect(() => {
    if (note?.content && md) {
      renderContent(note.content)
    }
  })

  $effect(() => {
    if (previewElement && renderedContent) {
      const wikiLinks = previewElement.querySelectorAll('.wiki-link')
      wikiLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault()
          const noteName = link.getAttribute('data-note')
          if (noteName) {
            dispatch('noteClick', { noteName })
          }
        })
      })

      return () => {
        wikiLinks.forEach((link) => {
          link.removeEventListener('click', () => {})
        })
      }
    }
  })

  function renderContent(content: string) {
    if (!md) return

    let processedContent = content

    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
    processedContent = processedContent.replace(wikiLinkRegex, (match, noteName) => {
      return `[${noteName}]([[${noteName}]])`
    })

    const html = md.render(processedContent)
    renderedContent = DOMPurify.sanitize(html)
  }
</script>

<Card class="markdown-preview h-full flex flex-col relative {className}">
  {#if note}
    <div class="absolute top-2 right-2 z-10">
      <Button
        variant="ghost"
        size="sm"
        on:click={() => onToggleEdit?.()}
        title="Edit (Ctrl+E)"
        class="h-8 w-8 p-0"
      >
        <Edit class="w-4 h-4" />
      </Button>
    </div>
  {/if}
  <CardContent class="flex-1 px-6 pb-6 pt-0 overflow-auto relative">
    {#if note && renderedContent}
      <div bind:this={previewElement} class="prose prose-sm dark:prose-invert max-w-none">
        {@html renderedContent}
      </div>
    {:else if note}
      <div class="text-muted-foreground text-center py-8">
        <p>No content to display</p>
      </div>
    {:else}
      <div class="text-muted-foreground text-center py-8">
        <p>Select a note to view</p>
      </div>
    {/if}
    {#if note}
      <div class="absolute bottom-2 left-6 text-xs text-muted-foreground pointer-events-none">
        {note.path}
      </div>
    {/if}
  </CardContent>
</Card>

<style>
  :global(.markdown-preview .prose) {
    color: hsl(var(--foreground));
  }

  :global(.markdown-preview .prose h1),
  :global(.markdown-preview .prose h2),
  :global(.markdown-preview .prose h3),
  :global(.markdown-preview .prose h4),
  :global(.markdown-preview .prose h5),
  :global(.markdown-preview .prose h6) {
    color: hsl(var(--foreground));
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  :global(.markdown-preview .prose h1) {
    font-size: 2em;
    border-bottom: 1px solid hsl(var(--border));
    padding-bottom: 0.3em;
  }

  :global(.markdown-preview .prose h2) {
    font-size: 1.5em;
    border-bottom: 1px solid hsl(var(--border));
    padding-bottom: 0.3em;
  }

  :global(.markdown-preview .prose p) {
    margin-top: 1em;
    margin-bottom: 1em;
    line-height: 1.75;
  }

  :global(.markdown-preview .prose a) {
    color: hsl(var(--primary));
    text-decoration: underline;
  }

  :global(.markdown-preview .prose a:hover) {
    color: hsl(var(--primary) / 0.8);
  }

  :global(.markdown-preview .prose code) {
    background-color: hsl(var(--muted));
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  :global(.markdown-preview .prose pre) {
    background-color: hsl(var(--muted));
    padding: 1em;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-top: 1em;
    margin-bottom: 1em;
  }

  :global(.markdown-preview .prose pre code) {
    background-color: transparent;
    padding: 0;
  }

  :global(.markdown-preview .prose blockquote) {
    border-left: 4px solid hsl(var(--border));
    padding-left: 1em;
    margin-left: 0;
    color: hsl(var(--muted-foreground));
    font-style: italic;
  }

  :global(.markdown-preview .prose ul),
  :global(.markdown-preview .prose ol) {
    margin-top: 1em;
    margin-bottom: 1em;
    padding-left: 1.5em;
  }

  :global(.markdown-preview .prose li) {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  :global(.markdown-preview .prose img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin-top: 1em;
    margin-bottom: 1em;
  }

  :global(.markdown-preview .prose table) {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1em;
    margin-bottom: 1em;
  }

  :global(.markdown-preview .prose th),
  :global(.markdown-preview .prose td) {
    border: 1px solid hsl(var(--border));
    padding: 0.5em;
  }

  :global(.markdown-preview .prose th) {
    background-color: hsl(var(--muted));
    font-weight: 600;
  }

  :global(.markdown-preview .prose hr) {
    border: none;
    border-top: 1px solid hsl(var(--border));
    margin: 2em 0;
  }

  :global(.markdown-preview .prose .wiki-link) {
    color: #7c3aed;
    text-decoration: none;
    font-weight: 500;
  }

  :global(.markdown-preview .prose .wiki-link:hover) {
    text-decoration: underline;
    color: #6d28d9;
  }

  :global(.dark .markdown-preview .prose .wiki-link) {
    color: #a78bfa;
  }

  :global(.dark .markdown-preview .prose .wiki-link:hover) {
    color: #c4b5fd;
  }
</style>

