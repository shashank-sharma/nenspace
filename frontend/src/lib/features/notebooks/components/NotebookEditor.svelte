<script lang="ts">
    import { notebooksService } from "../services/notebooks.service";
    import { pythonService } from "../services/python.service";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Save, Plus, Type } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { Notebook, Cell } from "../types";
    import NotebookCell from "./NotebookCell.svelte";

    let { id } = $props<{ id: string }>();

    let notebook = $state<Notebook | null>(null);
    let isLoading = $state(true);
    let isSaving = $state(false);

    async function loadNotebook() {
        isLoading = true;
        try {
            notebook = await notebooksService.getNotebook(id);
        } catch (error) {
            toast.error("Failed to load notebook");
        } finally {
            isLoading = false;
        }
    }

    async function saveNotebook() {
        if (!notebook) return;
        isSaving = true;
        try {
            // Create a serializable version of the notebook cells
            const notebookDataToSave = {
                ...notebook,
                cells: notebook.cells.map(({ ...cell }) => cell),
            };
            await notebooksService.updateNotebook(id, notebookDataToSave);
            toast.success("Notebook saved");
        } catch (error) {
            toast.error("Failed to save notebook");
        } finally {
            isSaving = false;
        }
    }

    function addCell(type: "code" | "markdown") {
        if (!notebook) return;
        const newCell: Cell = {
            id: crypto.randomUUID(),
            type,
            content: "",
            output: "",
            language: type === "code" ? "python" : "markdown",
        };
        notebook.cells.push(newCell);
    }

    async function executeCell(cellId: string) {
        const cell = notebook?.cells.find((c) => c.id === cellId);
        if (!cell || cell.type !== "code") return;

        try {
            const output = await pythonService.executeCode(cell.content);
            cell.output = output;
        } catch (error: any) {
            cell.output = `Error: ${error.message}`;
        }
    }

    function deleteCell(cellId: string) {
        if (!notebook) return;
        notebook.cells = notebook.cells.filter((cell) => cell.id !== cellId);
    }

    function updateCellContent(cellId: string, content: string) {
        if (!notebook) return;
        const cell = notebook.cells.find((c) => c.id === cellId);
        if (cell) {
            cell.content = content;
        }
    }

    $effect(() => {
        loadNotebook();
        pythonService.initialize();
    });

    // Autosave effect
    $effect(() => {
        if (notebook) {
            const timeout = setTimeout(() => {
                saveNotebook();
            }, 2000);
            return () => clearTimeout(timeout);
        }
    });
</script>

<div class="max-w-4xl mx-auto space-y-6 p-4">
    {#if isLoading}
        <p>Loading notebook...</p>
    {:else if notebook}
        <div class="flex justify-between items-center">
            <Input
                type="text"
                bind:value={notebook.name}
                class="text-2xl font-bold bg-transparent border-none h-auto p-0 focus-visible:ring-0"
            />
            <div class="flex gap-2">
                <Button on:click={saveNotebook} disabled={isSaving}>
                    <Save class="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button on:click={() => addCell("code")} variant="outline">
                    <Plus class="w-4 h-4 mr-2" /> Code
                </Button>
                <Button on:click={() => addCell("markdown")} variant="outline">
                    <Type class="w-4 h-4 mr-2" /> Text
                </Button>
            </div>
        </div>

        <div class="space-y-4">
            {#each notebook.cells as cell, i (cell.id)}
                <NotebookCell
                    cell={{
                        type: cell.type,
                        output: cell.output,
                        error: cell.error || "",
                    }}
                    index={i}
                    bind:content={cell.content}
                    on:change={() => {}}
                    on:delete={() => deleteCell(i)}
                    on:execute={() => executeCell(i)}
                />
            {/each}
        </div>

        <div class="flex justify-center gap-2 mt-4">
            <Button on:click={saveNotebook} disabled={isSaving}>
                <Save class="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button on:click={() => addCell("code")} variant="outline">
                <Plus class="w-4 h-4 mr-2" /> Code
            </Button>
            <Button on:click={() => addCell("markdown")} variant="outline">
                <Type class="w-4 h-4 mr-2" /> Text
            </Button>
        </div>
    {/if}
</div>
