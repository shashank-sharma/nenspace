<script lang="ts">
    import StatusIndicator from "$lib/components/StatusIndicator.svelte";
    import { Button } from "$lib/components/ui/button";
    import { onMount } from "svelte";

    let currentStatus:
        | "idle"
        | "ring"
        | "timer"
        | "processing"
        | "success"
        | "error" = "idle";
    let customText = "";
    let customIcon = "";

    // Demo states
    const states = [
        { status: "idle", text: "Idle", color: "white", bg: "black" },
        { status: "ring", text: "Notification", color: "white", bg: "black" },
        { status: "timer", text: "Timer", color: "white", bg: "black" },
        {
            status: "processing",
            text: "Processing",
            color: "white",
            bg: "black",
        },
        { status: "success", text: "Success", color: "white", bg: "green" },
        { status: "error", text: "Error", color: "white", bg: "red" },
    ];

    // Simulate a long-running process
    function simulateProcessing() {
        currentStatus = "processing";
        customText = "Processing data...";
        setTimeout(() => {
            currentStatus = "success";
            customText = "Data processed successfully!";
            setTimeout(() => {
                currentStatus = "idle";
                customText = "";
            }, 3000);
        }, 5000);
    }

    // Simulate an error
    function simulateError() {
        currentStatus = "error";
        customText = "Connection failed";
        setTimeout(() => {
            currentStatus = "idle";
            customText = "";
        }, 3000);
    }

    // Simulate a notification
    function simulateNotification() {
        currentStatus = "ring";
        customText = "New message";
        setTimeout(() => {
            currentStatus = "idle";
            customText = "";
        }, 10000);
    }

    // Simulate a timer
    function simulateTimer() {
        currentStatus = "timer";
        customText = "Meeting in 5 min";
        setTimeout(() => {
            currentStatus = "idle";
            customText = "";
        }, 10000);
    }
</script>

<div class="container mx-auto p-8">
    <h1 class="text-3xl font-bold mb-8">Status Indicator Demo</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Demo Section -->
        <div class="space-y-8">
            <h2 class="text-2xl font-semibold mb-4">Interactive Demo</h2>
            <div class="flex flex-col items-center space-y-4">
                <StatusIndicator
                    status={currentStatus}
                    text={customText}
                    icon={customIcon}
                    backgroundColor={states.find(
                        (s) => s.status === currentStatus,
                    )?.bg || "black"}
                    color={states.find((s) => s.status === currentStatus)
                        ?.color || "white"}
                />

                <div class="flex flex-wrap gap-2 justify-center">
                    <Button variant="outline" on:click={simulateProcessing}>
                        Simulate Processing
                    </Button>
                    <Button variant="outline" on:click={simulateError}>
                        Simulate Error
                    </Button>
                    <Button variant="outline" on:click={simulateNotification}>
                        Simulate Notification
                    </Button>
                    <Button variant="outline" on:click={simulateTimer}>
                        Simulate Timer
                    </Button>
                </div>
            </div>
        </div>

        <!-- Use Cases Section -->
        <div class="space-y-8">
            <h2 class="text-2xl font-semibold mb-4">Use Cases</h2>
            <div class="space-y-4">
                <div class="p-4 bg-gray-100 rounded-lg">
                    <h3 class="font-semibold mb-2">1. Backend Health Check</h3>
                    <div class="text-sm text-gray-600">
                        Show real-time backend connection status with different
                        states:
                        <ul class="list-disc ml-4 mt-2">
                            <li>Idle: Normal connection</li>
                            <li>Processing: Checking health</li>
                            <li>Success: Backend is healthy</li>
                            <li>Error: Connection issues</li>
                        </ul>
                    </div>
                </div>

                <div class="p-4 bg-gray-100 rounded-lg">
                    <h3 class="font-semibold mb-2">2. File Upload Status</h3>
                    <div class="text-sm text-gray-600">
                        Display file upload progress and status:
                        <ul class="list-disc ml-4 mt-2">
                            <li>Processing: Upload in progress</li>
                            <li>Success: Upload complete</li>
                            <li>Error: Upload failed</li>
                        </ul>
                    </div>
                </div>

                <div class="p-4 bg-gray-100 rounded-lg">
                    <h3 class="font-semibold mb-2">3. Notification System</h3>
                    <div class="text-sm text-gray-600">
                        Show notification states:
                        <ul class="list-disc ml-4 mt-2">
                            <li>Ring: New notification</li>
                            <li>Timer: Scheduled notification</li>
                            <li>Success: Notification sent</li>
                        </ul>
                    </div>
                </div>

                <div class="p-4 bg-gray-100 rounded-lg">
                    <h3 class="font-semibold mb-2">4. Form Submission</h3>
                    <div class="text-sm text-gray-600">
                        Indicate form submission status:
                        <ul class="list-disc ml-4 mt-2">
                            <li>Processing: Submitting form</li>
                            <li>Success: Form submitted successfully</li>
                            <li>Error: Validation errors</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
