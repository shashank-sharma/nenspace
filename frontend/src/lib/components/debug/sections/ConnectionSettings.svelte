<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { RefreshCcw } from "lucide-svelte";
    import { EditableInput } from "$lib/components/ui/editable-input";
    import { ConfigService } from "$lib/services/config.service.svelte";

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
            value={ConfigService.pocketbaseUrl}
            placeholder="e.g. http://127.0.0.1:8090"
            onChange={ConfigService.setPocketbaseUrl}
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
