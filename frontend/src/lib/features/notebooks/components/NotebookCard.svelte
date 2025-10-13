<script lang="ts">
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardFooter,
        CardHeader,
        CardTitle,
        CardDescription,
    } from "$lib/components/ui/card";
    import { Trash2 } from "lucide-svelte";
    import type { Notebook } from "../types";
    import { createEventDispatcher } from "svelte";

    let { notebook } = $props<{ notebook: Notebook }>();
    const dispatch = createEventDispatcher();

    function handleDelete() {
        if (confirm("Are you sure you want to delete this notebook?")) {
            dispatch("delete");
        }
    }
</script>

<Card class="hover:shadow-lg transition-shadow">
    <CardHeader>
        <CardTitle>{notebook.name}</CardTitle>
        <CardDescription>
            Version: {notebook.version}<br />
            Created: {new Date(notebook.created).toLocaleDateString()}
        </CardDescription>
    </CardHeader>

    <CardContent>
        <p class="text-sm text-muted-foreground">
            {notebook.cells.length} cells<br />
            Last modified: {new Date(notebook.updated).toLocaleDateString()}
        </p>
    </CardContent>

    <CardFooter class="flex justify-between">
        <Button
            variant="outline"
            on:click={() => goto(`/dashboard/notebooks/${notebook.id}`)}
        >
            Open
        </Button>
        <Button variant="destructive" size="icon" on:click={handleDelete}>
            <Trash2 class="w-4 h-4" />
        </Button>
    </CardFooter>
</Card>
