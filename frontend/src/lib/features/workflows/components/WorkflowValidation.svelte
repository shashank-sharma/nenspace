<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import * as Alert from '$lib/components/ui/alert';
    import { Button } from '$lib/components/ui/button';
    import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-svelte';
    import type { ValidationResult } from '../types';
    import { workflowEditorStore } from '../stores';
    import { toast } from 'svelte-sonner';

    let { validationResult = null, collapsed = $bindable(false) } = $props<{ validationResult?: ValidationResult | null; collapsed?: boolean }>();

    let isValidating = $state(false);

    async function handleValidate() {
        if (!workflowEditorStore.workflowId || isValidating) return;
        
        isValidating = true;
        try {
            const result = await workflowEditorStore.validate();
            if (result.valid) {
                toast.success('Workflow validation passed');
            } else {
                toast.error(`Validation failed: ${result.errors.length} error(s)`);
            }
        } catch (error) {
            console.error('Validation failed:', error);
            toast.error('Failed to validate workflow');
        } finally {
            isValidating = false;
        }
    }
</script>

{#if validationResult}
    <Card.Root class="pt-4 max-h-[400px] overflow-y-auto">
        <Card.Header class="flex flex-row items-center justify-between gap-2 py-2 px-4">
            <Card.Title class="text-sm font-medium flex items-center gap-2">
                {#if validationResult.valid}
                    <CheckCircle2 class="h-4 w-4 text-green-500" />
                    <span>Validation Passed</span>
                {:else}
                    <XCircle class="h-4 w-4" style="color: rgb(239 68 68);" />
                    <span>Validation Failed</span>
                {/if}
            </Card.Title>
            <div class="flex items-center gap-2">
                {#if validationResult.valid}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={handleValidate}
                        disabled={isValidating}
                        class="hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-950 dark:hover:text-green-400 transition-colors"
                        title="Revalidate workflow"
                    >
                        <RefreshCw class="h-3 w-3 mr-1.5 {isValidating ? 'animate-spin' : ''}" />
                        Revalidate
                    </Button>
                {:else}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={handleValidate}
                        disabled={isValidating}
                        class="hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
                        title="Validate workflow"
                    >
                        <RefreshCw class="h-3 w-3 mr-1.5 {isValidating ? 'animate-spin' : ''}" />
                        {isValidating ? 'Validating...' : 'Validate'}
                    </Button>
                {/if}
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    onclick={() => collapsed = !collapsed}
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {#if collapsed}
                        <ChevronDown class="h-4 w-4" />
                    {:else}
                        <ChevronUp class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </Card.Header>
        {#if !collapsed}
            <Card.Content class="space-y-3 px-4 pb-4">
            {@const errors = validationResult.errors || []}
            {@const warnings = validationResult.warnings || []}
            {#if errors.length > 0}
                <div class="space-y-2">
                    <div class="text-sm font-semibold flex items-center gap-2" style="color: rgb(239 68 68);">
                        <XCircle class="h-4 w-4" style="color: rgb(239 68 68);" />
                        <span>Errors ({errors.length})</span>
                    </div>
                    {#each errors as error}
                        <Alert.Root class="py-3 px-4 border-red-200 dark:border-red-800" style="background-color: rgb(239 68 68 / 0.1); border-color: rgb(239 68 68 / 0.3);">
                            <Alert.Description class="text-sm leading-relaxed" style="color: rgb(239 68 68);">{error}</Alert.Description>
                        </Alert.Root>
                    {/each}
                </div>
            {/if}
            {#if warnings.length > 0}
                <div class="space-y-2">
                    <div class="text-sm font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        <AlertTriangle class="h-4 w-4" />
                        <span>Warnings ({warnings.length})</span>
                    </div>
                    {#each warnings as warning}
                        <Alert.Root class="py-3 px-4 border-yellow-200 dark:border-yellow-800">
                            <Alert.Description class="text-sm leading-relaxed text-yellow-600 dark:text-yellow-400">{warning}</Alert.Description>
                        </Alert.Root>
                    {/each}
                </div>
            {/if}
            {#if validationResult.valid && errors.length === 0 && warnings.length === 0}
                <div class="text-sm text-muted-foreground py-2">Workflow is valid and ready to execute.</div>
            {/if}
            </Card.Content>
        {:else}
            <Card.Content class="py-2 px-4">
                {@const errors = validationResult.errors || []}
                {@const warnings = validationResult.warnings || []}
                <div class="text-xs text-muted-foreground">
                    {#if validationResult.valid}
                        {errors.length === 0 && warnings.length === 0 
                            ? 'Workflow is valid and ready to execute.'
                            : `Valid with ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                    {:else}
                        {errors.length} error{errors.length !== 1 ? 's' : ''}
                        {#if warnings.length > 0}
                            , {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                        {/if}
                    {/if}
                </div>
            </Card.Content>
        {/if}
    </Card.Root>
{/if}


