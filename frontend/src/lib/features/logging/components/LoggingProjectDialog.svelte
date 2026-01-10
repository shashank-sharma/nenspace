<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Slider } from "$lib/components/ui/slider";
    import { validateWithToast, required, minLength } from "$lib/utils";
    import type { LoggingProject, LoggingProjectFormData } from "../types";

    interface Props {
        open: boolean;
        project?: LoggingProject | null;
        onsubmit: (data: LoggingProjectFormData) => void;
        onclose: () => void;
    }

    let { open = $bindable(), project = null, onsubmit, onclose } = $props<Props>();

    let formData = $state<LoggingProjectFormData>({
        name: "",
        slug: "",
        retention: 30
    });

    const isEdit = $derived(!!project);
    const dialogTitle = $derived(isEdit ? "Edit Project" : "Create New Logging Project");
    const submitButtonText = $derived(isEdit ? "Update Project" : "Create Project");

    $effect(() => {
        if (!isEdit && formData.name) {
            formData.slug = formData.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }
    });

    $effect(() => {
        if (open && project) {
            formData = {
                name: project.name,
                slug: project.slug,
                retention: project.retention
            };
        } else if (open && !project) {
            formData = {
                name: "",
                slug: "",
                retention: 30
            };
        }
    });

    function handleSubmit() {
        if (!validateWithToast(formData, {
            name: [required("Name is required"), minLength(3, "Name must be at least 3 characters")],
            slug: [required("Slug is required")],
            retention: [required("Retention is required")]
        })) {
            return;
        }

        onsubmit(formData);
    }

    function handleClose() {
        open = false;
        onclose();
    }
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description>
                {isEdit ? "Update project settings" : "Create a new project to start collecting logs."}
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6 py-4">
            <div class="space-y-2">
                <Label for="name">Project Name</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    placeholder="e.g. Frontend App"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="slug">Project Slug</Label>
                <Input
                    id="slug"
                    bind:value={formData.slug}
                    placeholder="e.g. frontend-app"
                    required
                    readonly={isEdit}
                    class={isEdit ? "bg-muted" : ""}
                />
                {#if !isEdit}
                    <p class="text-xs text-muted-foreground">Used in API calls as project identifier.</p>
                {/if}
            </div>

            <div class="space-y-4">
                <div class="flex justify-between">
                    <Label for="retention">Log Retention (Days)</Label>
                    <span class="text-sm font-medium">{formData.retention} days</span>
                </div>
                <Slider
                    id="retention"
                    value={[formData.retention]}
                    min={1}
                    max={365}
                    step={1}
                    onValueChange={(v) => formData.retention = v[0]}
                />
                <p class="text-xs text-muted-foreground text-center">Logs older than this will be automatically deleted.</p>
            </div>

            <Dialog.Footer class="pt-4">
                <Button type="button" variant="outline" onclick={handleClose}>
                    Cancel
                </Button>
                <Button type="submit">{submitButtonText}</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

