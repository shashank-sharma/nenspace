<script lang="ts">
    import { Key, Trash2 } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Switch } from "$lib/components/ui/switch";
    import {
        Card,
        CardHeader,
        CardTitle,
        CardDescription,
        CardContent,
        CardFooter,
    } from "$lib/components/ui/card";
    import type { Token } from "../types";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher<{
        edit: Token;
        delete: string;
        toggleStatus: { id: string; status: boolean };
    }>();

    let { token } = $props<{
        token: Token;
    }>();

    function handleCardClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(".action-button")) {
            dispatch("edit", token);
        }
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString();
    }
</script>

<Card
    class="cursor-pointer hover:shadow-md transition-shadow"
    onclick={handleCardClick}
>
    <CardHeader>
        <CardTitle class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <Key class="w-4 h-4" />
                <span>{token.provider}</span>
            </div>
            <Badge variant={token.is_active ? "default" : "secondary"}>
                {token.is_active ? "Active" : "Disabled"}
            </Badge>
        </CardTitle>
        <CardDescription>{token.account}</CardDescription>
    </CardHeader>
    <CardContent>
        <div class="space-y-2">
            <div class="text-sm">
                <span class="font-medium">Created:</span>
                {formatDate(token.created)}
            </div>
            {#if token.expiry}
                <div class="text-sm">
                    <span class="font-medium">Expires:</span>
                    {formatDate(token.expiry)}
                </div>
            {/if}
            {#if token.scope}
                <div class="text-sm">
                    <span class="font-medium">Scope:</span>
                    {token.scope}
                </div>
            {/if}
        </div>
    </CardContent>
    <CardFooter class="justify-between">
        <div class="flex items-center gap-2 action-button">
            <Switch
                checked={token.is_active}
                onCheckedChange={() =>
                    dispatch("toggleStatus", {
                        id: token.id,
                        status: token.is_active,
                    })}
            />
            <span class="text-sm">
                {token.is_active ? "Active" : "Disabled"}
            </span>
        </div>
        <Button
            variant="destructive"
            size="icon"
            class="action-button"
            onclick={() => dispatch("delete", token.id)}
        >
            <Trash2 class="w-4 h-4" />
        </Button>
    </CardFooter>
</Card>
