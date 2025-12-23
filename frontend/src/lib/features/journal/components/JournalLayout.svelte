<script lang="ts">
    import TimelineColumn from './TimelineColumn.svelte';
    import ContentColumn from './ContentColumn.svelte';

    let selectedDate = $state<Date | null>(null);

    function handleDateSelect(date: Date) {
        selectedDate = date;
    }
</script>

<div class="h-full flex">
    <!-- Left Column: Timeline -->
    <div class="w-64 flex-shrink-0">
        <TimelineColumn {selectedDate} onDateSelect={handleDateSelect} />
    </div>

    <!-- Right Column: Content -->
    <div class="flex-1 min-w-0">
        <ContentColumn {selectedDate} />
    </div>
</div>

