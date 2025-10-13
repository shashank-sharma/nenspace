<script lang="ts">
    import { IslandNotificationService } from "$lib/services/island-notification.service.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Card } from "$lib/components/ui/card";
    import { Sparkles } from "lucide-svelte";

    // Simulate a long-running process
    function simulateProcessing() {
        IslandNotificationService.loading("Processing data...");
        setTimeout(() => {
            IslandNotificationService.success("Data processed successfully!");
        }, 3000);
    }

    // Simulate an error
    function simulateError() {
        IslandNotificationService.error("Connection failed");
    }

    // Simulate a warning
    function simulateWarning() {
        IslandNotificationService.warning("Low storage space");
    }

    // Simulate an info notification
    function simulateInfo() {
        IslandNotificationService.info("New message received");
    }

    // Simulate a success notification
    function simulateSuccess() {
        IslandNotificationService.success("Task completed!");
    }

    // Simulate loading (no auto-dismiss)
    function simulateLoading() {
        IslandNotificationService.loading("Uploading file...", { duration: 0 });
        // Manually dismiss after 5 seconds
        setTimeout(() => {
            IslandNotificationService.hide();
        }, 5000);
    }

    // Simulate queue
    function simulateQueue() {
        IslandNotificationService.info("First notification", {
            duration: 2000,
        });
        IslandNotificationService.success("Second notification", {
            duration: 2000,
        });
        IslandNotificationService.warning("Third notification", {
            duration: 2000,
        });
    }

    // Custom colors
    function simulateCustom() {
        IslandNotificationService.show("Custom styled message", "custom", {
            duration: 3000,
            icon: Sparkles,
            backgroundColor: "bg-purple-600",
            textColor: "text-purple-100",
        });
    }
</script>

<div class="container mx-auto p-8">
    <div class="space-y-8">
        <!-- Header -->
        <div>
            <h1 class="text-3xl font-bold mb-2">Island Notification Demo</h1>
            <p class="text-muted-foreground">
                A reusable notification component inspired by macOS Dynamic
                Island
            </p>
        </div>

        <!-- Interactive Demo -->
        <Card class="p-6">
            <h2 class="text-2xl font-semibold mb-4">Interactive Demo</h2>
            <div class="flex flex-wrap gap-2">
                <Button variant="default" on:click={() => simulateSuccess()}>
                    Success
                </Button>
                <Button variant="destructive" on:click={() => simulateError()}>
                    Error
                </Button>
                <Button variant="secondary" on:click={() => simulateInfo()}>
                    Info
                </Button>
                <Button variant="outline" on:click={() => simulateWarning()}>
                    Warning
                </Button>
                <Button variant="outline" on:click={() => simulateProcessing()}>
                    Processing (3s)
                </Button>
                <Button variant="outline" on:click={() => simulateLoading()}>
                    Loading (5s)
                </Button>
                <Button variant="outline" on:click={() => simulateQueue()}>
                    Queue (3 items)
                </Button>
                <Button variant="outline" on:click={() => simulateCustom()}>
                    Custom Style
                </Button>
            </div>
        </Card>

        <!-- Code Examples -->
        <Card class="p-6">
            <h2 class="text-2xl font-semibold mb-4">Usage Examples</h2>
            <div class="space-y-4">
                <div class="space-y-2">
                    <h3 class="font-semibold">Import the service</h3>
                    <pre
                        class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code
                            >{`import { IslandNotificationService } from '$lib/services/island-notification.service.svelte';`}</code
                        ></pre>
                </div>

                <div class="space-y-2">
                    <h3 class="font-semibold">Simple notifications</h3>
                    <pre
                        class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code
                            >{`// Success
IslandNotificationService.success('Task created!');

// Error
IslandNotificationService.error('Failed to save');

// Info
IslandNotificationService.info('New message');

// Warning
IslandNotificationService.warning('Low storage');

// Loading (no auto-dismiss)
IslandNotificationService.loading('Uploading...');`}</code
                        ></pre>
                </div>

                <div class="space-y-2">
                    <h3 class="font-semibold">Custom duration</h3>
                    <pre
                        class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code
                            >{`// Show for 5 seconds
IslandNotificationService.info('Hello', { duration: 5000 });

// No auto-dismiss (duration: 0)
IslandNotificationService.loading('Processing...', { duration: 0 });`}</code
                        ></pre>
                </div>

                <div class="space-y-2">
                    <h3 class="font-semibold">Manual dismiss</h3>
                    <pre
                        class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code
                            >{`// Hide current notification
IslandNotificationService.hide();

// Clear all (current + queue)
IslandNotificationService.clear();`}</code
                        ></pre>
                </div>
            </div>
        </Card>

        <!-- Use Cases -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card class="p-4">
                <h3 class="font-semibold mb-2">Page Load</h3>
                <p class="text-sm text-muted-foreground mb-2">
                    Show loading state while fetching data, then success/error
                </p>
                <pre class="bg-muted p-3 rounded text-xs overflow-x-auto"><code
                        >{`onMount(async () => {
    IslandNotificationService.loading('Loading...');
    try {
        await fetchData();
        IslandNotificationService.success('Loaded!');
    } catch (error) {
        IslandNotificationService.error('Failed');
    }
});`}</code
                    ></pre>
            </Card>

            <Card class="p-4">
                <h3 class="font-semibold mb-2">Form Submission</h3>
                <p class="text-sm text-muted-foreground mb-2">
                    Indicate submission progress and result
                </p>
                <pre class="bg-muted p-3 rounded text-xs overflow-x-auto"><code
                        >{`async function handleSubmit() {
    IslandNotificationService.loading('Saving...');
    try {
        await api.save(data);
        IslandNotificationService.success('Saved!');
    } catch (error) {
        IslandNotificationService.error('Failed');
    }
}`}</code
                    ></pre>
            </Card>

            <Card class="p-4">
                <h3 class="font-semibold mb-2">File Upload</h3>
                <p class="text-sm text-muted-foreground mb-2">
                    Display upload progress with persistent notification
                </p>
                <pre class="bg-muted p-3 rounded text-xs overflow-x-auto"><code
                        >{`async function upload(file) {
    IslandNotificationService.loading(
        'Uploading...', 
        { duration: 0 }
    );
    try {
        await uploadFile(file);
        IslandNotificationService.success('Uploaded!');
    } catch (error) {
        IslandNotificationService.error('Failed');
    }
}`}</code
                    ></pre>
            </Card>

            <Card class="p-4">
                <h3 class="font-semibold mb-2">Offline Detection</h3>
                <p class="text-sm text-muted-foreground mb-2">
                    Alert users when going offline/online
                </p>
                <pre class="bg-muted p-3 rounded text-xs overflow-x-auto"><code
                        >{`window.addEventListener('offline', () => {
    IslandNotificationService.warning(
        'You are offline',
        { duration: 0 }
    );
});

window.addEventListener('online', () => {
    IslandNotificationService.success('Back online!');
});`}</code
                    ></pre>
            </Card>
        </div>

        <!-- Features -->
        <Card class="p-6">
            <h2 class="text-2xl font-semibold mb-4">Features</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Variants</Badge>
                    <p class="text-sm text-muted-foreground">
                        Success, error, info, warning, loading with default
                        styling
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Animations</Badge>
                    <p class="text-sm text-muted-foreground">
                        Smooth spring-based transitions and blur effects
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Queue</Badge>
                    <p class="text-sm text-muted-foreground">
                        Multiple notifications shown sequentially
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Auto-dismiss</Badge>
                    <p class="text-sm text-muted-foreground">
                        Configurable duration or persistent notifications
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Global</Badge>
                    <p class="text-sm text-muted-foreground">
                        Works across all pages via singleton service
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <Badge variant="secondary">Accessible</Badge>
                    <p class="text-sm text-muted-foreground">
                        Proper ARIA attributes for screen readers
                    </p>
                </div>
            </div>
        </Card>
    </div>
</div>
