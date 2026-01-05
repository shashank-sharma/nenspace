<!--
  Activity Test Page
  Standalone test page for activity tracking functionality
-->

<script lang="ts">
  import { onMount } from 'svelte'
  import ActivityTest from './ActivityTest.svelte'
  import ActivitySettings from './ActivitySettings.svelte'
  import { ActivityService } from '../services/activity.service'
  import { Settings, Activity, Home } from 'lucide-svelte'

  let currentTab: 'test' | 'settings' = 'test'
  let isInitialized = false

  onMount(async () => {
    try {
      await ActivityService.initialize()
      isInitialized = true
    } catch (error) {
      console.error('Failed to initialize activity service:', error)
    }
  })

  function switchTab(tab: 'test' | 'settings') {
    currentTab = tab
  }
</script>

<div class="activity-test-page">
  <div class="header">
    <div class="header-content">
      <div class="title">
        <Activity class="icon" />
        <h1>Activity Tracking</h1>
      </div>
      <div class="tabs">
        <button 
          class="tab-button" 
          class:active={currentTab === 'test'}
          on:click={() => switchTab('test')}
        >
          <Activity class="icon" />
          <span>Test</span>
        </button>
        <button 
          class="tab-button" 
          class:active={currentTab === 'settings'}
          on:click={() => switchTab('settings')}
        >
          <Settings class="icon" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  </div>

  <div class="content">
    {#if !isInitialized}
      <div class="loading">
        <div class="spinner"></div>
        <p>Initializing activity service...</p>
      </div>
    {:else if currentTab === 'test'}
      <ActivityTest />
    {:else if currentTab === 'settings'}
      <ActivitySettings />
    {/if}
  </div>

  <div class="footer">
    <div class="instructions">
      <h3>Quick Start Guide</h3>
      <ol>
        <li>Make sure you're logged in and have a browser profile selected</li>
        <li>Go to Settings tab and enable activity tracking</li>
        <li>Navigate to different websites to see activity being tracked</li>
        <li>Use the Test tab to monitor current activity status</li>
        <li>Check browser console for detailed logs</li>
      </ol>
    </div>
  </div>
</div>

<style>
  .activity-test-page {
    min-height: 100vh;
    background: var(--background, #ffffff);
    color: var(--text, #111827);
  }

  .header {
    background: var(--background-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    padding: 1rem 0;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .title .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .tab-button .icon {
    width: 1rem;
    height: 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    background: var(--background, #ffffff);
    color: var(--text-muted, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }

  .tab-button:hover:not(.active) {
    background: var(--background-hover, #f9fafb);
  }

  .tab-button.active {
    background: var(--primary, #3b82f6);
    color: white;
    border-color: var(--primary, #3b82f6);
  }

  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .footer {
    background: var(--background-secondary, #f9fafb);
    border-top: 1px solid var(--border-color, #e5e7eb);
    padding: 2rem 0;
  }

  .instructions {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .instructions h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .instructions ol {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-muted, #6b7280);
  }

  .instructions li {
    margin-bottom: 0.5rem;
  }

  @media (prefers-color-scheme: dark) {
    .activity-test-page {
      background: #1f2937;
      color: #f3f4f6;
    }

    .header {
      background: #111827;
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }

    .tab-button {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
      color: #9ca3af;
    }

    .tab-button:hover:not(.active) {
      background: rgba(255, 255, 255, 0.1);
    }

    .footer {
      background: #111827;
      border-top-color: rgba(255, 255, 255, 0.1);
    }

    .instructions {
      color: #d1d5db;
    }
  }
</style>
