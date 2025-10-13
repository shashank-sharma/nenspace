<script lang="ts">
    import { chroniclesStore } from "../stores";
    import { ChroniclesService } from "../services";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import { validateWithToast, required } from "$lib/utils/validation.util";
    import {
        formatDateForEntry,
        formatDateForTitle,
    } from "../utils/weather-mapping.util";
    import { Card } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { Carta, MarkdownEditor } from "carta-md";
    import "carta-md/default.css";
    import DOMPurify from "isomorphic-dompurify";
    import { getContext } from "svelte";

    const { theme } = getContext("theme");

    let content = $state(chroniclesStore.currentEntry?.content || "");
    let mood = $state(chroniclesStore.currentEntry?.mood || "neutral");
    let tags = $state(chroniclesStore.currentEntry?.tags || "");

    let carta = new Carta({
        sanitizer: DOMPurify.sanitize,
        plugins: [
            "heading",
            "bold",
            "italic",
            "strikethrough",
            "link",
            "list",
            "table",
            "image",
            "code",
            "blockquote",
        ],
        theme: theme.theme === "dark" ? "github-dark" : "github-light",
    });

    async function handleSave() {
        if (
            !validateWithToast(
                { content },
                {
                    content: [required("Content is required")],
                },
            )
        ) {
            return;
        }

        await withErrorHandling(
            async () => {
                const entry = await ChroniclesService.saveJournalEntry({
                    ...chroniclesStore.currentEntry,
                    content,
                    mood,
                    tags,
                    date: formatDateForEntry(new Date()),
                    title: formatDateForTitle(new Date()),
                    user: "",
                });
                chroniclesStore.setCurrentEntry(entry);
            },
            {
                successMessage: "Saved successfully",
                errorMessage: "Failed to save",
            },
        );
    }
</script>

<!-- Editor UI implementation -->
