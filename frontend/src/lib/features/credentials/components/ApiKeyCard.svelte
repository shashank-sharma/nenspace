<script lang="ts">
    import type { ApiKey } from "../types";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Switch } from "$lib/components/ui/switch";
    import { Badge } from "$lib/components/ui/badge";
    import { Eye, EyeOff, Edit, Trash2, BarChart3 } from "lucide-svelte";
    import UsageStatsCard from "./UsageStatsCard.svelte";
    import * as Dialog from "$lib/components/ui/dialog";

    interface Props {
        apiKey: ApiKey;
        onedit?: () => void;
        ondelete?: () => void;
        ontoggleStatus?: () => void;
    }

    let { apiKey, onedit, ondelete, ontoggleStatus } = $props<Props>();

    let showSecret = $state(false);
    let showStats = $state(false);
</script>

<Card.Root>
    <Card.Header>
        <div class="flex justify-between items-start">
            <div>
                <Card.Title>{apiKey.name}</Card.Title>
                <Card.Description>{apiKey.description}</Card.Description>
            </div>
            <Badge variant={apiKey.is_active ? "default" : "destructive"}>
                {apiKey.is_active ? "Active" : "Inactive"}
            </Badge>
        </div>
    </Card.Header>
    <Card.Content>
        <div class="space-y-2">
            <div>
                <h4 class="text-sm font-semibold">Secret</h4>
                <div class="flex items-center space-x-2">
                    <p class="text-muted-foreground font-mono text-xs">
                        {showSecret ? apiKey.secret : "••••••••••••••••••••"}
                    </p>
                    <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => (showSecret = !showSecret)}
                    >
                        {#if showSecret}
                            <EyeOff class="w-4 h-4" />
                        {:else}
                            <Eye class="w-4 h-4" />
                        {/if}
                    </Button>
                </div>
            </div>
            <div>
                <h4 class="text-sm font-semibold">Scopes</h4>
                <div class="flex flex-wrap gap-1 mt-1">
                    {#each apiKey.scopes as scope}
                        <Badge variant="secondary">{scope}</Badge>
                    {/each}
                </div>
            </div>
        </div>
    </Card.Content>
    <Card.Footer class="flex justify-between">
        <div class="flex items-center space-x-2">
            <Switch
                id="status-mode-{apiKey.id}"
                checked={apiKey.is_active}
                onclick={() => ontoggleStatus?.()}
            />
            <label for="status-mode-{apiKey.id}" class="text-sm">Active</label>
        </div>
        <div class="flex space-x-2">
            <Button
                variant="outline"
                size="icon"
                onclick={() => showStats = true}
                title="View usage statistics"
            >
                <BarChart3 class="w-4 h-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                onclick={() => onedit?.()}
            >
                <Edit class="w-4 h-4" />
            </Button>
            <Button
                variant="destructive"
                size="icon"
                onclick={() => ondelete?.()}
            >
                <Trash2 class="w-4 h-4" />
            </Button>
        </div>
    </Card.Footer>
</Card.Root>

<Dialog.Root bind:open={showStats}>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>Usage Statistics - {apiKey.name}</Dialog.Title>
            <Dialog.Description>
                View detailed usage statistics for this API key
            </Dialog.Description>
        </Dialog.Header>
        <div class="py-4">
            <UsageStatsCard 
                credentialType="api_key" 
                credentialId={apiKey.id} 
                showDetails={true}
            />
        </div>
    </Dialog.Content>
</Dialog.Root>
