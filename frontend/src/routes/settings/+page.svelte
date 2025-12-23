<!-- src/routes/dashboard/settings/+page.svelte -->
<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Separator } from "$lib/components/ui/separator";
    import {
        Bell,
        Shield,
        User,
        Palette,
        Globe,
        HardDrive,
        KeyRound,
        Share2,
        Clock,
        Zap,
        Bug,
    } from "lucide-svelte";

    import NotificationsPage from "./notifications/+page.svelte";
    import PrivacyPage from "./privacy/+page.svelte";
    import AppearancePage from "./appearance/+page.svelte";
    import AccountPage from "./account/+page.svelte";
    import DebugPage from "./debug/+page.svelte";

    const sections = [
        {
            id: "notifications",
            title: "Notifications",
            description: "Manage how you receive notifications",
            icon: Bell,
            component: NotificationsPage,
        },
        {
            id: "privacy",
            title: "Privacy & Security",
            description: "Manage your privacy and security settings",
            icon: Shield,
            component: PrivacyPage,
        },
        {
            id: "appearance",
            title: "Appearance",
            description: "Customize how Life Balance looks on your device",
            icon: Palette,
            component: AppearancePage,
        },
        {
            id: "account",
            title: "Account",
            description: "Manage your account settings and preferences",
            icon: User,
            component: AccountPage,
        },
        {
            id: "integrations",
            title: "Integrations",
            description: "Connect and manage third-party services",
            icon: Share2,
        },
        {
            id: "storage",
            title: "Storage",
            description: "Manage your storage and data preferences",
            icon: HardDrive,
        },
        {
            id: "language",
            title: "Language & Region",
            description: "Set your language and regional preferences",
            icon: Globe,
        },
        {
            id: "performance",
            title: "Performance",
            description: "Optimize app performance and usage",
            icon: Zap,
        },
        {
            id: "api",
            title: "API Access",
            description: "Manage API keys and access tokens",
            icon: KeyRound,
        },
        {
            id: "automation",
            title: "Automation",
            description: "Configure automated tasks and schedules",
            icon: Clock,
        },
        {
            id: "debug",
            title: "Debug & Development",
            description: "Developer tools and debugging options",
            icon: Bug,
            component: DebugPage,
        },
    ];

    let selectedSection = sections[0].id;

    $: currentSection = sections.find((s) => s.id === selectedSection);
</script>

<div class="container py-8">
    <div class="flex flex-col md:flex-row gap-8">
        <!-- Sidebar -->
        <div class="w-full md:w-64 space-y-1">
            {#each sections as section}
                <Button
                    variant={selectedSection === section.id
                        ? "secondary"
                        : "ghost"}
                    class="w-full justify-start"
                    on:click={() => (selectedSection = section.id)}
                >
                    <svelte:component
                        this={section.icon}
                        class="mr-2 h-4 w-4"
                    />
                    {section.title}
                </Button>
            {/each}
        </div>

        <!-- Main Content -->
        <div class="flex-1">
            {#if currentSection}
                <Card class="w-full">
                    <CardHeader>
                        <div class="flex items-center gap-2">
                            <svelte:component
                                this={currentSection.icon}
                                class="h-5 w-5"
                            />
                            <CardTitle>{currentSection.title}</CardTitle>
                        </div>
                        <CardDescription
                            >{currentSection.description}</CardDescription
                        >
                    </CardHeader>

                    <Separator />

                    <CardContent class="pt-6">
                        {#if currentSection.component}
                            <svelte:component this={currentSection.component} />
                        {:else}
                            <div class="space-y-6">
                                <div>
                                    <h3 class="text-lg font-medium">
                                        {currentSection.title} Settings
                                    </h3>
                                    <p class="text-sm text-muted-foreground">
                                        Coming soon...
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            {/if}
        </div>
    </div>
</div>
