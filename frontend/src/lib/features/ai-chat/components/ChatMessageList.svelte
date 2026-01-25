<script lang="ts">
    import type { ChatMessage, Checkpoint } from '../types';
    import { chatStore } from '../stores/chat.store.svelte';
    import { Message, MessageContent, MessageResponse, MessageActions, MessageAction, MessageAttachment } from '$lib/components/ai-elements/message';
    import { Shimmer } from '$lib/components/ai-elements/shimmer';
    import { Sources, SourcesTrigger, SourcesContent, Source } from '$lib/components/ai-elements/sources';
    import { Reasoning, ReasoningTrigger, ReasoningContent } from '$lib/components/ai-elements/reasoning';
    import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '$lib/components/ai-elements/tool';
    import { Checkpoint as CheckpointComponent, CheckpointIcon, CheckpointTrigger } from '$lib/components/ai-elements/checkpoint';
    import { Copy, RefreshCw, Bookmark } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    let {
        messages = [],
        checkpoints = [],
        isStreaming = false,
        onRegenerateMessage
    } = $props<{
        messages: ChatMessage[];
        checkpoints?: Checkpoint[];
        isStreaming?: boolean;
        onRegenerateMessage?: (messageId: string) => void;
    }>();

    async function handleCopyMessage(content: string) {
        try {
            await navigator.clipboard.writeText(content);
            toast.success('Message copied to clipboard');
        } catch (error) {
            toast.error('Failed to copy message');
        }
    }

    function handleRegenerateMessage(messageId: string) {
        if (onRegenerateMessage) {
            onRegenerateMessage(messageId);
        } else {
            toast.info('Regenerate feature coming soon');
        }
    }
</script>

<div class="max-w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto">
    {#each messages as message (message.id)}
        <Message from={message.role}>
            <MessageContent variant="flat">
                {#if message.metadata?.files && message.metadata.files.length > 0}
                    <div class="flex flex-wrap gap-2 mb-2">
                        {#each message.metadata.files as file}
                            <MessageAttachment
                                name={file.name || 'Unknown file'}
                                type={file.type || 'application/octet-stream'}
                                size={file.size || 0}
                                url={file.url || file.data}
                            />
                        {/each}
                    </div>
                {/if}

                <MessageResponse content={message.content} />

                {#if message.metadata?.sources && message.metadata.sources.length > 0}
                    <div class="mt-2">
                        <Sources>
                            <SourcesTrigger />
                            <SourcesContent>
                                {#each message.metadata.sources as source}
                                    <Source
                                        href={source.url}
                                        title={source.title}
                                    >
                                        {source.snippet || source.title}
                                    </Source>
                                {/each}
                            </SourcesContent>
                        </Sources>
                    </div>
                {/if}

                {#if message.metadata?.reasoning}
                    <div class="mt-2">
                        <Reasoning>
                            <ReasoningTrigger />
                            <ReasoningContent>
                                {message.metadata.reasoning}
                            </ReasoningContent>
                        </Reasoning>
                    </div>
                {/if}

                {#if message.metadata?.tools && message.metadata.tools.length > 0}
                    <div class="mt-2 space-y-2">
                        {#each message.metadata.tools as tool}
                            <Tool>
                                {@const toolState = tool.state === 'pending' ? 'input-streaming' : tool.state === 'running' ? 'input-available' : tool.state === 'completed' ? 'output-available' : 'output-error'}
                                <ToolHeader type={tool.name} state={toolState} />
                                <ToolContent>
                                    <ToolInput input={tool.input} />
                                    {#if tool.output}
                                        <ToolOutput output={tool.output} />
                                    {/if}
                                    {#if tool.error}
                                        <div class="text-sm text-red-500">{tool.error}</div>
                                    {/if}
                                </ToolContent>
                            </Tool>
                        {/each}
                    </div>
                {/if}

                {#if message.role === 'assistant'}
                    <MessageActions>
                        <MessageAction
                            tooltip="Copy message"
                            onclick={() => handleCopyMessage(message.content)}
                        >
                            <Copy class="h-4 w-4" />
                        </MessageAction>
                        <MessageAction
                            tooltip="Regenerate"
                            onclick={() => handleRegenerateMessage(message.id)}
                        >
                            <RefreshCw class="h-4 w-4" />
                        </MessageAction>
                        <MessageAction
                            tooltip="Create checkpoint"
                            onclick={() => chatStore.addCheckpoint(message.id, `Checkpoint at ${new Date().toLocaleTimeString()}`)}
                        >
                            <Bookmark class="h-4 w-4" />
                        </MessageAction>
                    </MessageActions>
                {/if}
            </MessageContent>
        </Message>

        {#if checkpoints && checkpoints.some((cp: Checkpoint) => cp.messageId === message.id)}
            {#each checkpoints.filter((cp: Checkpoint) => cp.messageId === message.id) as checkpoint}
                <CheckpointComponent>
                    <CheckpointIcon />
                    <CheckpointTrigger
                        tooltip="Restore to this point"
                        onclick={() => chatStore.restoreCheckpoint(checkpoint.id)}
                    >
                        {checkpoint.title || 'Checkpoint'}
                    </CheckpointTrigger>
                </CheckpointComponent>
            {/each}
        {/if}
    {/each}

    {#if isStreaming}
        <Message from="assistant">
            <MessageContent variant="flat">
                <Shimmer duration={2}>
                    Thinking...
                </Shimmer>
            </MessageContent>
        </Message>
    {/if}
</div>
