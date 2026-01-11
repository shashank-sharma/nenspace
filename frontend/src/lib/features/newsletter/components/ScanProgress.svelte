<script lang="ts">
    import { newsletterStore } from "../stores/newsletter.store.svelte";
    import { Progress } from "$lib/components/ui/progress";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent } from "$lib/components/ui/card";
    import { AlertCircle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";
    import { cn } from "$lib/utils";

    const settings = $derived(newsletterStore.settings);
    const status = $derived(settings?.scan_status);
    const processed = $derived(settings?.processed_messages || 0);
    const total = $derived(settings?.total_messages || 0);
    const detected = $derived(settings?.detected_newsletters || 0);
    
    const progress = $derived(total > 0 ? (processed / total) * 100 : 0);
    const isScanning = $derived(status === 'scanning' || status === 'pending');
    const isFailed = $derived(status === 'failed');
    const isCompleted = $derived(status === 'completed');

    async function handleRetry() {
        await newsletterStore.startScan();
    }

    function handleDismiss() {
        newsletterStore.dismissScan();
    }
</script>

{#if status && (isScanning || isFailed || (isCompleted && !newsletterStore.isScanDismissed))}
    <div class="mb-8" transition:slide>
        <Card class={cn(
            "relative overflow-hidden transition-all duration-300 border shadow-md",
            isScanning ? "bg-primary text-primary-foreground border-primary" : 
            isFailed ? "bg-destructive text-destructive-foreground border-destructive" :
            "bg-green-600 text-white border-green-600"
        )}>
            {#if isCompleted}
                <button 
                    type="button"
                    class="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white z-20"
                    onclick={handleDismiss}
                    aria-label="Dismiss"
                >
                    <X class="w-4 h-4" />
                </button>
            {/if}

            <CardContent class="p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pr-4 md:pr-8">
                    <div class="flex-1 space-y-4">
                        <div class="flex items-center gap-4">
                            <div class="p-2.5 rounded-xl bg-white/20">
                                {#if isScanning}
                                    <Loader2 class="w-6 h-6 text-white animate-spin" />
                                {:else if isFailed}
                                    <AlertCircle class="w-6 h-6 text-white" />
                                {:else}
                                    <CheckCircle2 class="w-6 h-6 text-white" />
                                {/if}
                            </div>
                            <div>
                                <h3 class="font-black text-xl leading-none tracking-tight">
                                    {#if status === 'pending'}
                                        Preparing scan...
                                    {:else if status === 'scanning'}
                                        Scanning your emails
                                    {:else if isFailed}
                                        Scan Interrupted
                                    {:else}
                                        Scan Completed
                                    {/if}
                                </h3>
                                <p class="text-sm font-medium mt-1.5 opacity-90">
                                    {#if isScanning}
                                        Analyzing messages for newsletter patterns...
                                    {:else if isFailed}
                                        {settings?.error_message || "An unexpected error occurred during the scan."}
                                    {:else}
                                        Successfully analyzed {total} messages.
                                    {/if}
                                </p>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
                                <span>Progress</span>
                                <span>{Math.round(progress)}% ({processed} / {total})</span>
                            </div>
                            <div class="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                <div 
                                    class="h-full bg-white transition-all duration-500 ease-out" 
                                    style="width: {progress}%"
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-row md:flex-col items-center md:items-end gap-5 min-w-[120px]">
                        <div class="text-center md:text-right">
                            <p class="text-4xl font-black text-white leading-none">{detected}</p>
                            <p class="text-[10px] uppercase tracking-widest font-black text-white/80 mt-1">Detected</p>
                        </div>
                        
                        {#if isFailed}
                            <Button variant="secondary" size="sm" onclick={handleRetry} class="gap-2 font-bold shadow-lg">
                                <RefreshCw class="w-3.5 h-3.5" />
                                Retry Scan
                            </Button>
                        {:else if isCompleted}
                            <Button variant="secondary" size="sm" onclick={handleRetry} class="gap-2 font-bold shadow-lg bg-white text-green-700 hover:bg-white/90">
                                <RefreshCw class="w-3.5 h-3.5" />
                                Rescan
                            </Button>
                        {/if}
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
{/if}

