<script lang="ts">
    // FLOATING STATUS WIDGET - Tauri-only component
    // Uses proper services and styling, isolated from main app
    import "$lib/styles/minimal-widget.css";
    import FloatingStatusWidget from "$lib/components/FloatingStatusWidget.svelte";
</script>

<svelte:head>
    <!-- Force transparent background for the webview -->
    <style>
        html,
        body {
            background-color: transparent !important;
            background: transparent !important;
        }
    </style>
</svelte:head>

<FloatingStatusWidget />
