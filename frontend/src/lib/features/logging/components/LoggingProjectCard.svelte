<script lang="ts">
    import { Settings2, Trash2, Calendar, Hash, ShieldCheck, ShieldX } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import type { LoggingProject } from "../types";

    interface Props {
        project: LoggingProject;
        onedit: () => void;
        ondelete: () => void;
    }

    let { project, onedit, ondelete } = $props<Props>();
</script>

<Card.Root class="overflow-hidden transition-all hover:shadow-md">
    <Card.Header class="pb-3">
        <div class="flex items-start justify-between">
            <div class="space-y-1">
                <Card.Title class="text-lg">{project.name}</Card.Title>
                <div class="flex items-center text-xs text-muted-foreground">
                    <Hash class="mr-1 h-3 w-3" />
                    <span>{project.slug}</span>
                </div>
            </div>
            <Badge variant={project.active ? "default" : "secondary"}>
                {#if project.active}
                    <ShieldCheck class="mr-1 h-3 w-3" /> Active
                {:else}
                    <ShieldX class="mr-1 h-3 w-3" /> Inactive
                {/if}
            </Badge>
        </div>
    </Card.Header>
    <Card.Content class="pb-3 text-sm">
        <div class="flex items-center space-x-4 text-muted-foreground">
            <div class="flex items-center">
                <Calendar class="mr-1.5 h-4 w-4" />
                <span>{project.retention} days retention</span>
            </div>
        </div>
    </Card.Content>
    <Card.Footer class="bg-muted/50 px-6 py-3 flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onclick={onedit}>
            <Settings2 class="mr-2 h-4 w-4" />
            Edit
        </Button>
        <Button variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" onclick={ondelete}>
            <Trash2 class="mr-2 h-4 w-4" />
            Delete
        </Button>
    </Card.Footer>
</Card.Root>

