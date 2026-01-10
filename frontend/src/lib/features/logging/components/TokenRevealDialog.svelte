<script lang="ts">
    import { Copy, Check, Eye, EyeOff, ShieldAlert, Key } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import * as Tooltip from "$lib/components/ui/tooltip";
    import { toast } from "svelte-sonner";

    interface Props {
        open: boolean;
        token: string;
        projectName: string;
        onclose: () => void;
    }

    let { open = $bindable(), token, projectName, onclose } = $props<Props>();

    let copied = $state(false);
    let showToken = $state(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(token);
            copied = true;
            toast.success("Token copied to clipboard");
            setTimeout(() => {
                copied = false;
            }, 2000);
        } catch (err) {
            toast.error("Failed to copy token");
        }
    }

    function handleClose() {
        open = false;
        onclose();
    }
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Key class="h-6 w-6" />
            </div>
            <Dialog.Title class="text-center text-xl">Project Token Generated</Dialog.Title>
            <Dialog.Description class="text-center">
                Your new dev token for <strong>{projectName}</strong> is ready.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-6 py-4">

            <div class="flex items-start space-x-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                <ShieldAlert class="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div class="text-sm">
                    <p class="font-bold">Security Warning</p>
                    <p>This token will only be displayed <strong>once</strong>. If you lose it, you will need to generate a new one in the Credentials section.</p>
                </div>
            </div>

            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium">Dev Token</span>
                    <button
                        class="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        onclick={() => showToken = !showToken}
                    >
                        {#if showToken}
                            <EyeOff class="h-3 w-3" /> Hide
                        {:else}
                            <Eye class="h-3 w-3" /> Show
                        {/if}
                    </button>
                </div>
                <div class="relative flex items-center">
                    <div
                        class="w-full rounded-md border bg-muted px-4 py-3 font-mono text-sm break-all pr-12 min-h-[3rem] flex items-center cursor-pointer hover:bg-muted/80 transition-colors"
                        onclick={handleCopy}
                        role="button"
                        tabindex="0"
                        onkeydown={(e) => e.key === 'Enter' && handleCopy()}
                    >
                        {#if showToken}
                            {token}
                        {:else}
                            {"•".repeat(Math.min(token.length, 32))}
                        {/if}
                    </div>
                    <div class="absolute right-1 z-10">
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    class="h-8 w-8"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleCopy();
                                    }}
                                >
                                    {#if copied}
                                        <Check class="h-4 w-4 text-green-500" />
                                    {:else}
                                        <Copy class="h-4 w-4" />
                                    {/if}
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                                <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
                            </Tooltip.Content>
                        </Tooltip.Root>
                    </div>
                </div>
            </div>

            <p class="text-center text-xs text-muted-foreground">
                You can manage all your dev tokens in the <a href="/settings/credentials" class="text-primary hover:underline">Credentials section</a>.
            </p>
        </div>

        <Dialog.Footer>
            <Button class="w-full" onclick={handleClose}>
                I've copied the token
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

