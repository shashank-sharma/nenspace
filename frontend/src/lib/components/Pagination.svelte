<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Select from "$lib/components/ui/select";
    import {
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight,
    } from "lucide-svelte";

    let {
        currentPage = $bindable(1),
        totalPages = 1,
        totalItems = 0,
        pageSize = $bindable(20),
        pageSizeOptions = [10, 20, 30, 50, 100],
        onpagechange,
        onpagesizechange,
        className = "",
    } = $props<{
        currentPage: number;
        totalPages: number;
        totalItems: number;
        pageSize: number;
        pageSizeOptions?: number[];
        onpagechange?: (page: number) => void;
        onpagesizechange?: (size: number) => void;
        className?: string;
    }>();

    function goToPage(page: number) {
        currentPage = page;
        onpagechange?.(page);
    }

    function changePageSize(size: number) {
        pageSize = size;
        currentPage = 1;
        onpagesizechange?.(size);
    }
</script>

<div
    class="flex items-center justify-between px-2 py-4 border-t bg-background {className}"
>
    <!-- Page size selector -->
    <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Rows per page</span>
        <Select.Root
            selected={{
                value: (pageSize ?? 20).toString(),
                label: (pageSize ?? 20).toString(),
            }}
            onSelectedChange={(selected) => {
                if (selected?.value) {
                    changePageSize(parseInt(selected.value));
                }
            }}
        >
            <Select.Trigger class="h-8 w-[70px]">
                <Select.Value />
            </Select.Trigger>
            <Select.Content>
                {#each pageSizeOptions as size}
                    <Select.Item value={size.toString()}>{size}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    </div>

    <!-- Page info -->
    <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
        </span>
        <span class="text-sm text-muted-foreground">
            ({totalItems} total)
        </span>
    </div>

    <!-- Navigation buttons -->
    <div class="flex items-center gap-1">
        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={currentPage === 1}
            on:click={() => goToPage(1)}
            aria-label="Go to first page"
        >
            <ChevronsLeft class="h-4 w-4" />
        </Button>
        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={currentPage === 1}
            on:click={() => goToPage(currentPage - 1)}
            aria-label="Go to previous page"
        >
            <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={currentPage === totalPages}
            on:click={() => goToPage(currentPage + 1)}
            aria-label="Go to next page"
        >
            <ChevronRight class="h-4 w-4" />
        </Button>
        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={currentPage === totalPages}
            on:click={() => goToPage(totalPages)}
            aria-label="Go to last page"
        >
            <ChevronsRight class="h-4 w-4" />
        </Button>
    </div>
</div>
