<script lang="ts">
    import type { Log } from '../types';
    import { LOG_LEVELS } from '../constants';
    import { DateUtil } from '$lib/utils/date.util';
    import { ChevronRight, ChevronDown, Hash, Clock, Box } from 'lucide-svelte';
    import { cn } from '$lib/utils';
    import { onMount } from 'svelte';
    import { animate } from 'animejs';

    let { log, isNew = false } = $props<{ log: Log; isNew?: boolean }>();

    let expanded = $state(false);
    let rowElement: HTMLElement;

    const config = $derived(LOG_LEVELS[log.level as keyof typeof LOG_LEVELS]);
    const Icon = $derived(config.icon);

    function expandIn(node: HTMLElement) {
        animate(node, {
            opacity: [0, 1],
            translateY: [-15, 0],
            height: [0, node.scrollHeight],
            duration: 300,
            easing: 'easeOutQuart',
            complete: () => {
                node.style.height = 'auto';
            }
        });
        return { duration: 300 };
    }

    function expandOut(node: HTMLElement) {
        animate(node, {
            opacity: [1, 0],
            translateY: [0, -15],
            height: [node.scrollHeight, 0],
            duration: 200,
            easing: 'easeInQuart'
        });
        return { duration: 200 };
    }

    onMount(() => {
        if (isNew) {
            animate(rowElement, {
                opacity: [0, 1],
                translateX: [-20, 0],
                backgroundColor: ['rgba(59, 130, 246, 0.15)', 'rgba(0, 0, 0, 0)'],
                duration: 500,
                easing: 'easeOutQuart'
            });
        }
    });

    function handleToggle(e: MouseEvent | KeyboardEvent) {
        if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Enter' && (e as KeyboardEvent).key !== ' ') return;
        expanded = !expanded;
    }
</script>

<div
    bind:this={rowElement}
    class="group log-row border-b border-border/40 hover:bg-muted/30 transition-colors font-mono text-[13px] leading-relaxed"
>

    <div
        class="flex items-center gap-3 px-4 py-2 cursor-pointer outline-none focus-visible:bg-muted/50"
        onclick={handleToggle}
        onkeydown={handleToggle}
        role="button"
        tabindex="0"
        aria-expanded={expanded}
    >
        <div class="flex items-center min-w-[140px] text-muted-foreground shrink-0">
            <span class="text-[11px] tabular-nums leading-none">
                {DateUtil.format(new Date(log.timestamp), { includeTime: true, seconds: true })}
            </span>
        </div>

        <div class={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider shrink-0",
            config.bg, config.color, config.border, "border"
        )}>
            <Icon class="h-3 w-3" />
            {config.label}
        </div>

        <div class="flex-1 min-w-0 break-words whitespace-pre-wrap">
            <span class="text-foreground/90">{log.message}</span>
            {#if log.source}
                <span class="text-muted-foreground/60 ml-2">[{log.source}]</span>
            {/if}
        </div>

        <div class="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {#if log.trace_id}
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    <Hash class="h-2.5 w-2.5" />
                    {log.trace_id.slice(0, 8)}
                </div>
            {/if}
            <div class={cn("transition-transform duration-200", expanded ? "rotate-180" : "")}>
                <ChevronDown class="h-4 w-4 text-muted-foreground" />
            </div>
        </div>
    </div>

    {#if expanded}
        <div
            in:expandIn
            out:expandOut
            class="px-4 ml-[140px] overflow-hidden"
        >
            <div class="pb-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/50 rounded-lg p-4 border border-border/40">
                <div class="space-y-4">
                    <section>
                        <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Box class="h-3 w-3" /> Details
                        </h4>
                        <div class="space-y-1.5">
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Log ID:</span>
                                <span class="text-foreground">{log.id}</span>
                            </div>
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Project:</span>
                                <span class="text-foreground">{log.expand?.project?.name || log.project}</span>
                            </div>
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Source:</span>
                                <span class="text-foreground">{log.source || 'N/A'}</span>
                            </div>
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Trace ID:</span>
                                <span class="text-foreground">{log.trace_id || 'N/A'}</span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Clock class="h-3 w-3" /> Timestamps
                        </h4>
                        <div class="space-y-1.5">
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Event:</span>
                                <span class="text-foreground">{log.timestamp}</span>
                            </div>
                            <div class="flex gap-2">
                                <span class="text-muted-foreground w-20">Ingested:</span>
                                <span class="text-foreground">{log.created}</span>
                            </div>
                        </div>
                    </section>
                </div>

                <section>
                    <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Context / Metadata</h4>
                    <div class="bg-background/50 rounded p-3 overflow-x-auto">
                        <pre class="text-[12px]">{JSON.stringify(log.context, null, 2)}</pre>
                    </div>
                </section>
            </div>
        </div>
    </div>
    {/if}
</div>

