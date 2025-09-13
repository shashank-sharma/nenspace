<script lang="ts">
    import TaskList from "$lib/features/tasks/components/TaskList.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
</script>

<div class="container mx-auto p-4">
    <TaskList tasks={data.tasks} searchQuery={data.searchQuery} />
</div>
