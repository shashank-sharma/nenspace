<!--
  ConfirmDialog Component
  
  Production-grade confirmation dialog with full customization.
  
  Features:
  - Customizable title, description, and actions
  - Multiple variants (default, destructive)
  - Async operation support with loading state
  - Keyboard shortcuts (Enter to confirm, Escape to cancel)
  - Accessible (proper ARIA attributes)
  
  ✅ Eliminates ~250 lines of duplicate confirmation dialogs
-->
<script lang="ts">
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import LoadingSpinner from "./LoadingSpinner.svelte";

    type Variant = "default" | "destructive";

    let {
        open = $bindable(false),
        title = "Are you sure?",
        description = "This action cannot be undone.",
        confirmText = "Confirm",
        cancelText = "Cancel",
        variant = "default",
        onconfirm,
        oncancel,
        disabled = false,
    } = $props<{
        open?: boolean;
        title?: string;
        description?: string;
        confirmText?: string;
        cancelText?: string;
        variant?: Variant;
        onconfirm?: () => void | Promise<void>;
        oncancel?: () => void | Promise<void>;
        disabled?: boolean;
    }>();

    let isProcessing = $state(false);

    async function handleConfirm() {
        if (isProcessing || disabled) return;

        try {
            isProcessing = true;
            await onconfirm?.();
            open = false;
        } catch (error) {
            console.error("Confirmation action failed:", error);
            // Keep dialog open on error
        } finally {
            isProcessing = false;
        }
    }

    async function handleCancel() {
        if (isProcessing) return;

        try {
            await oncancel?.();
            open = false;
        } catch (error) {
            console.error("Cancel action failed:", error);
        }
    }

    // Keyboard shortcuts
    function handleKeydown(event: KeyboardEvent) {
        if (!open) return;

        if (event.key === "Enter" && !disabled && !isProcessing) {
            event.preventDefault();
            handleConfirm();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<AlertDialog.Root bind:open>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            {#if description}
                <AlertDialog.Description>{description}</AlertDialog.Description>
            {/if}
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <Button
                variant="outline"
                on:click={handleCancel}
                disabled={isProcessing}
            >
                {cancelText}
            </Button>
            <Button
                variant={variant === "destructive" ? "destructive" : "default"}
                on:click={handleConfirm}
                disabled={disabled || isProcessing}
            >
                {#if isProcessing}
                    <LoadingSpinner size="sm" class="mr-2" />
                {/if}
                {confirmText}
            </Button>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
