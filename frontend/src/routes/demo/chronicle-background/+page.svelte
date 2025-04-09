<script lang="ts">
    import ChronicleBackground from "$lib/features/chronicles/components/ChronicleBackground.svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardFooter,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";

    type Season = "Winter" | "Spring" | "Summer" | "Autumn";

    interface ConfigProps {
        startingSeason?: Season;
        enableControls?: boolean;
        height?: string;
        width?: string;
    }

    interface DemoConfig {
        id: string;
        title: string;
        description: string;
        props: ConfigProps;
    }

    // Demo configurations
    const configurations: DemoConfig[] = [
        {
            id: "default",
            title: "Default Configuration",
            description:
                "ChronicleBackground with default settings - starts in Winter with controls enabled.",
            props: {},
        },
        {
            id: "summer",
            title: "Summer Season",
            description: "Pre-configured to display Summer season.",
            props: { startingSeason: "Summer", height: "400px" },
        },
        {
            id: "autumn-no-controls",
            title: "Autumn Without Controls",
            description:
                "Displays Autumn season with season controls disabled.",
            props: {
                startingSeason: "Autumn",
                enableControls: false,
                height: "300px",
            },
        },
        {
            id: "spring-custom-size",
            title: "Spring with Custom Size",
            description: "Spring season with custom dimensions.",
            props: { startingSeason: "Spring", height: "250px", width: "100%" },
        },
    ];
</script>

<div class="container py-8">
    <h1 class="text-3xl font-bold mb-6">ChronicleBackground Component Demo</h1>
    <p class="text-muted-foreground mb-8">
        This interactive seasonal background component displays different
        weather effects and color schemes based on the selected season.
    </p>

    <div class="grid gap-8">
        {#each configurations as config}
            <Card id={config.id} class="overflow-hidden">
                <CardHeader class="pb-2">
                    <CardTitle>{config.title}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent class="p-0">
                    <div class="w-full">
                        <ChronicleBackground {...config.props} />
                    </div>
                </CardContent>
                <CardFooter class="pt-4">
                    <div class="text-xs text-muted-foreground">
                        <code class="bg-muted p-1 rounded">
                            &lt;ChronicleBackground
                            {#each Object.entries(config.props) as [key, value]}
                                {key}="{value}"
                            {/each}
                            /&gt;
                        </code>
                    </div>
                </CardFooter>
            </Card>
        {/each}
    </div>
</div>

<style>
    /* Local styling for the demo page */
    :global(.season-wrapper) {
        border-radius: 0.5rem;
    }
</style>
