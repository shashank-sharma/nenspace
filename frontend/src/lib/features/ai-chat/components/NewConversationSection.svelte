<script lang="ts">
    import type { ModelInfo } from '../types';
    import type { PromptInputMessage } from '$lib/components/ai-elements/prompt-input';
    import {
        PromptInput,
        PromptInputBody,
        PromptInputTextarea,
        PromptInputToolbar,
        PromptInputSubmit,
        PromptInputAttachments,
        PromptInputAttachment,
        PromptInputActionAddAttachments,
        PromptInputActionMenu,
        PromptInputActionMenuTrigger,
        PromptInputActionMenuContent,
        PromptInputTools,
        PromptInputModelSelect,
        PromptInputModelSelectTrigger,
        PromptInputModelSelectContent,
        PromptInputModelSelectItem,
        PromptInputModelSelectValue,
        type ChatStatus,
    } from '$lib/components/ai-elements/prompt-input';
    import { Suggestions, Suggestion } from '$lib/components/ai-elements/suggestion';
    import WebGLOrb from './WebGLOrb.svelte';

    let {
        selectedModel = $bindable(""),
        models = [],
        onSubmit,
        onSuggestionClick,
        conversationStarters = [],
        isStreaming = false,
    } = $props<{
        selectedModel?: string;
        models?: ModelInfo[];
        onSubmit?: (message: PromptInputMessage, event: SubmitEvent) => void | Promise<void>;
        onSuggestionClick?: (suggestion: string) => void;
        conversationStarters?: readonly string[];
        isStreaming?: boolean;
    }>();

    let chatStatus = $derived<ChatStatus>(isStreaming ? "streaming" : "idle");

    async function handleSubmit(message: PromptInputMessage, event: SubmitEvent) {
        if (onSubmit) {
            await onSubmit(message, event);
        }
    }

    function handleSuggestionClick(suggestion: string) {
        if (onSuggestionClick) {
            onSuggestionClick(suggestion);
        }
    }
</script>

<div class="flex flex-col h-full relative">

    <div class="w-full h-64 flex-shrink-0 relative overflow-hidden border-b border-border flex items-center justify-center pb-[50px]">
        <div class="relative group cursor-pointer">

            <div class="absolute -inset-8 bg-purple-500/10 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

            <div class="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border border-white/10 shadow-2xl bg-black ring-1 ring-white/5">
                <WebGLOrb className="w-full h-full" />
            </div>
        </div>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div class="mt-32 text-center space-y-1">
                <h2 class="text-2xl font-semibold text-foreground">Start a new conversation</h2>
                <p class="text-sm text-muted-foreground">
                    Choose a model and begin chatting with AI
                </p>
            </div>
        </div>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center p-6 space-y-8 overflow-y-auto bg-background">
        <div class="w-full max-w-3xl space-y-8">

            <div class="w-full">
                <PromptInput
                    onSubmit={handleSubmit}
                    class="w-full"
                    accept="image/*,application/pdf,.doc,.docx,.txt,.md"
                    multiple
                    clearOnSubmit={true}
                    globalDrop
                >
                    <PromptInputBody>
                        <PromptInputAttachments>
                            {#snippet children(attachment)}
                                <PromptInputAttachment data={attachment} />
                            {/snippet}
                        </PromptInputAttachments>
                        <PromptInputTextarea
                            placeholder="Type a message or ask a question..."
                        />
                        <PromptInputToolbar>
                            <PromptInputTools>
                                <PromptInputActionMenu>
                                    <PromptInputActionMenuTrigger>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                    </PromptInputActionMenuTrigger>
                                    <PromptInputActionMenuContent>
                                        <PromptInputActionAddAttachments />
                                    </PromptInputActionMenuContent>
                                </PromptInputActionMenu>
                                {#if models.length > 0}
                                    <PromptInputModelSelect bind:value={selectedModel}>
                                        <PromptInputModelSelectTrigger>
                                            <PromptInputModelSelectValue
                                                value={selectedModel}
                                                placeholder="Select Model"
                                            />
                                        </PromptInputModelSelectTrigger>
                                        <PromptInputModelSelectContent>
                                            {#each models as modelOption (modelOption.id)}
                                                <PromptInputModelSelectItem value={modelOption.id}>
                                                    {modelOption.name}
                                                </PromptInputModelSelectItem>
                                            {/each}
                                        </PromptInputModelSelectContent>
                                    </PromptInputModelSelect>
                                {/if}
                            </PromptInputTools>
                            <PromptInputSubmit status={chatStatus} />
                        </PromptInputToolbar>
                    </PromptInputBody>
                </PromptInput>
            </div>

            {#if conversationStarters.length > 0}
                <div class="w-full space-y-3">
                    <h3 class="text-sm font-medium text-muted-foreground text-center">Suggested prompts</h3>
                    <Suggestions orientation="both" class="justify-center">
                        {#each conversationStarters as starter}
                            <Suggestion
                                suggestion={starter}
                                onclick={handleSuggestionClick as any}
                                disabled={isStreaming}
                            />
                        {/each}
                    </Suggestions>
                </div>
            {/if}
        </div>
    </div>
</div>
