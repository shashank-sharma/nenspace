<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Card } from "$lib/components/ui/card";
    import { Trash2, Play, Type, Loader2 } from "lucide-svelte";
    import type { Cell } from "../types";
    import { basicSetup } from "codemirror";
    import { EditorView, keymap } from "@codemirror/view";
    import { EditorState } from "@codemirror/state";
    import { python } from "@codemirror/lang-python";
    import { markdown } from "@codemirror/lang-markdown";
    import { indentUnit } from "@codemirror/language";
    import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
    import { tags } from "@lezer/highlight";
    import { toast } from "svelte-sonner";
    import { createEventDispatcher } from "svelte";
    import { pb } from "$lib/config/pocketbase";

    let {
        cell,
        index,
        content = $bindable(),
    } = $props<{
        cell: { type: string; output: string; error: string };
        index: number;
        content: string;
    }>();

    const dispatch = createEventDispatcher();
    let editorEl: HTMLDivElement;
    let view: EditorView;
    let isExecuting = $state(false);

    const customTheme = HighlightStyle.define([
        { tag: tags.keyword, color: "var(--code-keyword, #c792ea)" },
        { tag: tags.operator, color: "var(--code-operator, #89ddff)" },
        { tag: tags.string, color: "var(--code-string, #c3e88d)" },
        { tag: tags.number, color: "var(--code-number, #f78c6c)" },
        {
            tag: tags.comment,
            color: "var(--code-comment, #546e7a)",
            fontStyle: "italic",
        },
        {
            tag: tags.function(tags.variableName),
            color: "var(--code-function, #82aaff)",
        },
        {
            tag: tags.definition(tags.variableName),
            color: "var(--code-variable, #f07178)",
        },
        { tag: tags.className, color: "var(--code-class, #ffcb6b)" },
    ]);

    function createEditor() {
        const extensions = [
            basicSetup,
            indentUnit.of("    "),
            EditorView.lineWrapping,
            EditorState.tabSize.of(4),
            cell.type === "code" ? python() : markdown(),
            syntaxHighlighting(customTheme),
            keymap.of([
                {
                    key: "Shift-Enter",
                    run: () => {
                        if (cell.type === "code") {
                            executeCode();
                        }
                        return true;
                    },
                },
            ]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    content = update.state.doc.toString();
                }
            }),
        ];

        view = new EditorView({
            doc: content,
            extensions,
            parent: editorEl,
            dispatch: (tr: any) => {
                view.update([tr]);
                if (tr.docChanged) {
                    content = view.state.doc.toString();
                }
            },
        });
    }

    async function executeCode() {
        if (isExecuting) return;
        isExecuting = true;
        try {
            const result = await pb.send("/api/notebooks/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: content }),
            });
            cell.output = result.output;
            cell.error = result.error;
        } catch (error: any) {
            cell.error = error.message || "An unknown error occurred";
            toast.error("Execution failed: " + cell.error);
        } finally {
            isExecuting = false;
        }
    }
</script>

<div
    class="cell-container"
    class:markdown={cell.type === "markdown"}
    class:code={cell.type === "code"}
>
    <div class="cell-toolbar">
        <span class="cell-type-label">{cell.type}</span>
        <div class="cell-actions">
            {#if cell.type === "code"}
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    onclick={executeCode}
                    disabled={isExecuting}
                >
                    {#if isExecuting}
                        <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                        <Play class="h-4 w-4" />
                    {/if}
                </Button>
            {/if}
            <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                onclick={() => dispatch("delete")}
            >
                <Trash2 class="h-4 w-4" />
            </Button>
        </div>
    </div>

    <div class="editor-wrapper">
        <div bind:this={editorEl} class="editor-content"></div>
    </div>

    {#if cell.type === "code" && (cell.output || cell.error)}
        <div class="cell-output-container">
            {#if cell.output}
                <pre class="cell-output">{cell.output}</pre>
            {/if}
            {#if cell.error}
                <pre class="cell-error">{cell.error}</pre>
            {/if}
        </div>
    {/if}
</div>

<style>
    :global(.editor-container .cm-editor) {
        height: 100%;
        min-height: 100px;
        padding: 8px;
    }

    :global(.editor-container .cm-editor.cm-focused) {
        outline: none;
        border-color: hsl(var(--ring));
    }

    :global(.editor-container .cm-gutters) {
        background-color: hsl(var(--muted));
        border-right: 1px solid hsl(var(--border));
        color: hsl(var(--muted-foreground));
    }
</style>
