<script lang="ts">
    /**
     * Notification Debug Settings
     * 
     * Debug panel for testing notification system functionality.
     * Tests both browser StatusIndicator and Tauri FloatingWidget.
     */
    import { NotificationBroadcaster } from "$lib/features/status-indicator";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { 
        CheckCircle2, 
        XCircle, 
        Info, 
        AlertTriangle, 
        Loader2,
        Bell,
        Sparkles
    } from "lucide-svelte";

    let testCount = $state(0);
    let isQueueTest = $state(false);

    function testSuccess() {
        testCount++;
        NotificationBroadcaster.success(`Success test #${testCount}`, {
            duration: 3000,
        });
    }

    function testError() {
        testCount++;
        NotificationBroadcaster.error(`Error test #${testCount}`, {
            duration: 3000,
        });
    }

    function testWarning() {
        testCount++;
        NotificationBroadcaster.warning(`Warning test #${testCount}`, {
            duration: 3000,
        });
    }

    function testInfo() {
        testCount++;
        NotificationBroadcaster.info(`Info test #${testCount}`, {
            duration: 3000,
        });
    }

    function testLoading() {
        testCount++;
        NotificationBroadcaster.loading(`Loading test #${testCount}`, { 
            duration: 3000 
        });
    }

    function testCustomColors() {
        testCount++;
        NotificationBroadcaster.show(
            `Custom color test #${testCount}`,
            'info',
            {
                duration: 3000,
                backgroundColor: 'rgb(168 85 247)', // purple
                textColor: 'rgb(243 232 255)', // purple-100
            }
        );
    }

    function testQueue() {
        isQueueTest = true;
        const variants: Array<'success' | 'error' | 'warning' | 'info' | 'loading'> = [
            'info',
            'success',
            'warning',
            'error',
            'loading',
        ];
        
        variants.forEach((variant, index) => {
            testCount++;
            setTimeout(() => {
                NotificationBroadcaster.show(
                    `Queue test ${index + 1}/${variants.length}`,
                    variant,
                    { duration: 2000 }
                );
                
                if (index === variants.length - 1) {
                    setTimeout(() => {
                        isQueueTest = false;
                    }, 2500);
                }
            }, index * 500);
        });
    }

    function testPersistent() {
        testCount++;
        NotificationBroadcaster.info(`Persistent notification #${testCount}`, {
            duration: 0, // Won't auto-dismiss
        });
    }

    function dismissCurrent() {
        NotificationBroadcaster.hide();
    }

    function clearAll() {
        NotificationBroadcaster.clear();
    }

    function resetCounter() {
        testCount = 0;
    }
</script>

<div class="space-y-6 p-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-lg font-semibold">Notification System Tests</h3>
            <p class="text-sm text-muted-foreground mt-1">
                Test notifications across all components
            </p>
        </div>
        <Badge variant="outline" class="text-xs">
            Tests run: {testCount}
        </Badge>
    </div>

    <!-- Basic Variant Tests -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground">Basic Variants</h4>
        <div class="grid grid-cols-2 gap-2">
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testSuccess}
            >
                <CheckCircle2 class="h-4 w-4 text-green-600" />
                Success
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testError}
            >
                <XCircle class="h-4 w-4 text-red-600" />
                Error
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testWarning}
            >
                <AlertTriangle class="h-4 w-4 text-yellow-600" />
                Warning
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testInfo}
            >
                <Info class="h-4 w-4 text-blue-600" />
                Info
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testLoading}
            >
                <Loader2 class="h-4 w-4 text-gray-600" />
                Loading
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={testCustomColors}
            >
                <Sparkles class="h-4 w-4 text-purple-600" />
                Custom
            </button>
        </div>
    </div>

    <!-- Advanced Tests -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground">Advanced Tests</h4>
        <div class="grid grid-cols-2 gap-2">
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
                onclick={testQueue}
                disabled={isQueueTest}
            >
                <Bell class="h-4 w-4" />
                {isQueueTest ? 'Running...' : 'Queue Test'}
            </button>
            
            <button 
                class="inline-flex items-center justify-start gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
                onclick={testPersistent}
            >
                <Info class="h-4 w-4" />
                Persistent
            </button>
        </div>
    </div>

    <!-- Control Actions -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-muted-foreground">Actions</h4>
        <div class="grid grid-cols-2 gap-2">
            <button 
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={dismissCurrent}
            >
                Dismiss Current
            </button>
            
            <button 
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onclick={clearAll}
            >
                Clear All
            </button>
        </div>
        
        <button 
            class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground w-full"
            onclick={resetCounter}
        >
            Reset Counter
        </button>
    </div>

    <!-- Info Box -->
    <div class="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
        <p class="font-medium">💡 Testing Tips:</p>
        <ul class="list-disc list-inside space-y-1 ml-2">
            <li>Notifications appear in StatusIndicator (browser)</li>
            <li>Also appear in FloatingWidget (Tauri only)</li>
            <li>Queue test shows sequential notifications</li>
            <li>Persistent notifications need manual dismiss</li>
        </ul>
    </div>
</div>

