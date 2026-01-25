<script lang="ts">
    import { ChatService } from '../services/chat.service';
    import { ChatExportService } from '../services/chat-export.service';
    import { chatStore } from '../stores/chat.store.svelte';
    import { uploadAttachments } from '../services/chat-attachment.service';
    import ConversationList from './ConversationList.svelte';
    import ConversationHeader from './ConversationHeader.svelte';
    import NewConversationSection from './NewConversationSection.svelte';
    import OpenRouterSetup from './OpenRouterSetup.svelte';
    import ChatMessageList from './ChatMessageList.svelte';
    import ChatInput from './ChatInput.svelte';
    import type { ModelInfo, ConversationFilter } from '../types';
    import { withErrorHandling } from '$lib/utils';
    import { CredentialsService } from '$lib/features/credentials/services/credentials.service';
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { Plus, Download } from 'lucide-svelte';
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import { DEFAULT_MODEL, CONVERSATION_STARTERS } from '../constants';
    import { toast } from 'svelte-sonner';
    import { Conversation as ConversationContainer, ConversationContent, ConversationScrollButton } from '$lib/components/ai-elements/conversation';
    import type { PromptInputMessage } from '$lib/components/ai-elements/prompt-input';
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

    let selectedModel = $state<string>(DEFAULT_MODEL);
    let models = $state<ModelInfo[]>([]);
    let conversationFilter = $state<ConversationFilter>({});
    let showExportDialog = $state(false);
    let showModelSelector = $state(false);
    let hasOpenRouterKey = $state<boolean | null>(null);
    let isLoadingKeyCheck = $state(true);
    let isLoadingModels = $state(false);

    const groupedModels = $derived(groupModelsByProvider(models));

    $effect(() => {
        const conversationId = $page.params.conversationId || null;

        if (conversationId !== chatStore.currentConversationId) {
            void chatStore.selectConversation(conversationId, { fromUrl: true });
        }
    });

    async function checkOpenRouterKey() {
        try {
            const apiKeys = await CredentialsService.getApiKeys();
            hasOpenRouterKey = apiKeys.some(key => key.service === 'openrouter' && key.is_active);
        } catch (error) {
            console.error('Failed to check API keys:', error);
            hasOpenRouterKey = false;
        } finally {
            isLoadingKeyCheck = false;
        }
    }

    async function handleKeyAdded() {
        const previousState = hasOpenRouterKey;
        await checkOpenRouterKey();

        if (!previousState && hasOpenRouterKey && !isLoadingModels) {
            await loadModels();
            await chatStore.loadConversations(conversationFilter);
        }
    }

    onMount(() => {
        (async () => {
            await checkOpenRouterKey();

            if (hasOpenRouterKey) {
                await loadModels();
                await chatStore.loadConversations(conversationFilter);

                const conversationId = $page.params.conversationId;
                if (conversationId) {
                    await chatStore.selectConversation(conversationId, { fromUrl: true });
                }
            }
        })();

        window.addEventListener('openrouter-key-added', handleKeyAdded);

        return () => {
            window.removeEventListener('openrouter-key-added', handleKeyAdded);
        };
    });

    onDestroy(() => {
        chatStore.reset();
    });

    async function loadModels() {
        if (isLoadingModels) return;

        isLoadingModels = true;
        try {
            const modelList = await ChatService.listModels();
            models = modelList;
            if (modelList.length > 0 && !selectedModel) {
                selectedModel = modelList[0].id;
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            if (models.length === 0) {
                const defaultModel: ModelInfo = {
                    id: DEFAULT_MODEL,
                    name: 'Default Model',
                    provider: 'openai',
                    supports_streaming: true,
                    supports_tools: false,
                };
                models = [defaultModel];
                selectedModel = DEFAULT_MODEL;
            }
        } finally {
            isLoadingModels = false;
        }
    }

    async function handleSendMessage(message: PromptInputMessage, event: SubmitEvent) {
        const content = message.text?.trim() || '';
        if ((!content && (!message.files || message.files.length === 0)) || chatStore.isStreaming) {
            return;
        }

        let conversationId = chatStore.activeConversation?.id;

        if (!conversationId) {
            try {
                const newConv = await ChatService.createConversation({
                    title: content.substring(0, 50) || 'New Conversation',
                    model: selectedModel,
                });
                conversationId = newConv.id;
                await chatStore.selectConversation(newConv.id);
                await chatStore.loadConversations(conversationFilter);
            } catch (error) {
                toast.error('Failed to create conversation');
                console.error('Failed to create conversation:', error);

                throw error;
            }
        }

        if (!conversationId) {
            throw new Error('No conversation ID available');
        }

        let attachmentIds: string[] = [];
        if (message.files && message.files.length > 0) {
            try {
                toast.loading(`Uploading ${message.files.length} file(s)...`, { id: 'upload' });
                const attachments = await uploadAttachments(message.files);
                attachmentIds = attachments.map(att => att.id);
                toast.success('Files uploaded', { id: 'upload' });
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to upload attachments', { id: 'upload' });
                console.error('Failed to upload attachments:', error);
                throw error;
            }
        }

        try {
            await chatStore.sendUserMessage(conversationId, message, attachmentIds);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            toast.error(errorMessage);
            console.error('Failed to send message:', error);
            throw error;
        }
    }

    async function handleSuggestionClick(suggestion: string) {
        const message: PromptInputMessage = {
            text: suggestion,
            files: []
        };

        const mockEvent = new Event('submit') as SubmitEvent;
        await handleSendMessage(message, mockEvent);
    }

    async function handleToggleFavorite(conversationId: string) {
        const conversation = chatStore.conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        await withErrorHandling(
            async () => {
                await ChatService.updateConversation(conversationId, {
                    is_favorite: !conversation.is_favorite,
                });
                chatStore.updateConversationInPlace(conversationId, {
                    is_favorite: !conversation.is_favorite,
                });
            },
            {
                errorMessage: 'Failed to update favorite status',
            }
        );
    }

    async function handleToggleArchive(conversationId: string) {
        const conversation = chatStore.conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        await withErrorHandling(
            async () => {
                await ChatService.updateConversation(conversationId, {
                    archived: !conversation.archived,
                });
                chatStore.updateConversationInPlace(conversationId, {
                    archived: !conversation.archived,
                });
            },
            {
                errorMessage: 'Failed to update archive status',
            }
        );
    }

    async function handleDeleteConversation(conversationId: string) {
        await withErrorHandling(
            async () => {
                await ChatService.deleteConversation(conversationId);
                if (chatStore.activeConversation?.id === conversationId) {
                    await chatStore.selectConversation(null);
                }
                chatStore.conversations = chatStore.conversations.filter(c => c.id !== conversationId);
            },
            {
                successMessage: 'Conversation deleted',
                errorMessage: 'Failed to delete conversation',
            }
        );
    }

    async function handleExportConversation(format: 'markdown' | 'json') {
        if (!chatStore.activeConversation) return;

        await withErrorHandling(
            () => ChatExportService.downloadExport(chatStore.activeConversation!.id, format),
            {
                successMessage: `Conversation exported as ${format.toUpperCase()}`,
                errorMessage: 'Failed to export conversation',
                onSuccess: () => {
                    showExportDialog = false;
                },
            }
        );
    }

    function getSelectedModelInfo() {
        return models.find(m => m.id === selectedModel);
    }

    async function handleCreateNewConversation() {
        await withErrorHandling(
            async () => {
                const newConv = await ChatService.createConversation({
                    title: 'New Conversation',
                    model: selectedModel,
                });
                await chatStore.selectConversation(newConv.id);
                await chatStore.loadConversations(conversationFilter);
            },
            {
                errorMessage: 'Failed to create conversation',
            }
        );
    }

    function handleCloseConversation() {
        void chatStore.selectConversation(null);
    }
</script>

{#if isLoadingKeyCheck}
    <div class="flex h-full items-center justify-center">
        <LoadingSpinner />
    </div>
{:else if !hasOpenRouterKey}
    <OpenRouterSetup />
{:else}
<div class="flex h-full flex-col overflow-hidden bg-background">
    {#if chatStore.error}
        <div class="bg-destructive/10 text-destructive px-4 py-3 flex items-center justify-between">
            <span class="text-sm">{chatStore.error.message}</span>
            <div class="flex gap-2">
                {#if chatStore.error.retry}
                    <Button size="sm" variant="outline" onclick={chatStore.error.retry}>
                        Retry
                    </Button>
                {/if}
                <Button size="sm" variant="ghost" onclick={() => chatStore.error = null}>
                    Dismiss
                </Button>
            </div>
        </div>
    {/if}

    <div class="flex flex-1 overflow-hidden">
        <aside class="w-80 border-r border-border bg-sidebar-background flex flex-col overflow-hidden flex-shrink-0">
            <ConversationList
                bind:conversations={chatStore.conversations}
                activeConversationId={chatStore.currentConversationId}
                bind:filter={conversationFilter}
                {models}
                isLoading={chatStore.isLoading}
                onSelect={async (id) => {
                    await chatStore.selectConversation(id);
                }}
                onDelete={handleDeleteConversation}
                onToggleFavorite={handleToggleFavorite}
                onToggleArchive={handleToggleArchive}
            />
            <div class="p-4 border-t border-sidebar-border bg-card space-y-2 flex-shrink-0">
                <ModelSelector bind:open={showModelSelector}>
                    <ModelSelectorTrigger class="w-full justify-start">
                        {#if getSelectedModelInfo()}
                            <ModelSelectorLogo provider={getSelectedModelInfo()!.provider} class="mr-2" />
                            <ModelSelectorName>{getSelectedModelInfo()!.name}</ModelSelectorName>
                        {:else}
                            Select Model
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
                                                selectedModel = model.id;
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

                <Button class="w-full" onclick={handleCreateNewConversation}>
                    <Plus class="h-4 w-4 mr-2" />
                    New Conversation
                </Button>
            </div>
        </aside>

        <main class="flex-1 flex flex-col overflow-hidden bg-background p-4">
            <Card class="flex-1 flex flex-col overflow-hidden h-full">
                <CardContent class="flex-1 flex flex-col overflow-hidden p-0">
                    {#if chatStore.isLoadingConversation && chatStore.currentConversationId && !chatStore.activeConversation}
                        <div class="flex-1 flex items-center justify-center p-6">
                            <LoadingSpinner label="Loading conversation..." />
                        </div>
                    {:else if chatStore.activeConversation}
                        <ConversationHeader
                            conversation={chatStore.activeConversation}
                            {selectedModel}
                            {models}
                            tokenUsage={chatStore.tokenUsage}
                            bind:showModelSelector={showModelSelector}
                            onModelSelect={(modelId) => {
                                selectedModel = modelId;
                            }}
                            onExport={() => (showExportDialog = true)}
                            onClose={handleCloseConversation}
                        />

                        <ConversationContainer class="flex-1">
                            <ConversationContent>
                                <ChatMessageList
                                    messages={chatStore.activeMessages}
                                    checkpoints={chatStore.checkpoints}
                                    isStreaming={chatStore.isStreaming}
                                />
                            </ConversationContent>
                            <ConversationScrollButton />
                        </ConversationContainer>

                        <div class="border-t border-border p-3 sm:p-4 bg-card/50 backdrop-blur-sm flex-shrink-0">
                            <ChatInput
                                onSubmit={handleSendMessage}
                                class="max-w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto"
                                status={chatStore.isStreaming ? "streaming" : "idle"}
                            />
                        </div>
                    {:else}
                        <div class="flex-1 flex items-center justify-center p-6">
                            <NewConversationSection
                                bind:selectedModel={selectedModel}
                                {models}
                                onSubmit={handleSendMessage}
                                onSuggestionClick={handleSuggestionClick}
                                conversationStarters={CONVERSATION_STARTERS}
                                isStreaming={chatStore.isStreaming}
                            />
                        </div>
                    {/if}
                </CardContent>
            </Card>
        </main>
    </div>

    <Dialog.Root bind:open={showExportDialog}>
        <Dialog.Content>
            <Dialog.Header>
                <Dialog.Title>Export Conversation</Dialog.Title>
                <Dialog.Description>
                    Choose a format to export this conversation.
                </Dialog.Description>
            </Dialog.Header>
            <div class="grid gap-4 py-4">
                <Button
                    variant="outline"
                    onclick={() => handleExportConversation('markdown')}
                >
                    <Download class="h-4 w-4 mr-2" />
                    Export as Markdown
                </Button>
                <Button
                    variant="outline"
                    onclick={() => handleExportConversation('json')}
                >
                    <Download class="h-4 w-4 mr-2" />
                    Export as JSON
                </Button>
            </div>
            <Dialog.Footer>
                <Button variant="outline" onclick={() => (showExportDialog = false)}>
                    Cancel
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>
</div>
{/if}
