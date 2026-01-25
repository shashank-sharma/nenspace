<script lang="ts">
    import { CredentialsService } from '$lib/features/credentials/services/credentials.service';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { Switch } from '$lib/components/ui/switch';
    import { Key, ExternalLink, CheckCircle2, AlertCircle, Plus, Loader2, Lock } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import { validateWithToast, required, minLength } from '$lib/utils';
    import type { ApiKey } from '$lib/features/credentials/types';
    import { onMount } from 'svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

    let apiKey = $state('');
    let isSubmitting = $state(false);
    let name = $state('OpenRouter API Key');
    let openRouterKeys = $state<ApiKey[]>([]);
    let isLoadingKeys = $state(true);
    let showAddForm = $state(true);

    async function loadKeys() {
        isLoadingKeys = true;
        try {
            const allKeys = await CredentialsService.getApiKeys();
            openRouterKeys = allKeys.filter(key => key.service === 'openrouter');

            if (openRouterKeys.length > 0) {
                const hasActive = openRouterKeys.some(k => k.is_active);
                showAddForm = !hasActive;
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            isLoadingKeys = false;
        }
    }

    async function handleSubmit() {
        if (!validateWithToast({ apiKey }, {
            apiKey: [required('API key is required'), minLength(10, 'API key must be at least 10 characters')],
        })) {
            return;
        }

        isSubmitting = true;
        try {

            const otherActiveKeys = openRouterKeys.filter(k => k.is_active);
            for (const key of otherActiveKeys) {
                try {
                    await CredentialsService.toggleApiKeyStatus(key.id, true);
                } catch (error) {
                    console.error('Failed to deactivate other key:', error);
                }
            }

            await CredentialsService.createApiKey({
                name,
                service: 'openrouter',
                key: apiKey.trim(),
                is_active: true,
            });

            toast.success('OpenRouter API key added successfully!');
            apiKey = '';
            name = 'OpenRouter API Key';
            showAddForm = false;
            await loadKeys();

            const hasActive = openRouterKeys.some(k => k.is_active);
            if (hasActive) {

                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openrouter-key-added'));
                }, 100);
            }
        } catch (error) {
            console.error('Failed to add API key:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to add API key');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleToggleKey(keyId: string, currentStatus: boolean) {
        try {
            await CredentialsService.toggleApiKeyStatus(keyId, currentStatus);
            await loadKeys();

            const hasActive = openRouterKeys.some(k => k.is_active);
            if (hasActive) {
                window.dispatchEvent(new CustomEvent('openrouter-key-added'));
            }

            toast.success(currentStatus ? 'Key deactivated' : 'Key activated');
        } catch (error) {
            console.error('Failed to toggle key status:', error);
            toast.error('Failed to update key status');
        }
    }

    onMount(() => {
        loadKeys();
    });

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    }
</script>

<div class="flex h-full items-center justify-center p-8">
    <Card class="w-full max-w-2xl">
        <CardHeader>
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2 rounded-lg bg-primary/10">
                    <Key class="h-6 w-6 text-primary" />
                </div>
                <CardTitle class="text-2xl">OpenRouter API Key Required</CardTitle>
            </div>
            <CardDescription class="text-base">
                To use AI Chat, you need to add your OpenRouter API key. This allows you to use various AI models through OpenRouter.
            </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">

            {#if isLoadingKeys}
                <div class="flex items-center justify-center py-8">
                    <LoadingSpinner />
                </div>
            {:else if openRouterKeys.length > 0}
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold">Your OpenRouter Keys</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => {
                                showAddForm = !showAddForm;
                                if (!showAddForm) {
                                    apiKey = '';
                                    name = 'OpenRouter API Key';
                                }
                            }}
                        >
                            <Plus class="h-4 w-4 mr-2" />
                            {showAddForm ? 'Cancel' : 'Add Another Key'}
                        </Button>
                    </div>
                    <div class="space-y-2">
                        {#each openRouterKeys as key (key.id)}
                            <div class="flex items-center justify-between p-3 rounded-lg border bg-card">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">{key.name}</span>
                                        {#if key.is_active}
                                            <Badge variant="default" class="text-xs">Active</Badge>
                                        {/if}
                                    </div>
                                    {#if key.description}
                                        <p class="text-sm text-muted-foreground mt-1">{key.description}</p>
                                    {/if}
                                    <p class="text-xs text-muted-foreground font-mono mt-1">
                                        {key.key.substring(0, 12)}...
                                    </p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="flex items-center gap-2">
                                        <Switch
                                            checked={key.is_active}
                                            onclick={() => handleToggleKey(key.id, key.is_active)}
                                        />
                                        <span class="text-sm text-muted-foreground">Use</span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Add New Key Form -->
            {#if showAddForm || openRouterKeys.length === 0}
                <div class="space-y-6">
                    <!-- Instructions -->
                    <div class="space-y-4">
                        <div class="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                            <AlertCircle class="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div class="space-y-2 text-sm">
                                <p class="font-medium">How to get your OpenRouter API key:</p>
                                <ol class="list-decimal list-inside space-y-1 ml-2 text-muted-foreground">
                                    <li>Visit <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline inline-flex items-center gap-1">
                                        openrouter.ai/keys <ExternalLink class="h-3 w-3" />
                                    </a></li>
                                    <li>Sign in or create an account</li>
                                    <li>Create a new API key</li>
                                    <li>Copy the key and paste it below</li>
                                </ol>
                            </div>
                        </div>

                        <div class="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <CheckCircle2 class="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div class="text-sm text-muted-foreground">
                                <p class="font-medium text-foreground mb-1">Why OpenRouter?</p>
                                <p>OpenRouter provides access to multiple AI models (GPT-4, Claude, Llama, etc.) through a single API. Your key is stored securely and only used for your requests.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Form -->
                    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
                        <div class="space-y-2">
                            <Label for="name">Key Name</Label>
                            <Input
                                id="name"
                                bind:value={name}
                                placeholder="OpenRouter API Key"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="apiKey">API Key</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                bind:value={apiKey}
                                placeholder="sk-or-v1-..."
                                onkeydown={handleKeyPress}
                                disabled={isSubmitting}
                                autofocus
                                class="font-mono"
                            />
                            <p class="text-xs text-muted-foreground">
                                Your API key starts with "sk-or-v1-". It will be stored securely and encrypted.
                            </p>
                        </div>

                        <Button
                            type="submit"
                            class="w-full"
                            disabled={isSubmitting || !apiKey.trim()}
                        >
                            {#if isSubmitting}
                                <span class="flex items-center gap-2">
                                    <span class="animate-spin">⏳</span>
                                    Adding API Key...
                                </span>
                            {:else}
                                <span class="flex items-center gap-2">
                                    <Key class="h-4 w-4" />
                                    Add API Key
                                </span>
                            {/if}
                        </Button>
                    </form>

                    <!-- Security Note -->
                    <div class="pt-4 border-t">
                        <p class="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                            <Lock class="h-3 w-3" />
                            Your API key is encrypted and stored securely. Only you can access it.
                        </p>
                    </div>
                </div>
            {/if}

            {#if openRouterKeys.length > 0 && !showAddForm}
                <!-- Info about multiple keys -->
                <div class="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p class="text-sm text-muted-foreground">
                        <CheckCircle2 class="h-4 w-4 inline mr-2 text-blue-500" />
                        You can add multiple keys and switch between them. Only one key can be active at a time.
                    </p>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
