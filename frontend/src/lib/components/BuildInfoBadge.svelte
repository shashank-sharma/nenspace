<script lang="ts">
    // Defaults:
    // - visible in development
    // - can be forced in prod by setting VITE_SHOW_BUILD_INFO=true
    const isEnabled =
        import.meta.env.DEV || import.meta.env.VITE_SHOW_BUILD_INFO === "true";

    const version = __APP_VERSION__;
    const commit = __GIT_COMMIT__;
    const buildTime = __BUILD_TIME__;

    const label = `v${version} · ${commit} · ${buildTime}`;
</script>

{#if isEnabled}
    <div
        class="fixed bottom-2 right-2 z-[9999] pointer-events-none select-text"
    >
        <div
            class="pointer-events-auto px-2 py-1 font-mono text-[10px] leading-tight text-muted-foreground/40"
            title={label}
        >
            {label}
        </div>
    </div>
{/if}

