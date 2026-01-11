<script lang="ts">
    import { newsletterStore } from "../stores/newsletter.store.svelte";
    import { mailStore } from "$lib/features/mail/stores/mail.store.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/components/ui/card";
    import { Mail, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Zap, BarChart3, BellRing } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";
    import { cn } from "$lib/utils";

    let step = $state(1);
    const syncAvailable = $derived(mailStore.syncAvailable);

    const capabilities = [
        {
            icon: Sparkles,
            title: "Automatic Detection",
            description: "Automatically identify newsletters from your incoming emails using smart patterns."
        },
        {
            icon: BarChart3,
            title: "Frequency Tracking",
            description: "See how often you receive emails from each newsletter (daily, weekly, monthly)."
        },
        {
            icon: Zap,
            title: "Active Status",
            description: "Identify which newsletters are still active and which have gone silent."
        },
        {
            icon: BellRing,
            title: "Smart Insights",
            description: "Get insights on your reading habits and identify potential unsubscribes."
        }
    ];

    async function handleEnable() {
        await newsletterStore.enableNewsletter();
    }
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] p-4 max-w-4xl mx-auto">
    {#if !syncAvailable}
        <div class="w-full" in:fade>
            <Card class="w-full border-warning/50 bg-warning/5">
                <CardHeader class="text-center">
                    <div class="flex justify-center mb-4">
                        <div class="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                            <AlertTriangle class="w-8 h-8 text-warning" />
                        </div>
                    </div>
                    <CardTitle class="text-2xl">Mail Sync Required</CardTitle>
                    <CardDescription>
                        You need to enable Email Sync before you can use the Newsletter features.
                    </CardDescription>
                </CardHeader>
                <CardContent class="text-center">
                    <p class="text-muted-foreground mb-6">
                        Newsletter detection works by analyzing your synced emails. Once you connect your Gmail account, we can start identifying your newsletters.
                    </p>
                    <Button href="/dashboard/mails" variant="default" class="px-8">
                        Go to Mails to Connect
                        <ArrowRight class="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    {:else}
        <div class="w-full space-y-8">
            {#if step === 1}
                <div in:fade={{ duration: 300 }}>
                    <div class="text-center mb-8">
                        <h1 class="text-4xl font-bold tracking-tight mb-4">Master Your Newsletters</h1>
                        <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Organize and track your subscriptions automatically.
                        </p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        {#each capabilities as cap, i}
                            <Card class="bg-card/50 backdrop-blur-sm border-primary/10">
                                <CardHeader>
                                    <div class="flex items-center gap-4">
                                        <div class="p-2 rounded-lg bg-primary/10">
                                            <cap.icon class="w-6 h-6 text-primary" />
                                        </div>
                                        <CardTitle class="text-lg">{cap.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p class="text-sm text-muted-foreground">{cap.description}</p>
                                </CardContent>
                            </Card>
                        {/each}
                    </div>

                    <div class="flex justify-center">
                        <Button size="lg" class="px-10 h-12 text-lg" onclick={() => step = 2}>
                            See How It Works
                            <ArrowRight class="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            {:else if step === 2}
                <div in:fade={{ duration: 300 }}>
                    <Card class="border-primary/20 shadow-xl overflow-hidden">
                        <CardHeader class="bg-primary/5 pb-8">
                            <CardTitle class="text-2xl text-center">Ready to Start?</CardTitle>
                            <CardDescription class="text-center">
                                Here's what will happen when you enable newsletter detection:
                            </CardDescription>
                        </CardHeader>
                        <CardContent class="pt-8">
                            <ul class="space-y-6 max-w-md mx-auto">
                                <li class="flex items-start gap-4">
                                    <div class="mt-1 bg-green-500/20 p-1 rounded-full">
                                        <CheckCircle2 class="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p class="font-medium">Scan Existing Emails</p>
                                        <p class="text-sm text-muted-foreground">We'll look through your already synced emails to find newsletters.</p>
                                    </div>
                                </li>
                                <li class="flex items-start gap-4">
                                    <div class="mt-1 bg-green-500/20 p-1 rounded-full">
                                        <CheckCircle2 class="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p class="font-medium">Automatic Categorization</p>
                                        <p class="text-sm text-muted-foreground">New incoming emails will be automatically checked and grouped.</p>
                                    </div>
                                </li>
                                <li class="flex items-start gap-4">
                                    <div class="mt-1 bg-green-500/20 p-1 rounded-full">
                                        <CheckCircle2 class="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p class="font-medium">Smart Dashboard</p>
                                        <p class="text-sm text-muted-foreground">Your newsletter analytics will appear right here in this section.</p>
                                    </div>
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter class="flex justify-between bg-muted/30 p-6 border-t">
                            <Button variant="ghost" onclick={() => step = 1}>Back</Button>
                            <Button size="lg" class="px-8" onclick={handleEnable} disabled={newsletterStore.isLoading}>
                                {#if newsletterStore.isLoading}
                                    Enabling...
                                {:else}
                                    Enable Newsletter Detection
                                {/if}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            {/if}
        </div>
    {/if}
</div>

