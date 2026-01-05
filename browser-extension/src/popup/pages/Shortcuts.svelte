<!--
  Shortcuts Page
  Displays keyboard shortcuts and hotkeys for the browser extension
-->

<script lang="ts">
  import { Keyboard, Mouse, Zap, Command, Settings, Activity, History } from 'lucide-svelte'
  
  export let onBack: () => void
  
  // Shortcut categories
  const shortcutCategories = [
    {
      title: 'General',
      icon: Keyboard,
      shortcuts: [
        {
          keys: ['Ctrl', 'Shift', 'N'],
          description: 'Open extension popup',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'N'],
          description: 'Open extension popup',
          platform: 'macOS'
        },
        {
          keys: ['Ctrl', 'Shift', 'S'],
          description: 'Open sync settings',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'S'],
          description: 'Open sync settings',
          platform: 'macOS'
        }
      ]
    },
    {
      title: 'Activity Tracking',
      icon: Activity,
      shortcuts: [
        {
          keys: ['Ctrl', 'Shift', 'A'],
          description: 'Toggle activity tracking',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'A'],
          description: 'Toggle activity tracking',
          platform: 'macOS'
        },
        {
          keys: ['Ctrl', 'Shift', 'R'],
          description: 'Force sync activity data',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'R'],
          description: 'Force sync activity data',
          platform: 'macOS'
        }
      ]
    },
    {
      title: 'History Sync',
      icon: History,
      shortcuts: [
        {
          keys: ['Ctrl', 'Shift', 'H'],
          description: 'Sync browser history',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'H'],
          description: 'Sync browser history',
          platform: 'macOS'
        },
        {
          keys: ['Ctrl', 'Shift', 'F'],
          description: 'Full history sync',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'F'],
          description: 'Full history sync',
          platform: 'macOS'
        }
      ]
    },
    {
      title: 'Navigation',
      icon: Mouse,
      shortcuts: [
        {
          keys: ['Ctrl', 'Shift', 'D'],
          description: 'Open dashboard',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'D'],
          description: 'Open dashboard',
          platform: 'macOS'
        },
        {
          keys: ['Ctrl', 'Shift', 'P'],
          description: 'Open settings',
          platform: 'Windows/Linux'
        },
        {
          keys: ['Cmd', 'Shift', 'P'],
          description: 'Open settings',
          platform: 'macOS'
        }
      ]
    }
  ]
  
  // Get platform-specific shortcuts
  function getPlatformShortcuts(shortcuts: any[]) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    return shortcuts.filter(shortcut => 
      isMac ? shortcut.platform === 'macOS' : shortcut.platform === 'Windows/Linux'
    )
  }
</script>

<div class="max-w-[400px] mx-auto p-6">
  <!-- Header -->
  <div class="section-header">
    <button class="back-btn" on:click={onBack}>←</button>
    <h1 class="section-title">Keyboard Shortcuts</h1>
  </div>

  <div class="flex flex-col gap-6">
    <!-- Intro Section -->
    <div class="card p-5">
      <span class="card-corner-bl"></span>
      <span class="card-corner-br"></span>
      
      <div class="flex gap-4">
        <div class="w-12 h-12 flex items-center justify-center bg-muted shrink-0">
          <Zap size={24} class="text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-foreground mb-2">Quick Actions</h2>
          <p class="text-sm text-muted-foreground leading-relaxed">
            Use these keyboard shortcuts to quickly access extension features and manage your data sync.
          </p>
        </div>
      </div>
    </div>

    <!-- Shortcut Categories -->
    <div class="flex flex-col gap-4">
      {#each shortcutCategories as category}
        <div class="card p-0 overflow-hidden">
          <span class="card-corner-bl"></span>
          <span class="card-corner-br"></span>
          
          <!-- Category Header -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/50">
            <div class="w-8 h-8 flex items-center justify-center bg-card shrink-0">
              <svelte:component this={category.icon} size={20} class="text-green-500" />
            </div>
            <h3 class="text-base font-semibold text-foreground">{category.title}</h3>
          </div>
          
          <!-- Shortcuts List -->
          <div class="px-5 py-4">
            {#each getPlatformShortcuts(category.shortcuts) as shortcut, index}
              <div class="flex items-center justify-between gap-4 py-3 {index < getPlatformShortcuts(category.shortcuts).length - 1 ? 'border-b border-border/50' : ''}">
                <div class="flex items-center gap-1 shrink-0">
                  {#each shortcut.keys as key, keyIndex}
                    <kbd class="kbd">{key}</kbd>
                    {#if keyIndex < shortcut.keys.length - 1}
                      <span class="text-xs text-muted-foreground mx-0.5">+</span>
                    {/if}
                  {/each}
                </div>
                <div class="text-sm text-muted-foreground text-right flex-1">
                  {shortcut.description}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Info Cards -->
    <div class="flex flex-col gap-3">
      <div class="card p-4">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        
        <div class="flex gap-3">
          <div class="w-8 h-8 flex items-center justify-center bg-muted shrink-0">
            <Command size={20} class="text-blue-400" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-1">Custom Shortcuts</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              You can customize these shortcuts in your browser's extension settings. Go to <strong class="text-primary">chrome://extensions/shortcuts</strong> to modify them.
            </p>
          </div>
        </div>
      </div>
      
      <div class="card p-4">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        
        <div class="flex gap-3">
          <div class="w-8 h-8 flex items-center justify-center bg-muted shrink-0">
            <Settings size={20} class="text-primary" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-1">Global Shortcuts</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Some shortcuts work globally across all browser windows and tabs, while others only work when the extension popup is open.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
