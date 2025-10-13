# Platform Components & Utilities

This directory contains components and utilities for managing Tauri-first architecture with PWA companion support.

## Architecture Overview

**Nen Space** uses a **Tauri-first** architecture:
- **Tauri Desktop**: Primary platform (80% dev effort) - Full features
- **PWA/Web**: Companion platform (20% dev effort) - Core features + mobile access

## Core Utilities

### Platform Detection (`platform.ts`)

```typescript
import { isTauri, isPWA, getPlatform, isMobile } from '$lib/utils/platform';

// Check platform
if (isTauri()) {
    // Use Tauri APIs
    await invoke('native_file_picker');
} else {
    // Use web APIs
    fileInput.click();
}

// Get platform info
const platform = getPlatform(); // 'tauri' | 'pwa' | 'web'
const isMobileDevice = isMobile();
```

### Feature Capabilities (`feature-capabilities.ts`)

```typescript
import { 
    getFeatureCapability, 
    isFeatureAvailable,
    hasFullFeature 
} from '$lib/utils/feature-capabilities';

// Check if feature is available
if (isFeatureAvailable('drawings')) {
    // Show feature
}

// Get capability level
const capability = getFeatureCapability('foodLog');
// Returns: 'full' | 'limited' | 'view-only' | 'disabled'

// Check for full functionality
if (hasFullFeature('drawings')) {
    // Enable full editor
} else {
    // Show view-only mode
}
```

## UI Components

### 1. PlatformGuard

Conditionally render content based on platform capabilities.

```svelte
<script>
    import PlatformGuard from '$lib/components/platform/PlatformGuard.svelte';
</script>

<!-- Show full editor only if feature is available -->
<PlatformGuard feature="drawings" featureName="Drawing Editor">
    <DrawingEditor />
</PlatformGuard>

<!-- Show different content based on capability -->
<PlatformGuard 
    feature="foodLog" 
    requiredCapability="full"
    featureName="Food Log"
>
    <FullFoodLogEditor />
    
    {#snippet fallback()}
        <BasicFoodLogView />
    {/snippet}
</PlatformGuard>
```

### 2. FeatureBadge

Display capability level badges.

```svelte
<script>
    import FeatureBadge from '$lib/components/platform/FeatureBadge.svelte';
    import { getFeatureCapability } from '$lib/utils/feature-capabilities';
    
    const capability = getFeatureCapability('drawings');
</script>

<div class="flex items-center gap-2">
    <h2>Drawing Tool</h2>
    <FeatureBadge {capability} />
    <!-- Shows: "Desktop Only", "Limited", "View Only", or nothing -->
</div>
```

### 3. FeatureRestrictionBanner

Show informative banners for restricted features.

```svelte
<script>
    import FeatureRestrictionBanner from '$lib/components/platform/FeatureRestrictionBanner.svelte';
    import { getFeatureCapability } from '$lib/utils/feature-capabilities';
    
    const capability = getFeatureCapability('drawings');
</script>

<FeatureRestrictionBanner 
    {capability}
    featureName="Drawing Editor"
    customMessage="Advanced drawing features require the desktop app."
/>
<!-- Shows banner with "Get Desktop App" button if restricted -->
```

## Feature Matrix

Defined in `feature-capabilities.ts`:

| Feature | Tauri | PWA | Web |
|---------|-------|-----|-----|
| Calendar | Full | Full | Full |
| Tasks | Full | Full | Full |
| Chronicles | Full | Full | Full |
| Food Log | Full | Full | Limited |
| Drawings | Full | View Only | View Only |
| File Sync | Full | Disabled | Disabled |
| Automation | Full | Disabled | Disabled |

## Usage Examples

### Example 1: Feature Page with Platform Detection

```svelte
<!-- DrawingsPage.svelte -->
<script>
    import { getFeatureCapability } from '$lib/utils/feature-capabilities';
    import PlatformGuard from '$lib/components/platform/PlatformGuard.svelte';
    import FeatureBadge from '$lib/components/platform/FeatureBadge.svelte';
    
    const capability = getFeatureCapability('drawings');
</script>

<div class="page">
    <header class="flex items-center gap-2">
        <h1>Drawings</h1>
        <FeatureBadge {capability} />
    </header>
    
    <PlatformGuard feature="drawings" featureName="Drawing Editor">
        <!-- Full editor for Tauri -->
        <FullDrawingEditor />
        
        {#snippet fallback()}
            <!-- View-only for PWA/Web -->
            <DrawingViewer />
        {/snippet}
    </PlatformGuard>
</div>
```

### Example 2: Conditional Features

```svelte
<script>
    import { isTauri } from '$lib/utils/platform';
    import { hasFullFeature } from '$lib/utils/feature-capabilities';
</script>

<div class="actions">
    <Button>View</Button>
    <Button>Share</Button>
    
    {#if hasFullFeature('drawings')}
        <Button>Edit</Button>
        <Button>Export to File</Button>
    {/if}
    
    {#if isTauri()}
        <Button>Open in System Editor</Button>
    {/if}
</div>
```

### Example 3: Platform-Specific API Usage

```typescript
// file-utils.ts
import { isTauri } from '$lib/utils/platform';
import { invoke } from '@tauri-apps/api/tauri';

export async function pickFile(): Promise<string | null> {
    if (isTauri()) {
        // Use Tauri native file picker
        return await invoke('pick_file');
    } else {
        // Use web file input
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                resolve(file ? URL.createObjectURL(file) : null);
            };
            input.click();
        });
    }
}
```

## Adding New Features

When adding a new feature:

1. **Add to Feature Matrix** (`feature-capabilities.ts`):
```typescript
export const featureMatrix: Record<string, Feature> = {
    // ... existing features
    
    myNewFeature: {
        id: 'myNewFeature',
        name: 'My New Feature',
        description: 'Description of the feature',
        tauri: 'full',      // Full functionality
        pwa: 'limited',     // Limited functionality
        web: 'view-only',   // View only
    },
};
```

2. **Use PlatformGuard in UI**:
```svelte
<PlatformGuard feature="myNewFeature" featureName="My Feature">
    <MyFeatureComponent />
</PlatformGuard>
```

3. **Handle Platform-Specific Logic**:
```typescript
if (isTauri()) {
    // Tauri-specific implementation
} else {
    // Web/PWA implementation
}
```

## Best Practices

1. **Always check capabilities** before showing features
2. **Provide fallbacks** for unavailable features
3. **Show clear messaging** when features are restricted
4. **Test on all platforms** (Tauri, PWA, Web)
5. **Prioritize Tauri** for complex features
6. **Keep PWA simple** for mobile companion use

## Debug Panel

Platform info is available in the Debug Panel:
- **Platform Info** section shows current platform
- **PWA Actions** section adapts based on platform
- Install prompt disabled when running in Tauri

