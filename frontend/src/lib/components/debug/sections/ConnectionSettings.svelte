<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { Button } from "$lib/components/ui/button";
    import { RefreshCcw } from "lucide-svelte";
    import { EditableInput } from "$lib/components/ui/editable-input";

    // Local state for URL
    const pocketbaseUrl = writable<string>(
        browser
            ? localStorage.getItem("pocketbase-url") || "http://127.0.0.1:8090"
            : "http://127.0.0.1:8090",
    );

    // URL value from the store
    let pbUrl = $pocketbaseUrl;

    // Save URL to localStorage when it changes
    pocketbaseUrl.subscribe((value) => {
        if (browser) {
            localStorage.setItem("pocketbase-url", value);
            pbUrl = value;
        }
    });

    // Handle URL change
    function handleUrlChange(newValue: string) {
        pocketbaseUrl.set(newValue);
    }

    // Reload the application to apply changes
    function reloadApplication() {
        window.location.reload();
    }
</script>

<div class="space-y-3">
    <div class="flex flex-col">
        <label for="pocketbase-url" class="text-sm text-muted-foreground mb-1">
            Pocketbase URL
        </label>
        <EditableInput
            id="pocketbase-url"
            value={pbUrl}
            placeholder="e.g. http://127.0.0.1:8090"
            onChange={handleUrlChange}
        />
    </div>

    <Button
        variant="outline"
        size="sm"
        class="w-full mt-2 flex items-center justify-center gap-2"
        on:click={reloadApplication}
    >
        <RefreshCcw size={14} />
        <span>Reload Application</span>
    </Button>
</div>
