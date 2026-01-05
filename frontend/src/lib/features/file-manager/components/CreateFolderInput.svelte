<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { createEventDispatcher } from 'svelte';
    import { Check, X } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';

    let {
        open = $bindable(false),
        placeholder = 'Folder name'
    } = $props<{
        open?: boolean;
        placeholder?: string;
    }>();

    const dispatch = createEventDispatcher<{
        create: string;
        cancel: void;
    }>();

    let folderName = $state('');
    let inputRef: HTMLInputElement | null = null;

    $effect(() => {
        if (open) {
            setTimeout(() => {
                if (inputRef) {
                    inputRef.focus();
                    inputRef.select();
                }
            }, 0);
        }
    });

    function handleSubmit() {
        const name = folderName.trim();
        if (name) {
            dispatch('create', name);
            folderName = '';
            open = false;
        }
    }

    function handleCancel() {
        folderName = '';
        open = false;
        dispatch('cancel');
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleCancel();
        }
    }

    function handleBlur() {
        setTimeout(() => {
            if (folderName.trim()) {
                handleSubmit();
            } else {
                handleCancel();
            }
        }, 200);
    }
</script>

{#if open}
    <div class="flex items-center gap-2 p-2 border-b">
        <input
            bind:this={inputRef}
            bind:value={folderName}
            {placeholder}
            onkeydown={handleKeyDown}
            onblur={handleBlur}
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
        />
        <Button variant="ghost" size="icon" onclick={handleSubmit} disabled={!folderName.trim()}>
            <Check class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onclick={handleCancel}>
            <X class="h-4 w-4" />
        </Button>
    </div>
{/if}

