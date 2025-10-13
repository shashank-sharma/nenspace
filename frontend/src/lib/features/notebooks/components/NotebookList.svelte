<script lang="ts">
    import { notebooksService } from "../services/notebooks.service";
    import type { Notebook } from "../types";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-svelte";
    import NotebookCard from "./NotebookCard.svelte";
    import CreateNotebookDialog from "./CreateNotebookDialog.svelte";
    import { toast } from "svelte-sonner";

    let notebooks = $state<Notebook[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let searchQuery = $state("");
    let currentPage = $state(1);
    let itemsPerPage = $state(6);
    let dialogOpen = $state(false);

    const filteredNotebooks = $derived(
        notebooks.filter((notebook) =>
            notebook.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    const totalPages = $derived(
        Math.ceil(filteredNotebooks.length / itemsPerPage),
    );

    const paginatedNotebooks = $derived(
        filteredNotebooks.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage,
        ),
    );

    async function loadNotebooks() {
        loading = true;
        try {
            notebooks = await notebooksService.listNotebooks();
        } catch (e) {
            error = "Failed to load notebooks";
            toast.error(error);
        } finally {
            loading = false;
        }
    }

    async function handleDelete(id: string) {
        try {
            await notebooksService.deleteNotebook(id);
            notebooks = notebooks.filter((nb) => nb.id !== id);
            toast.success("Notebook deleted successfully");
        } catch (error) {
            toast.error("Failed to delete notebook");
        }
    }

    $effect(() => {
        loadNotebooks();
    });

    $effect(() => {
        if (searchQuery) {
            currentPage = 1;
        }
    });
</script>

<div class="space-y-6">
    <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">My Notebooks</h2>
        <Button
            on:click={() => (dialogOpen = true)}
            class="flex items-center gap-2"
        >
            <Plus class="w-4 h-4" />
            New Notebook
        </Button>
    </div>

    <div class="relative flex-1">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
            type="text"
            placeholder="Search notebooks..."
            bind:value={searchQuery}
            class="pl-8"
        />
    </div>

    {#if loading}
        <p>Loading notebooks...</p>
    {:else if error}
        <p>{error}</p>
    {:else if paginatedNotebooks.length === 0}
        <p>No notebooks found.</p>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each paginatedNotebooks as notebook (notebook.id)}
                <NotebookCard
                    {notebook}
                    on:delete={() => handleDelete(notebook.id)}
                />
            {/each}
        </div>

        {#if totalPages > 1}
            <div class="flex justify-center gap-2 mt-4">
                <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    on:click={() => (currentPage -= 1)}
                >
                    <ChevronLeft class="w-4 h-4" />
                </Button>
                <span>Page {currentPage} of {totalPages}</span>
                <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === totalPages}
                    on:click={() => (currentPage += 1)}
                >
                    <ChevronRight class="w-4 h-4" />
                </Button>
            </div>
        {/if}
    {/if}

    <CreateNotebookDialog
        bind:open={dialogOpen}
        on:create={() => {
            dialogOpen = false;
            loadNotebooks();
        }}
    />
</div>
