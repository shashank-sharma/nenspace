<script lang="ts">
    import { notebooksService } from "../services/notebooks.service";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { toast } from "svelte-sonner";
    import { createEventDispatcher } from "svelte";

    let { open = $bindable() } = $props<{ open?: boolean }>();
    const dispatch = createEventDispatcher();

    let name = $state("");
    let loading = $state(false);

    async function handleSubmit() {
        if (!name.trim()) {
            toast.error("Please enter a notebook name");
            return;
        }

        loading = true;
        try {
            await notebooksService.createNotebook({
                name,
                version: "1.0",
                cells: [],
            });
            toast.success("Notebook created successfully");
            dispatch("create");
            handleClose();
        } catch (error) {
            toast.error("Failed to create notebook");
        } finally {
            loading = false;
        }
    }

    function handleClose() {
        name = "";
        open = false;
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Create New Notebook</Dialog.Title>
        </Dialog.Header>
        <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
                <Label for="name">Name</Label>
                <Input
                    id="name"
                    bind:value={name}
                    placeholder="Enter notebook name"
                />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={handleClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Notebook"}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
