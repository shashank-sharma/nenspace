<script lang="ts">
    /**
     * Comprehensive Notification Debug Settings
     * 
     * Complete testing suite for the enhanced status indicator system
     */
    import { 
        NotificationBroadcaster, 
        IslandController,
        NotificationQueueService,
        IslandPriority,
        NotificationSeverity,
        notificationFactory,
        notificationRegistry,
    } from "$lib/features/status-indicator";
    import * as Views from "$lib/features/status-indicator/components/views";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { 
        CheckCircle2, 
        XCircle, 
        Info, 
        AlertTriangle, 
        Loader2,
        Mail,
        Sparkles,
        Music,
        Trash2,
        RefreshCw,
        Calendar,
        CheckSquare,
        AlertCircle,
        Zap,
        Layers,
        Clock,
        Settings
    } from "lucide-svelte";
    import { getSeverityConfig, SEVERITY_CONFIGS } from "$lib/features/status-indicator/types/severity.types";

    let testCount = $state(0);
    let animationSpeed = $state(1.0);
    let queueSize = $derived(NotificationQueueService.size);

    // Standard notifications
    function testSuccess() {
        testCount++;
        NotificationBroadcaster.success(`Success notification #${testCount}`);
    }

    function testError() {
        testCount++;
        NotificationBroadcaster.error(`Error notification #${testCount}`);
    }

    function testInfo() {
        testCount++;
        NotificationBroadcaster.info(`Info notification #${testCount}`);
    }

    function testWarning() {
        testCount++;
        NotificationBroadcaster.warning(`Warning notification #${testCount}`);
    }

    function testLoading() {
        testCount++;
        NotificationBroadcaster.loading(`Loading... #${testCount}`, { duration: 5000 });
    }

    // Long text notifications
    function testLongText() {
        testCount++;
        NotificationBroadcaster.bigText(
            `This is an extremely long notification message that should definitely trigger horizontal scrolling animation`,
            { duration: 8000 }
        );
    }

    // Severity tests
    function testSeverity(severity: NotificationSeverity) {
        testCount++;
        const config = getSeverityConfig(severity);
        const notification = notificationFactory.create(
            'standard',
            { message: `${config.name} severity notification` },
            { severity }
        );
        NotificationQueueService.enqueue(notification);
        processNext();
    }

    // System notifications
    function testSystem(type: 'update' | 'maintenance' | 'alert' | 'info') {
        testCount++;
        NotificationBroadcaster.system(
            `${type.charAt(0).toUpperCase() + type.slice(1)} notification: System ${type} in progress`,
            type,
            { severity: NotificationSeverity.HIGH }
        );
    }

    // Calendar notifications
    function testCalendar() {
        testCount++;
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 1);
        NotificationBroadcaster.calendar(
            `event_${testCount}`,
            'Team Meeting',
            startTime,
            {
                severity: NotificationSeverity.MEDIUM,
                location: 'Conference Room A',
                description: 'Quarterly planning session',
            }
        );
    }

    // Task notifications
    function testTask(type: 'completed' | 'due' | 'overdue' | 'progress') {
        testCount++;
        const dueDate = new Date();
        if (type === 'overdue') {
            dueDate.setDate(dueDate.getDate() - 1);
        } else if (type === 'due') {
            dueDate.setDate(dueDate.getDate() + 1);
        }
        
        NotificationBroadcaster.task(
            `task_${testCount}`,
            `Task ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            type,
            {
                severity: type === 'overdue' ? NotificationSeverity.HIGH : NotificationSeverity.MEDIUM,
                dueDate: type !== 'completed' ? dueDate : undefined,
                progress: type === 'progress' ? 75 : undefined,
            }
        );
    }

    // Email notifications
    function testEmail(longSubject = false) {
        testCount++;
        const notification = notificationFactory.createEmail(
            'Alice Smith',
            longSubject 
                ? 'Extremely long subject line that will definitely require marquee scrolling animation to see the whole content' 
                : 'Project Update',
            'Hey! Just wanted to let you know that the new dashboard refactoring is going great.',
            {
                avatar: 'https://i.pravatar.cc/150?u=alice',
                severity: NotificationSeverity.MEDIUM,
            }
        );
        NotificationQueueService.enqueue(notification);
        processNext();
    }

    // Batching tests
    function testBatching() {
        testCount++;
        // Send multiple similar notifications rapidly
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const notification = notificationFactory.createStandard(
                    'info',
                    `Batched notification ${i + 1}`,
                    { severity: NotificationSeverity.INFO }
                );
                NotificationQueueService.enqueue(notification);
                processNext();
            }, i * 100); // 100ms apart
        }
    }

    // Queue overflow test
    function testQueueOverflow() {
        testCount++;
        // Add many notifications
        for (let i = 0; i < 20; i++) {
            const notification = notificationFactory.createStandard(
                'info',
                `Queue test ${i + 1}`,
                { severity: NotificationSeverity.INFO }
            );
            NotificationQueueService.enqueue(notification);
        }
        processNext();
    }

    // Animation preset tests
    function testAnimationPreset(preset: 'gentle' | 'snappy' | 'bouncy' | 'critical') {
        testCount++;
        const notification = notificationFactory.createBigText(
            `${preset.charAt(0).toUpperCase() + preset.slice(1)} animation test`,
            {
                severity: preset === 'critical' ? NotificationSeverity.CRITICAL : NotificationSeverity.HIGH,
                duration: 5000,
            }
        );
        NotificationQueueService.enqueue(notification);
        processNext();
    }

    // Process next notification from queue
    function processNext() {
        const next = NotificationQueueService.dequeue();
        if (!next) return;

        if ('count' in next && next.count > 1) {
            // Batched notification
            const batch = next as any;
            const typeConfig = notificationRegistry.get(batch.type);
            if (!typeConfig) return;

            IslandController.show({
                id: `batch_${batch.key}`,
                priority: batch.priority,
                dimensions: typeConfig.dimensions,
                component: typeConfig.viewComponent,
                props: {
                    ...batch.latest.payload,
                    batchCount: batch.count,
                    severity: batch.latest.severity,
                },
                duration: batch.latest.duration,
            });
        } else {
            // Single notification
            const notification = next as any;
            const typeConfig = notificationRegistry.get(notification.type);
            if (!typeConfig) return;

            IslandController.show({
                id: notification.id,
                priority: typeConfig.priority,
                dimensions: typeConfig.dimensions,
                component: typeConfig.viewComponent,
                props: {
                    ...notification.payload,
                    severity: notification.severity,
                },
                duration: notification.duration,
            });
        }
    }

    function clearAll() {
        IslandController.clear();
        NotificationBroadcaster.clear();
        NotificationQueueService.clear();
    }

    function resetToTime() {
        clearAll();
        IslandController.show('time');
    }
</script>

<div class="space-y-6 p-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-lg font-semibold">Status Indicator Testing</h3>
            <p class="text-sm text-muted-foreground mt-1">
                Comprehensive testing suite for notification system
            </p>
        </div>
        <div class="flex items-center gap-2">
        <Badge variant="outline" class="text-xs">
                Tests: {testCount}
            </Badge>
            <Badge variant="secondary" class="text-xs">
                Queue: {queueSize}
        </Badge>
        </div>
    </div>

    <!-- Standard Notifications -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Info class="h-4 w-4" /> Standard Notifications
        </h4>
        <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testSuccess}>
                <CheckCircle2 class="h-4 w-4 text-green-600" /> Success
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testError}>
                <XCircle class="h-4 w-4 text-red-600" /> Error
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testWarning}>
                <AlertTriangle class="h-4 w-4 text-yellow-600" /> Warning
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testInfo}>
                <Info class="h-4 w-4 text-blue-600" /> Info
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testLoading}>
                <Loader2 class="h-4 w-4 text-gray-600" /> Loading
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testLongText}>
                <Sparkles class="h-4 w-4 text-yellow-500" /> Long Text
            </Button>
        </div>
    </div>

    <!-- Severity Levels -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Layers class="h-4 w-4" /> Severity Levels
        </h4>
        <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSeverity(NotificationSeverity.CRITICAL)}>
                <AlertCircle class="h-4 w-4 text-red-600" /> Critical
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSeverity(NotificationSeverity.HIGH)}>
                <AlertTriangle class="h-4 w-4 text-orange-600" /> High
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSeverity(NotificationSeverity.MEDIUM)}>
                <Info class="h-4 w-4 text-yellow-600" /> Medium
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSeverity(NotificationSeverity.LOW)}>
                <Clock class="h-4 w-4 text-gray-600" /> Low
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2 col-span-2" onclick={() => testSeverity(NotificationSeverity.INFO)}>
                <Info class="h-4 w-4 text-blue-600" /> Info
            </Button>
        </div>
        <!-- Severity color preview -->
        <div class="grid grid-cols-5 gap-1 mt-2">
            {#each Object.values(SEVERITY_CONFIGS) as config}
                <div 
                    class="h-8 rounded text-xs flex items-center justify-center text-white font-medium"
                    style="background-color: {config.colors.bgRgb};"
                    title={config.name}
                >
                    {config.name.charAt(0)}
                </div>
            {/each}
        </div>
    </div>

    <!-- Notification Types -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap class="h-4 w-4" /> Notification Types
        </h4>
        <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSystem('update')}>
                <Sparkles class="h-4 w-4 text-blue-500" /> System Update
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSystem('maintenance')}>
                <Settings class="h-4 w-4 text-orange-500" /> Maintenance
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testSystem('alert')}>
                <AlertCircle class="h-4 w-4 text-red-500" /> Alert
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testCalendar}>
                <Calendar class="h-4 w-4 text-purple-500" /> Calendar
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testTask('completed')}>
                <CheckSquare class="h-4 w-4 text-green-500" /> Task Complete
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testTask('due')}>
                <Clock class="h-4 w-4 text-yellow-500" /> Task Due
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testTask('overdue')}>
                <AlertCircle class="h-4 w-4 text-red-500" /> Task Overdue
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testTask('progress')}>
                <Layers class="h-4 w-4 text-blue-500" /> Task Progress
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testEmail(false)}>
                <Mail class="h-4 w-4 text-blue-500" /> Email
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testEmail(true)}>
                <Mail class="h-4 w-4 text-blue-500" /> Long Subject
            </Button>
        </div>
    </div>

    <!-- Advanced Tests -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap class="h-4 w-4" /> Advanced Tests
        </h4>
        <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testBatching}>
                <Layers class="h-4 w-4" /> Test Batching
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={testQueueOverflow}>
                <Layers class="h-4 w-4" /> Queue Overflow
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testAnimationPreset('gentle')}>
                <Sparkles class="h-4 w-4" /> Gentle Animation
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testAnimationPreset('snappy')}>
                <Zap class="h-4 w-4" /> Snappy Animation
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testAnimationPreset('bouncy')}>
                <Sparkles class="h-4 w-4" /> Bouncy Animation
            </Button>
            <Button variant="outline" size="sm" class="justify-start gap-2" onclick={() => testAnimationPreset('critical')}>
                <AlertCircle class="h-4 w-4" /> Critical Animation
            </Button>
        </div>
    </div>

    <!-- Controls -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Settings class="h-4 w-4" /> Controls
        </h4>
        <div class="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" class="gap-2" onclick={resetToTime}>
                <RefreshCw class="h-4 w-4" /> Reset to Time
            </Button>
            <Button variant="destructive" size="sm" class="gap-2" onclick={clearAll}>
                <Trash2 class="h-4 w-4" /> Clear All
            </Button>
        </div>
    </div>

    <!-- Info Box -->
    <div class="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-2">
        <p class="font-medium">💡 Testing Tips:</p>
        <ul class="list-disc list-inside space-y-1 ml-2">
            <li>Click expandable views (Email, Calendar, Task) to expand</li>
            <li>Long text automatically starts marquee scrolling</li>
            <li>Animations use anime.js with spring physics</li>
            <li>Higher priority/severity interrupts lower ones</li>
            <li>Similar notifications are automatically batched</li>
            <li>Queue size is limited to prevent overflow</li>
        </ul>
    </div>
</div>
