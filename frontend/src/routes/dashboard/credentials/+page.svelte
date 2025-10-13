<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { KeySquare, Terminal, KeyRound, RefreshCcw } from "lucide-svelte";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import { CredentialsService } from "$lib/features/credentials/services";
    import { withErrorHandling } from "$lib/utils";
    import type { CredentialsStats } from "$lib/features/credentials/types";

    let stats = $state<CredentialsStats>({
        totalTokens: 0,
        totalDeveloperTokens: 0,
        totalApiKeys: 0,
        totalSecurityKeys: 0,
    });
    let isLoading = $state(true);

    async function loadStats(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;
        if (reset) {
            stats = {
                totalTokens: 0,
                totalDeveloperTokens: 0,
                totalApiKeys: 0,
                totalSecurityKeys: 0,
            };
        }

        await withErrorHandling(
            async () => {
                // Fetch all collections in parallel
                const [tokens, devTokens, securityKeys] = await Promise.all([
                    CredentialsService.getTokens(),
                    CredentialsService.getDeveloperTokens(),
                    CredentialsService.getSecurityKeys(),
                ]);

                return {
                    totalTokens: tokens.length,
                    totalDeveloperTokens: devTokens.length,
                    totalApiKeys: 0, // Placeholder - collection doesn't exist yet
                    totalSecurityKeys: securityKeys.length,
                };
            },
            {
                errorMessage: "Failed to load credentials stats",
                onSuccess: (result) => {
                    stats = result;
                },
            },
        );

        isLoading = false;
    }

    function navigateToSection(path: string) {
        goto(path);
    }

    onMount(() => {
        loadStats(true);
    });
</script>

<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Credentials Overview</h2>
        <Button
            variant="outline"
            onclick={() => loadStats(true)}
            disabled={isLoading}
        >
            <RefreshCcw
                class="w-4 h-4 mr-2 {isLoading ? 'animate-spin' : ''}"
            />
            Refresh
        </Button>
    </div>

    {#if isLoading}
        <LoadingSpinner
            size="lg"
            centered
            label="Loading credentials stats..."
        />
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- API Tokens Card -->
            <Card.Root
                class="cursor-pointer hover:bg-accent/50 transition-colors"
                role="button"
                tabindex={0}
                onkeydown={(e) =>
                    e.key === "Enter" &&
                    navigateToSection("/dashboard/credentials/tokens")}
                onclick={() =>
                    navigateToSection("/dashboard/credentials/tokens")}
            >
                <Card.Header
                    class="flex flex-row items-center justify-between space-y-0 pb-2"
                >
                    <Card.Title class="text-xl font-medium"
                        >API Tokens</Card.Title
                    >
                    <KeySquare class="h-5 w-5 text-muted-foreground" />
                </Card.Header>
                <Card.Content>
                    <div class="text-3xl font-bold">
                        {stats.totalTokens}
                    </div>
                    <p class="text-xs text-muted-foreground">
                        OAuth and API tokens for external services
                    </p>
                </Card.Content>
            </Card.Root>

            <!-- Developer Tokens Card -->
            <Card.Root
                class="cursor-pointer hover:bg-accent/50 transition-colors"
                role="button"
                tabindex={0}
                onkeydown={(e) =>
                    e.key === "Enter" &&
                    navigateToSection("/dashboard/credentials/developer")}
                onclick={() =>
                    navigateToSection("/dashboard/credentials/developer")}
            >
                <Card.Header
                    class="flex flex-row items-center justify-between space-y-0 pb-2"
                >
                    <Card.Title class="text-xl font-medium"
                        >Developer Tokens</Card.Title
                    >
                    <Terminal class="h-5 w-5 text-muted-foreground" />
                </Card.Header>
                <Card.Content>
                    <div class="text-3xl font-bold">
                        {stats.totalDeveloperTokens}
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Personal access tokens for development
                    </p>
                </Card.Content>
            </Card.Root>

            <!-- API Keys Card - Coming Soon -->
            <Card.Root class="opacity-50 cursor-not-allowed">
                <Card.Header
                    class="flex flex-row items-center justify-between space-y-0 pb-2"
                >
                    <Card.Title class="text-xl font-medium"
                        >API Keys
                        <span class="text-xs text-muted-foreground ml-2"
                            >(Coming Soon)</span
                        ></Card.Title
                    >
                    <KeyRound class="h-5 w-5 text-muted-foreground" />
                </Card.Header>
                <Card.Content>
                    <div class="text-3xl font-bold">
                        {stats.totalApiKeys}
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Service-specific API keys and secrets
                    </p>
                </Card.Content>
            </Card.Root>

            <!-- Security Keys Card -->
            <Card.Root
                class="cursor-pointer hover:bg-accent/50 transition-colors"
                role="button"
                tabindex={0}
                onkeydown={(e) =>
                    e.key === "Enter" &&
                    navigateToSection("/dashboard/credentials/security-keys")}
                onclick={() =>
                    navigateToSection("/dashboard/credentials/security-keys")}
            >
                <Card.Header
                    class="flex flex-row items-center justify-between space-y-0 pb-2"
                >
                    <Card.Title class="text-xl font-medium"
                        >Security Keys</Card.Title
                    >
                    <KeyRound class="h-5 w-5 text-muted-foreground" />
                </Card.Header>
                <Card.Content>
                    <div class="text-3xl font-bold">
                        {stats.totalSecurityKeys}
                    </div>
                    <p class="text-xs text-muted-foreground">
                        SSH key pairs for secure server connections
                    </p>
                </Card.Content>
            </Card.Root>
        </div>
    {/if}
</div>
