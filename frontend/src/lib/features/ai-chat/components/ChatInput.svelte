<script lang="ts">
    import {
        PromptInput,
        PromptInputBody,
        PromptInputTextarea,
        PromptInputToolbar,
        PromptInputSubmit,
        PromptInputAttachments,
        PromptInputAttachment,
        PromptInputTools,
        PromptInputActionMenu,
        PromptInputActionMenuTrigger,
        PromptInputActionMenuContent,
        PromptInputActionAddAttachments,
        type PromptInputMessage,
        type ChatStatus,
    } from '$lib/components/ai-elements/prompt-input';

    let {
        onSubmit,
        placeholder = "Type a message...",
        status = "idle",
        class: className = ""
    } = $props<{
        onSubmit?: (message: PromptInputMessage, event: SubmitEvent) => void | Promise<void>;
        placeholder?: string;
        status?: ChatStatus;
        class?: string;
    }>();

    async function handleSubmit(message: PromptInputMessage, event: SubmitEvent) {
        if (onSubmit) {
            try {
                await onSubmit(message, event);
            } catch (error) {

                console.error('Error in message submission:', error);
            }
        }
    }
</script>

<PromptInput
    onSubmit={handleSubmit}
    class={className}
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
            {placeholder}
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
            </PromptInputTools>
            <PromptInputSubmit {status} />
        </PromptInputToolbar>
    </PromptInputBody>
</PromptInput>
