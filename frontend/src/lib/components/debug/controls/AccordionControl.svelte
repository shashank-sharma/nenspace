<script lang="ts">
    import {
        Accordion,
        AccordionContent,
        AccordionItem,
        AccordionTrigger,
    } from "$lib/components/ui/accordion";
    import type { ComponentType } from "svelte";

    type ControlConfig = {
        id: string;
        component: ComponentType;
        props: any;
    };

    let { label, controls } = $props<{
        label: string;
        controls: ControlConfig[];
    }>();
</script>

<Accordion type="single" collapsible class="w-full">
    <AccordionItem value="item-1">
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent>
            <div class="space-y-2 pt-2">
                {#each controls as control}
                    <svelte:component
                        this={control.component}
                        {...control.props}
                    />
                {/each}
            </div>
        </AccordionContent>
    </AccordionItem>
</Accordion>
