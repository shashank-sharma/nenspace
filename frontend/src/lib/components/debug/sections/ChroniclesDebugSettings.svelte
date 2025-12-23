<script lang="ts">
    import { DebugService } from "$lib/services/debug.service.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";

    // This component will be used inside a page-specific component.
    // It registers its own debug controls with the DebugService.

    let showJson = $state(false);

    $effect(() => {
        DebugService.registerSection({
            id: "chronicles_page_debug",
            title: "Chronicles Page Debug",
            controls: [
                {
                    id: "show_json",
                    component: SwitchControl,
                    props: {
                        label: "Show State as JSON",
                        checked: showJson,
                        update: (v: boolean) => (showJson = v),
                    },
                },
            ],
        });

        return () => {
            DebugService.unregisterSection("chronicles_page_debug");
        };
    });
</script>

{#if showJson}
    <div
        class="p-2 mt-4 border rounded bg-muted/50 max-h-48 overflow-auto text-xs"
    >
        <pre>
            {JSON.stringify({ showJson }, null, 2)}
        </pre>
    </div>
{/if}
