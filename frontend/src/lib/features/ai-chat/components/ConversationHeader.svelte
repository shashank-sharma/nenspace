
<script lang="ts">
    import type { Conversation, ModelInfo, TokenUsage } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Download, Settings, MoreVertical, X } from 'lucide-svelte';
    import { Context, ContextTrigger, ContextContent, ContextContentHeader, ContextContentBody, ContextInputUsage, ContextOutputUsage, ContextReasoningUsage, ContextCacheUsage } from '$lib/components/ai-elements/context';
    import {
        ModelSelector,
        ModelSelectorTrigger,
        ModelSelectorContent,
        ModelSelectorInput,
        ModelSelectorList,
        ModelSelectorEmpty,
        ModelSelectorGroup,
        ModelSelectorItem,
        ModelSelectorLogo,
        ModelSelectorName
    } from '$lib/components/ai-elements/model-selector';
    import { groupModelsByProvider } from '../utils/model.util';

    let {
        conversation,
        selectedModel,
        models = [],
        tokenUsage,
        showModelSelector = $bindable(false),
        onModelSelect,
        onExport,
        onSettings,
        onClose,
    } = $props<{
        conversation: Conversation;
        selectedModel?: string;
        models?: ModelInfo[];
        tokenUsage?: TokenUsage | null;
        showModelSelector?: boolean;
        onModelSelect?: (modelId: string) => void;
        onExport?: () => void;
        onSettings?: () => void;
        onClose?: () => void;
    }>();

    function getSelectedModelInfo() {
        return models.find((m: ModelInfo) => m.id === selectedModel);
    }

    const groupedModels = $derived(groupModelsByProvider(models));
</script>

<header class="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm">
    <div class="flex items-center gap-3 flex-1 min-w-0">
        <h1 class="text-lg font-semibold truncate text-foreground">
            {conversation.title}
        </h1>
        <ModelSelector bind:open={showModelSelector}>
            <ModelSelectorTrigger class="h-8 text-sm text-muted-foreground hover:text-foreground">
                {#if getSelectedModelInfo()}
                    <ModelSelectorLogo provider={getSelectedModelInfo()!.provider} class="mr-1.5 h-3.5 w-3.5" />
                    <span class="truncate">{getSelectedModelInfo()!.name}</span>
                {:else}
                    <span>Select Model</span>
                {/if}
            </ModelSelectorTrigger>
            <ModelSelectorContent title="Select AI Model" description="Choose a model for your conversation">
                <ModelSelectorInput placeholder="Search models..." />
                <ModelSelectorList>
                    <ModelSelectorEmpty message="No models found" />
                    {#each Array.from(groupedModels.entries()) as [provider, providerModels]}
                        <ModelSelectorGroup heading={provider}>
                            {#each providerModels as model}
                                <ModelSelectorItem
                                    value={model.id}
                                    onSelect={() => {
                                        onModelSelect?.(model.id);
                                        showModelSelector = false;
                                    }}
                                >
                                    <div class="flex items-center gap-2">
                                        <ModelSelectorLogo provider={model.provider} />
                                        <div class="flex flex-col">
                                            <ModelSelectorName>{model.name}</ModelSelectorName>
                                            <span class="text-xs text-muted-foreground">
                                                {model.supports_streaming ? 'Streaming' : 'No streaming'}
                                                {model.supports_tools ? ' • Tools' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </ModelSelectorItem>
                            {/each}
                        </ModelSelectorGroup>
                    {/each}
                </ModelSelectorList>
            </ModelSelectorContent>
        </ModelSelector>
    </div>

    <div class="flex items-center gap-2 flex-shrink-0">
        {#if onClose}
            <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                onclick={onClose}
                aria-label="Close conversation"
            >
                <X class="h-4 w-4" />
            </Button>
        {/if}
        {#if tokenUsage}
            <Context
                usedTokens={tokenUsage.totalTokens}
                maxTokens={conversation.settings?.max_tokens || 4000}
                usage={{
                    promptTokens: tokenUsage.promptTokens,
                    completionTokens: tokenUsage.completionTokens,
                    totalTokens: tokenUsage.totalTokens,
                    cachedTokens: tokenUsage.cachedTokens,
                    reasoningTokens: tokenUsage.reasoningTokens
                }}
            >
                <ContextTrigger />
                <ContextContent>
                    <ContextContentHeader />
                    <ContextContentBody>
                        <ContextInputUsage />
                        <ContextOutputUsage />
                        <ContextReasoningUsage />
                        <ContextCacheUsage />
                    </ContextContentBody>
                </ContextContent>
            </Context>
        {/if}
        {#if onExport}
            <Button
                variant="ghost"
                size="sm"
                onclick={onExport}
                aria-label="Export conversation"
            >
                <Download class="h-4 w-4 mr-2" />
                Export
            </Button>
        {/if}
        {#if onSettings}
            <Button
                variant="ghost"
                size="sm"
                onclick={onSettings}
                aria-label="Conversation settings"
            >
                <Settings class="h-4 w-4" />
            </Button>
        {/if}
    </div>
</header>
