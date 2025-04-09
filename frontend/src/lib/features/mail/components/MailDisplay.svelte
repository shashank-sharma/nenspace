<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { cn } from "$lib/utils";
    import { format } from "date-fns";
    import {
        Archive,
        Star,
        Trash2,
        ChevronUp,
        ChevronDown,
    } from "lucide-svelte";
    import { mailMessagesStore } from "../stores";
    import type { MailMessage } from "../types";
    import DOMPurify from "dompurify";
    import { onMount } from "svelte";
    import { ScrollArea } from "$lib/components/ui/scroll-area";

    export let class_name = "";
    let iframeRef: HTMLIFrameElement;
    let iframeLoaded = false;
    let isBodyCollapsed = false;

    function formatEmailString(str: string) {
        const [email] = str.split("<");
        return email?.trim() || str;
    }

    // Toggle collapse state of the message body
    function toggleBodyCollapse() {
        isBodyCollapsed = !isBodyCollapsed;
    }

    // More permissive sanitization that preserves most HTML and CSS
    function sanitizeHtml(html: string) {
        if (typeof window !== "undefined") {
            // Configure DOMPurify with maximum CSS preservation
            const config = {
                ADD_TAGS: ["style", "link", "meta"],
                ADD_ATTR: [
                    "style",
                    "class",
                    "id",
                    "target",
                    "rel",
                    "href",
                    "src",
                    "alt",
                    "title",
                    "width",
                    "height",
                    "border",
                    "cellpadding",
                    "cellspacing",
                    "bgcolor",
                    "color",
                    "colspan",
                    "rowspan",
                    "valign",
                    "align",
                    "background",
                ],
                USE_PROFILES: {
                    html: true,
                    svg: true,
                    svgFilters: true,
                    mathMl: true,
                },
                WHOLE_DOCUMENT: true,
                RETURN_DOM: false,
                RETURN_DOM_FRAGMENT: false,
                ALLOW_UNKNOWN_PROTOCOLS: true,
                ALLOW_DATA_ATTR: true,
                SAFE_FOR_TEMPLATES: false,
                FORBID_TAGS: ["script"],
                FORBID_ATTR: [
                    "onerror",
                    "onload",
                    "onclick",
                    "onmouseover",
                    "onmouseout",
                    "onfocus",
                    "onblur",
                ],
            };

            return DOMPurify.sanitize(html, config);
        }
        return html;
    }

    // Write content to iframe after it's loaded
    function writeToIframe(content: string) {
        if (!iframeRef || !content) return;

        try {
            const iframeDoc =
                iframeRef.contentDocument || iframeRef.contentWindow?.document;

            if (!iframeDoc) return;

            // Create a full HTML document with necessary styles
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        /* Base styles to ensure proper rendering */
                        html, body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 0;
                            padding: 0;
                            height: 100%;
                        }
                        
                        /* Ensure images don't overflow */
                        img { max-width: 100%; height: auto; }
                        
                        /* Tables often used in emails */
                        table { border-collapse: collapse; width: 100%; }
                        
                        /* Links styling */
                        a { color: #3b82f6; text-decoration: underline; }
                        
                        /* Dark mode support */
                        @media (prefers-color-scheme: dark) {
                            body { color: #e2e8f0; background: transparent; }
                            a { color: #60a5fa; }
                        }
                    </style>
                    <!-- Any additional styles or links needed -->
                </head>
                <body>${content}</body>
                </html>
            `;

            // Write the content to the iframe
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            // Adjust iframe height based on content
            setTimeout(() => {
                if (
                    iframeRef &&
                    iframeRef.contentDocument &&
                    iframeRef.contentDocument.body
                ) {
                    const height = iframeRef.contentDocument.body.scrollHeight;
                    // Set a max height to ensure scrolling behavior while filling available space
                    const maxHeight = 500; // Maximum height for the iframe

                    // Set the height to fill the available space while respecting the content
                    iframeRef.style.height = "100%";

                    // Always enable scrolling to handle overflow content
                    iframeRef.style.overflowY = "auto";
                }
            }, 100);
        } catch (error) {
            console.error("Error writing to iframe:", error);
        }
    }

    // Handle iframe load event
    function handleIframeLoad() {
        iframeLoaded = true;
        if ($mailMessagesStore.selectedMail) {
            const sanitizedContent = sanitizeHtml(
                $mailMessagesStore.selectedMail.body,
            );
            writeToIframe(sanitizedContent);
        }
    }

    // Update iframe content when the selected mail changes
    $: if (iframeLoaded && $mailMessagesStore.selectedMail) {
        const sanitizedContent = sanitizeHtml(
            $mailMessagesStore.selectedMail.body,
        );
        writeToIframe(sanitizedContent);
    }

    onMount(() => {
        return () => {
            // Cleanup if needed
            iframeLoaded = false;
        };
    });
</script>

<div
    class={cn(
        "flex flex-col h-screen max-h-screen overflow-hidden",
        class_name,
    )}
>
    {#if $mailMessagesStore.selectedMail}
        <div class="flex flex-col h-full">
            <!-- Email header section - keep this fixed height -->
            <div class="flex items-center justify-between p-2 shrink-0">
                <div class="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                        <Archive class="h-4 w-4" />
                        <span class="sr-only">Archive</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                        <Trash2 class="h-4 w-4" />
                        <span class="sr-only">Delete</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        class={cn(
                            $mailMessagesStore.selectedMail.is_starred
                                ? "text-yellow-500"
                                : "text-muted-foreground",
                        )}
                    >
                        <Star class="h-4 w-4" />
                        <span class="sr-only">Star</span>
                    </Button>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    class="text-muted-foreground hover:text-foreground"
                    on:click={toggleBodyCollapse}
                >
                    {#if isBodyCollapsed}
                        <span class="mr-2">View message</span>
                        <ChevronDown class="h-4 w-4" />
                    {:else}
                        <span class="mr-2">Hide message</span>
                        <ChevronUp class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
            <Separator class="shrink-0" />

            <!-- Message details - make this take all available space -->
            <div class="flex-1 overflow-hidden flex flex-col">
                <ScrollArea class="flex-1 h-full">
                    <div class="p-4 space-y-4">
                        <h1 class="text-2xl font-bold">
                            {$mailMessagesStore.selectedMail.subject}
                        </h1>
                        <div class="flex items-center gap-4">
                            <div>
                                <div class="font-semibold">
                                    {formatEmailString(
                                        $mailMessagesStore.selectedMail.from,
                                    )}
                                </div>
                                <div class="text-sm text-muted-foreground">
                                    {format(
                                        new Date(
                                            $mailMessagesStore.selectedMail.received_date,
                                        ),
                                        "MMM d, yyyy HH:mm",
                                    )}
                                </div>
                            </div>
                        </div>
                        <Separator />

                        <!-- Email content container -->
                        <div
                            class="email-content-container"
                            class:hidden={isBodyCollapsed}
                        >
                            <!-- Use iframe for perfect style isolation -->
                            <iframe
                                bind:this={iframeRef}
                                on:load={handleIframeLoad}
                                title="Email content"
                                sandbox="allow-same-origin"
                                frameborder="0"
                                class="email-iframe"
                            ></iframe>

                            <!-- Fallback if iframe doesn't work -->
                            {#if !iframeLoaded}
                                <div
                                    class="email-content prose dark:prose-invert max-w-none"
                                >
                                    {@html sanitizeHtml(
                                        $mailMessagesStore.selectedMail.body,
                                    )}
                                </div>
                            {/if}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    {:else}
        <div
            class="p-8 text-center text-muted-foreground flex h-full items-center justify-center"
        >
            No message selected
        </div>
    {/if}
</div>

<style>
    /* Container for email content */
    .email-content-container {
        position: relative;
        width: 100%;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 50vh; /* Use viewport height units */
        height: calc(100vh - 200px); /* Approximate height calculation */
    }

    .hidden {
        display: none;
    }

    /* Iframe that provides perfect style isolation */
    .email-iframe {
        width: 100%;
        height: 100%;
        min-height: 300px;
        border: none;
        overflow-y: auto;
        background: transparent;
        flex: 1 1 auto;
    }

    /* Fallback styling */
    .email-content {
        font-family: inherit;
        line-height: 1.6;
        height: 100%;
        min-height: 300px;
        overflow-y: auto;
        flex: 1 1 auto;
    }

    /* Styling for links to make them visible */
    .email-content :global(a) {
        color: #3b82f6;
        text-decoration: underline;
    }

    .email-content :global(pre),
    .email-content :global(code) {
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 3px;
        padding: 0.2em 0.4em;
        font-family: monospace;
    }

    .email-content :global(blockquote) {
        border-left: 3px solid #e2e8f0;
        margin-left: 0;
        padding-left: 1rem;
        color: #64748b;
    }

    .email-content :global(img) {
        max-width: 100%;
        height: auto;
    }

    .email-content :global(table) {
        border-collapse: collapse;
        width: 100%;
    }

    .email-content :global(table td),
    .email-content :global(table th) {
        border: 1px solid #e2e8f0;
        padding: 8px;
    }

    /* Dark mode styles */
    :global(.dark) .email-content :global(pre),
    :global(.dark) .email-content :global(code) {
        background-color: rgba(255, 255, 255, 0.1);
    }

    :global(.dark) .email-content :global(blockquote) {
        border-left-color: #475569;
    }

    :global(.dark) .email-content :global(table td),
    :global(.dark) .email-content :global(table th) {
        border-color: #475569;
    }
</style>
