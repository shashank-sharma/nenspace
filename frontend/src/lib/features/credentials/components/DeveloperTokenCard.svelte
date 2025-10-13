<script lang="ts">
    import { fade } from "svelte/transition";
    import { Edit, Trash2, Eye, EyeOff, Power } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import type { DeveloperToken } from "../types";
    import { DateUtil } from "$lib/utils";

    interface Props {
        token: DeveloperToken;
        onedit?: () => void;
        ondelete?: () => void;
        ontoggleStatus?: () => void;
    }

    let { token, onedit, ondelete, ontoggleStatus } = $props<Props>();

    let showToken = $state(false);
</script>

<div transition:fade={{ duration: 200 }}>
    <Card.Root class="h-full">
        <Card.Header>
            <div class="flex items-center justify-between">
                <Card.Title>{token.name}</Card.Title>
                <Badge
                    variant={token.is_active ? "default" : "destructive"}
                    class="ml-2"
                >
                    {token.is_active ? "Active" : "Inactive"}
                </Badge>
            </div>
            <Card.Description>
                Environment: {token.environment}
            </Card.Description>
        </Card.Header>
        <Card.Content>
            <div class="space-y-2">
                <div>
                    <p class="text-sm font-medium">Token</p>
                    <div class="flex items-center mt-1">
                        <p class="text-sm font-mono truncate flex-1">
                            {showToken ? token.token : "••••••••••••••••"}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => (showToken = !showToken)}
                        >
                            {#if showToken}
                                <EyeOff class="h-4 w-4" />
                            {:else}
                                <Eye class="h-4 w-4" />
                            {/if}
                        </Button>
                    </div>
                </div>
                <div>
                    <p class="text-sm font-medium">Created</p>
                    <p class="text-sm text-muted-foreground">
                        {DateUtil.formatRelative(token.created)}
                    </p>
                </div>
                {#if token.expires}
                    <div>
                        <p class="text-sm font-medium">Expires</p>
                        <p class="text-sm text-muted-foreground">
                            {DateUtil.formatRelative(token.expires)}
                        </p>
                    </div>
                {/if}
            </div>
        </Card.Content>
        <Card.Footer class="flex justify-between">
            <Button
                variant="ghost"
                size="sm"
                onclick={() => ontoggleStatus?.()}
            >
                <Power class="h-4 w-4 mr-2" />
                {token.is_active ? "Deactivate" : "Activate"}
            </Button>
            <div class="space-x-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => onedit?.()}
                >
                    <Edit class="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => ondelete?.()}
                >
                    <Trash2 class="h-4 w-4" />
                </Button>
            </div>
        </Card.Footer>
    </Card.Root>
</div>
