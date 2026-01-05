<script lang="ts">
    import * as Drawer from '$lib/components/ui/drawer';
    import { workflowEditorStore } from '../stores';
    import ConnectorConfigPanel from './ConnectorConfigPanel.svelte';
    import type { FlowNode } from '../types';

    let drawerOpen = $state(false);
    let previousSelectedNodeId = $state<string | null>(null);

    $effect(() => {
        const selectedNode = workflowEditorStore.selectedNode;
        if (selectedNode) {
            drawerOpen = true;
            previousSelectedNodeId = selectedNode.id;
        } else {
            drawerOpen = false;
            previousSelectedNodeId = null;
        }
    });

    function handleClose() {
        workflowEditorStore.selectNode(null);
    }

    $effect(() => {
        if (!drawerOpen && previousSelectedNodeId && workflowEditorStore.selectedNode?.id === previousSelectedNodeId) {

            workflowEditorStore.selectNode(null);
        }
    });

    const selectedNode = $derived(workflowEditorStore.selectedNode);
</script>

<Drawer.Root bind:open={drawerOpen}>
    <Drawer.Content class="max-h-[90vh] flex flex-col">
        <Drawer.Header class="flex-shrink-0">
            <Drawer.Title>
                {#if selectedNode}
                    {selectedNode.data.label || 'Node Configuration'}
                {:else}
                    Node Configuration
                {/if}
            </Drawer.Title>
            {#if selectedNode?.data.nodeType}
                <Drawer.Description class="text-xs text-muted-foreground">
                    {selectedNode.data.nodeType}
                </Drawer.Description>
            {/if}
        </Drawer.Header>

        <div class="flex-1 overflow-y-auto min-h-0 px-4 pb-4 -mx-4">
            <div class="px-4">
                {#if selectedNode}
                    <ConnectorConfigPanel
                        node={selectedNode}
                        onClose={handleClose}
                        hideHeader={true}
                    />
                {/if}
            </div>
        </div>
    </Drawer.Content>
</Drawer.Root>

