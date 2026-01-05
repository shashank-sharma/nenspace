<script lang="ts">
  import { onMount } from 'svelte'
  import { vaultStore, notesStore } from '../stores'
  import { getStorageAdapter } from '../services/storage'
  import type { FileTreeNode } from '../types'
  import { createEventDispatcher } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { FilePlus, ChevronRight, ChevronDown, Folder, FileText } from 'lucide-svelte'
  import CreateNoteDialog from './CreateNoteDialog.svelte'
  import { isAutoCancelledError } from '../utils/error-handler'

  const dispatch = createEventDispatcher<{ noteSelect: { path: string } }>()

  let tree = $state<FileTreeNode | null>(null)
  let expanded = $state<Set<string>>(new Set())
  let showCreateDialog = $state(false)
  let createInFolder = $state('')
  let lastVaultId = $state<string | null>(null)
  let loadingTree = $state(false)
  let loadTreePromise: Promise<void> | null = null

  $effect(() => {
    if (vaultStore.activeVault && vaultStore.activeVault.id !== lastVaultId) {
      lastVaultId = vaultStore.activeVault.id
      loadTree()
    }
  })

  $effect(() => {
    if (notesStore.notes.length > 0) {
      buildTreeFromNotes()
    }
  })

  async function loadTree() {
    if (!vaultStore.activeVault || loadingTree) return

    if (loadTreePromise) {
      return loadTreePromise
    }

    loadingTree = true
    loadTreePromise = (async () => {
      try {
        const storage = await getStorageAdapter()
        tree = await storage.getFileTree(vaultStore.activeVault!.id)
      } catch (err) {
        if (!isAutoCancelledError(err)) {
        }
      } finally {
        loadingTree = false
        loadTreePromise = null
      }
    })()

    return loadTreePromise
  }

  function buildTreeFromNotes() {
    if (!vaultStore.activeVault) return

    const rootTree: FileTreeNode = {
      name: 'root',
      path: '',
      type: 'folder',
      children: []
    }

    const pathMap = new Map<string, FileTreeNode>()
    pathMap.set('', rootTree)

    for (const note of notesStore.notes) {
      const parts = note.path.split('/').filter(Boolean)
      let currentPath = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part

        if (!pathMap.has(currentPath)) {
          const isFile = i === parts.length - 1 && note.path.endsWith('.md')
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            metadata: isFile ? note : undefined
          }

          pathMap.set(currentPath, node)
          const parent = pathMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        }
      }
    }

    tree = rootTree
  }

  function toggleExpand(path: string) {
    if (expanded.has(path)) {
      expanded.delete(path)
    } else {
      expanded.add(path)
    }
    expanded = new Set(expanded)
  }

  function handleNodeClick(node: FileTreeNode) {
    if (node.type === 'file' && node.metadata) {
      dispatch('noteSelect', { path: node.path })
    } else if (node.type === 'folder') {
      toggleExpand(node.path)
    }
  }

  function handleCreateNote(folder?: string) {
    createInFolder = folder || ''
    showCreateDialog = true
  }

  function renderTreeNodes(nodes: FileTreeNode[], depth = 0): FileTreeNode[] {
    const result: FileTreeNode[] = []
    for (const node of nodes) {
      result.push(node)
      if (node.type === 'folder' && expanded.has(node.path) && node.children) {
        result.push(...renderTreeNodes(node.children, depth + 1))
      }
    }
    return result
  }

  const activeNotePath = $derived(notesStore.activeNote?.path || '')
  let scrollContainer: HTMLDivElement
  let lastExpandedPath = $state<string | null>(null)

  function expandPathToFile(filePath: string) {
    if (!filePath) return false

    const parts = filePath.split('/').filter(Boolean)
    const pathsToExpand: string[] = []
    let currentPath = ''

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
      pathsToExpand.push(currentPath)
    }

    const needsExpansion = pathsToExpand.some(path => !expanded.has(path))
    if (!needsExpansion) {
      return false
    }

    const newExpanded = new Set(expanded)
    for (const path of pathsToExpand) {
      newExpanded.add(path)
    }
    expanded = newExpanded
    return true
  }

  $effect(() => {
    if (activeNotePath && tree && activeNotePath !== lastExpandedPath) {

      const didExpand = expandPathToFile(activeNotePath)
      lastExpandedPath = activeNotePath

      if (didExpand) {

        setTimeout(() => {
          const activeElement = scrollContainer?.querySelector(`[data-file-path="${activeNotePath}"]`)
          if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 150)
      } else {

        setTimeout(() => {
          const activeElement = scrollContainer?.querySelector(`[data-file-path="${activeNotePath}"]`)
          if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 50)
      }
    } else if (!activeNotePath) {
      lastExpandedPath = null
    }
  })
</script>

<div class="file-explorer h-full flex flex-col">
  <div bind:this={scrollContainer} class="flex-1 overflow-auto p-2">
    {#if !vaultStore.activeVault}
      <div class="text-sm text-muted-foreground p-4 text-center">
        No vault selected
      </div>
    {:else if tree && (tree.children || []).length > 0}
      <div class="space-y-1">
        {#each (tree.children || []) as child}
          {@const isExpanded = expanded.has(child.path)}
          {@const indent = (child.path.split('/').filter(Boolean).length - 1) * 12}
          <div class="flex items-center gap-1 group">
            <div
              data-file-path={child.type === 'file' ? child.path : undefined}
              class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer flex-1 min-w-0 {child.type === 'file' && activeNotePath === child.path ? 'bg-accent font-medium' : ''}"
              style="padding-left: {indent}px"
              on:click={() => handleNodeClick(child)}
            >
              {#if child.type === 'folder'}
                <button
                  class="p-0.5 hover:bg-accent rounded"
                  on:click|stopPropagation={() => toggleExpand(child.path)}
                >
                  {#if isExpanded}
                    <ChevronDown class="w-3 h-3" />
                  {:else}
                    <ChevronRight class="w-3 h-3" />
                  {/if}
                </button>
              {:else}
                <span class="w-4"></span>
              {/if}
              {#if child.type === 'folder'}
                <Folder class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {:else}
                <FileText class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {/if}
              <span class="text-sm truncate flex-1">{child.name}</span>
            </div>
            {#if child.type === 'folder'}
              <div
                class="opacity-0 group-hover:opacity-100"
                on:click|stopPropagation={() => handleCreateNote(child.path)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 w-6 p-0"
                  title="Create note in folder"
                >
                  <FilePlus class="w-3 h-3" />
                </Button>
              </div>
            {/if}
          </div>

          {#if child.type === 'folder' && isExpanded && child.children}
            {#each child.children as subChild}
              {@const subIsExpanded = expanded.has(subChild.path)}
              {@const subIndent = (subChild.path.split('/').filter(Boolean).length - 1) * 12}
              <div class="flex items-center gap-1 group">
                <div
                  data-file-path={subChild.type === 'file' ? subChild.path : undefined}
                  class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer flex-1 min-w-0 {subChild.type === 'file' && activeNotePath === subChild.path ? 'bg-accent font-medium' : ''}"
                  style="padding-left: {subIndent}px"
                  on:click={() => handleNodeClick(subChild)}
                >
                  {#if subChild.type === 'folder'}
                    <button
                      class="p-0.5 hover:bg-accent rounded"
                      on:click|stopPropagation={() => toggleExpand(subChild.path)}
                    >
                      {#if subIsExpanded}
                        <ChevronDown class="w-3 h-3" />
                      {:else}
                        <ChevronRight class="w-3 h-3" />
                      {/if}
                    </button>
                  {:else}
                    <span class="w-4"></span>
                  {/if}
                  {#if subChild.type === 'folder'}
                    <Folder class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {:else}
                    <FileText class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {/if}
                  <span class="text-sm truncate flex-1">{subChild.name}</span>
                </div>
              </div>

              {#if subChild.type === 'folder' && subIsExpanded && subChild.children}
                {#each subChild.children as nestedChild}
                  {@const nestedIndent = (nestedChild.path.split('/').filter(Boolean).length - 1) * 12}
                  <div class="flex items-center gap-1 group">
                    <div
                      data-file-path={nestedChild.type === 'file' ? nestedChild.path : undefined}
                      class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer flex-1 min-w-0 {nestedChild.type === 'file' && activeNotePath === nestedChild.path ? 'bg-accent font-medium' : ''}"
                      style="padding-left: {nestedIndent}px"
                      on:click={() => handleNodeClick(nestedChild)}
                    >
                      {#if nestedChild.type === 'folder'}
                        <button
                          class="p-0.5 hover:bg-accent rounded"
                          on:click|stopPropagation={() => toggleExpand(nestedChild.path)}
                        >
                          {#if expanded.has(nestedChild.path)}
                            <ChevronDown class="w-3 h-3" />
                          {:else}
                            <ChevronRight class="w-3 h-3" />
                          {/if}
                        </button>
                      {:else}
                        <span class="w-4"></span>
                      {/if}
                      {#if nestedChild.type === 'folder'}
                        <Folder class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {:else}
                        <FileText class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {/if}
                      <span class="text-sm truncate flex-1">{nestedChild.name}</span>
                    </div>
                  </div>
                {/each}
              {/if}
            {/each}
          {/if}
        {/each}
      </div>
    {:else}
      <div class="text-sm text-muted-foreground p-4 text-center space-y-2">
        <p>No notes found</p>
        <Button
          variant="outline"
          size="sm"
          on:click={() => handleCreateNote()}
        >
          <FilePlus class="w-4 h-4 mr-2" />
          Create your first note
        </Button>
      </div>
    {/if}
  </div>

  <CreateNoteDialog bind:open={showCreateDialog} folder={createInFolder} />
</div>
