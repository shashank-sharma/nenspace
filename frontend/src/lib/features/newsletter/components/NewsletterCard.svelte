<script lang="ts">
    import type { Newsletter } from "../types";
    import { getFrequencyLabel } from "../constants";
    import { Card, CardContent } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Mail, Calendar, Activity, ArrowUpRight, Inbox } from "lucide-svelte";
    import { DateUtil } from "$lib/utils";
    import { cn } from "$lib/utils";

    let { newsletter, onclick } = $props<{ newsletter: Newsletter, onclick?: () => void }>();

    const frequency = $derived(getFrequencyLabel(newsletter.frequency_days));
    const lastSeen = $derived(DateUtil.formatRelative(newsletter.last_seen));
    
    const frequencyColors = {
        daily: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50",
        weekly: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/50",
        biweekly: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50",
        monthly: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50",
        irregular: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/50"
    };
</script>

<Card 
    class="group hover:shadow-md transition-all duration-200 cursor-pointer border-primary/5 hover:border-primary/20 overflow-hidden"
    onclick={onclick}
>
    <CardContent class="p-0">
        <div class="p-5">
            <div class="flex justify-between items-start mb-4">
                <div class="p-2.5 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                    <Mail class="w-6 h-6 text-primary" />
                </div>
                <Badge variant="outline" class={cn("capitalize font-medium border shadow-none", frequencyColors[frequency])}>
                    {frequency}
                </Badge>
            </div>

            <div class="space-y-1 mb-4">
                <h3 class="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">
                    {newsletter.name || "Unknown Newsletter"}
                </h3>
                <p class="text-sm text-muted-foreground line-clamp-1 flex items-center gap-1.5">
                    {newsletter.sender_email}
                </p>
            </div>

            <div class="grid grid-cols-2 gap-4 py-4 border-y border-border/50">
                <div class="space-y-1">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total Emails</p>
                    <div class="flex items-center gap-2">
                        <Inbox class="w-3.5 h-3.5 text-blue-500" />
                        <span class="font-semibold text-sm">{newsletter.total_count}</span>
                    </div>
                </div>
                <div class="space-y-1">
                    <p class="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Last Seen</p>
                    <div class="flex items-center gap-2 text-muted-foreground">
                        <Calendar class="w-3.5 h-3.5" />
                        <span class="text-xs font-medium">{lastSeen}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="px-5 py-3 bg-muted/30 flex items-center justify-between group-hover:bg-muted/50 transition-colors">
            <div class="flex items-center gap-2">
                <div class={cn("w-2 h-2 rounded-full", newsletter.is_active ? "bg-green-500 animate-pulse" : "bg-slate-300")}></div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {newsletter.is_active ? "Active" : "Inactive"}
                </span>
            </div>
            <ArrowUpRight class="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
    </CardContent>
</Card>

