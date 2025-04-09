# Debug Panel System

This directory contains the debug panel implementation for the application. The debug panel provides a way to adjust settings and debugging options for different parts of the application.

## Architecture

The debug panel is structured as follows:

- `DebugLauncher.svelte`: The entry point that displays the debug button and loads the panel
- `DebugPanel.svelte`: A wrapper component that manages the panel state
- `DebugContainer.svelte`: The main container for the debug panel UI
- `sections/`: Contains individual debug setting components
- `registry/`: Contains the registry for page-specific debug settings

## Page Debug Settings

The system supports page-specific debug settings that are only shown when the user is viewing a particular page. This is handled through the `pageDebugRegistry.ts` file, which maps URL patterns to debug setting components.

### Adding New Page Debug Settings

To add debug settings for a new page:

1. **Create a new component**

   Create a new component in the `sections/` directory. The easiest way is to copy `TemplateDebugSettings.svelte` and customize it:

   ```svelte
   <!-- src/lib/components/debug/sections/MyPageDebugSettings.svelte -->
   <script lang="ts">
     // Follow the steps in the template file
     // ...
   </script>

   <div class="space-y-4">
     <!-- Your UI goes here -->
   </div>
   ```

2. **Register your component**

   Add your component to the page debug registry in `registry/pageDebugRegistry.ts`:

   ```typescript
   import MyPageDebugSettings from '../sections/MyPageDebugSettings.svelte';

   export const pageDebugRegistry: PageDebugSection[] = [
     // ... existing entries ...
     
     // Your new entry
     {
       id: "my-page-debug",
       title: "My Page Settings",
       component: MyPageDebugSettings,
       urlPattern: /\/my-page/i,  // Adjust this to match your page's URL
       expanded: true,
       priority: 10,
     },
   ];
   ```

3. **Implement your settings**

   In your component:
   
   - Use unique storage keys to avoid conflicts
   - Follow the pattern of having an "enabled" toggle
   - Store settings in localStorage
   - Use reactive stores to make settings easily accessible

### Best Practices

1. **Naming Conventions**
   - Name your component file `[PageName]DebugSettings.svelte`
   - Use descriptive storage keys with prefixes like `debugPageName`

2. **State Management**
   - Use Svelte's writable stores for state
   - Always provide defaults for all settings
   - Persist settings to localStorage
   - Reset to defaults when debug is disabled

3. **User Interface**
   - Group related settings
   - Provide clear labels and visual feedback
   - Use consistent UI components from the component library
   - Add help text when appropriate

4. **URL Patterns**
   - Make URL patterns specific enough to only show on relevant pages
   - Test your patterns with different URL variations

## Example Usage

Here's how a component might consume debug settings:

```svelte
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Get debug settings from localStorage
  let showDebugInfo = false;
  
  onMount(() => {
    if (browser) {
      // Read your debug settings
      const settings = JSON.parse(localStorage.getItem('myPageDebugSettings') || '{}');
      showDebugInfo = settings.showDebugInfo || false;
    }
  });
</script>

<div>
  <!-- Normal component content -->
  
  {#if showDebugInfo}
    <div class="debug-info">
      <!-- Debug information shown only when enabled -->
    </div>
  {/if}
</div>
```

## Troubleshooting

If your debug settings aren't appearing:

1. Check that your URL pattern matches the current page
2. Verify that your component is properly imported and registered
3. Look for any console errors related to your component
4. Try adding `console.log` statements to debug

---

For any questions or improvements, please contact the development team. 