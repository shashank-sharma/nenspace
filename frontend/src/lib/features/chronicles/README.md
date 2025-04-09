# Chronicles Components

This directory contains interactive background components for visual storytelling.

## ChronicleBackground

An interactive seasonal background component that displays different weather effects and color schemes based on the selected season. The component provides a visually appealing backdrop that can be used in various applications such as calendars, weather apps, or seasonal landing pages.

### Features

- Four seasonal themes: Winter, Spring, Summer, and Autumn
- Interactive visual elements (snow, rain, rainbow, flowers, sun)
- Customizable size and control options
- Smooth transitions between seasons
- Fully responsive

### Usage

```svelte
<script>
  import ChronicleBackground from '$lib/features/chronicles/components/ChronicleBackground.svelte';
</script>

<!-- Basic usage with defaults -->
<ChronicleBackground />

<!-- Custom configuration -->
<ChronicleBackground 
  startingSeason="Summer" 
  enableControls={false} 
  height="300px" 
  width="100%" 
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `startingSeason` | `'Winter' \| 'Spring' \| 'Summer' \| 'Autumn'` | `'Winter'` | The initial season to display |
| `enableControls` | `boolean` | `true` | Whether to show the season selection buttons |
| `height` | `string` | `'100%'` | The height of the component |
| `width` | `string` | `'100%'` | The width of the component |

### Example

To see a demo of the ChronicleBackground component in action, visit the [demo page](/demo/chronicle-background).

### Implementation Details

The component uses a combination of:

- Tailwind CSS for spacing, layout, and button styling
- CSS variables for theming based on season
- CSS animations for dynamic elements (snow, rain, rainbow)
- Svelte's reactivity for state management
- TypeScript for type safety

### Accessibility

The season selection buttons are keyboard navigable and properly labeled for screen readers. 