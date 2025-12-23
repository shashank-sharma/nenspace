<script lang="ts">
    import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { cn, formatEmailString, DateUtil } from "$lib/utils";
    import { Archive, Star, Trash2, ChevronUp, ChevronDown, X } from "lucide-svelte";
    import { mailMessagesStore } from "../stores";
    import type { MailMessage } from "../types";
    import * as DOMPurify from "isomorphic-dompurify";
    import { onMount } from "svelte";

    let { selectedMail = $bindable(null) } = $props<{
        selectedMail?: MailMessage | null;
    }>();

    let iframeRef: HTMLIFrameElement | null = $state(null);
    let iframeLoaded = $state(false);
    let isBodyCollapsed = $state(false); // Start with body visible
    
    // Reset collapse state when mail changes
    $effect(() => {
        if (selectedMail) {
            isBodyCollapsed = false; // Always show body when new mail is selected
        }
    });

    function toggleBodyCollapse() {
        isBodyCollapsed = !isBodyCollapsed;
    }

    function sanitizeHtml(html: string) {
        if (typeof window !== "undefined") {
            const config = {
                ADD_TAGS: ["style", "link", "meta"],
                ADD_ATTR: [
                    "style", "class", "id", "target", "rel", "href", "src", "alt", "title",
                    "width", "height", "border", "cellpadding", "cellspacing", "bgcolor",
                    "color", "colspan", "rowspan", "valign", "align", "background",
                ],
                USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
                WHOLE_DOCUMENT: true,
                RETURN_DOM: false,
                RETURN_DOM_FRAGMENT: false,
                ALLOW_UNKNOWN_PROTOCOLS: true,
                ALLOW_DATA_ATTR: true,
                SAFE_FOR_TEMPLATES: false,
                FORBID_TAGS: ["script"],
                FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur"],
            };
            return DOMPurify.default.sanitize(html, config);
        }
        return html;
    }

    // Check email size and warn if approaching Gmail's 102 KB limit
    function checkEmailSize(body: string): void {
        if (typeof window !== "undefined" && body) {
            const sizeKB = new Blob([body]).size / 1024;
            if (sizeKB > 100) {
                console.warn(`Email size is ${sizeKB.toFixed(2)} KB (Gmail clips at 102 KB)`);
            }
        }
    }

    function writeToIframe(content: string) {
        if (!iframeRef || !content) return;

        try {
            const iframeDoc = iframeRef.contentDocument || iframeRef.contentWindow?.document;
            if (!iframeDoc) return;

            // Check email size
            checkEmailSize(content);

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: http: https:; script-src 'none'; style-src 'unsafe-inline' 'self' http: https:; img-src 'self' data: http: https:; font-src 'self' data: http: https:;">
                    <style>
                        /* Minimal base styles - only for layout, not interfering with email styles */
                        html, body {
                            margin: 0;
                            padding: 0;
                            height: 100%;
                        }
                        
                        /* Responsive images - minimal interference */
                        img {
                            max-width: 100%;
                            height: auto;
                        }
                        
                        /* Email-specific table styles for compatibility */
                        table {
                            border-collapse: collapse;
                            mso-table-lspace: 0pt;
                            mso-table-rspace: 0pt;
                        }
                        
                        /* Outlook-specific fixes */
                        .ExternalClass {
                            width: 100%;
                        }
                        
                        /* Prevent auto-linking in iOS Mail */
                        a[x-apple-data-detectors] {
                            color: inherit !important;
                            text-decoration: none !important;
                            font-size: inherit !important;
                            font-family: inherit !important;
                            font-weight: inherit !important;
                            line-height: inherit !important;
                        }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `;

            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            // Add image error handling after iframe loads
            setTimeout(() => {
                const currentIframe = iframeRef;
                if (currentIframe && currentIframe.contentDocument && currentIframe.contentDocument.body) {
                    // Add error handlers to all images
                    const images = currentIframe.contentDocument.querySelectorAll('img');
                    const iframeDoc = currentIframe.contentDocument;
                    images.forEach((img) => {
                        if (!img.hasAttribute('data-error-handled')) {
                            img.setAttribute('data-error-handled', 'true');
                            img.addEventListener('error', function() {
                                this.style.display = 'none';
                                const fallback = iframeDoc.createElement('div');
                                fallback.textContent = 'Image not available';
                                fallback.style.cssText = 'display: block; padding: 10px; background: #f0f0f0; color: #666; border: 1px dashed #ccc;';
                                this.parentNode?.insertBefore(fallback, this);
                            });
                        }
                    });

                    currentIframe.style.height = "100%";
                    currentIframe.style.overflowY = "auto";
                }
            }, 100);
        } catch (error) {
            console.error("Error writing to iframe:", error);
        }
    }

    function handleIframeLoad() {
        // Only set iframeLoaded if we have content to show
        if (selectedMail && selectedMail.body) {
            iframeLoaded = true;
            const sanitizedContent = sanitizeHtml(selectedMail.body);
            writeToIframe(sanitizedContent);
        }
    }

    // Debug: Log when selectedMail changes
    $effect(() => {
        if (selectedMail) {
            console.log('=== Selected Mail Debug ===');
            console.log('ID:', selectedMail.id);
            console.log('Subject:', selectedMail.subject);
            console.log('Has Body:', !!selectedMail.body);
            console.log('Body Type:', typeof selectedMail.body);
            console.log('Body Length:', selectedMail.body?.length || 0);
            console.log('Body Preview (first 200 chars):', selectedMail.body?.substring(0, 200) || 'empty');
            console.log('isBodyCollapsed:', isBodyCollapsed);
            console.log('========================');
        }
    });

    // Update iframe content when selectedMail changes
    $effect(() => {
        const mailId = selectedMail?.id;
        const mailBody = selectedMail?.body;
        
        if (!selectedMail || !mailId) {
            // Clear iframe when no mail is selected
            iframeLoaded = false;
            if (iframeRef) {
                try {
                    const iframeDoc = iframeRef.contentDocument || iframeRef.contentWindow?.document;
                    if (iframeDoc) {
                        iframeDoc.open();
                        iframeDoc.write('');
                        iframeDoc.close();
                    }
                } catch (error) {
                    console.error("Error clearing iframe:", error);
                }
            }
            return;
        }

        // Reset iframeLoaded when mail changes
        iframeLoaded = false;

        // Only write to iframe if body exists
        if (!mailBody || !mailBody.trim()) {
            return;
        }

        // Function to write HTML content to iframe
        const writeContent = () => {
            // Verify selectedMail hasn't changed
            if (!iframeRef || !selectedMail || selectedMail.id !== mailId) {
                console.log('Cannot write: iframeRef or selectedMail changed');
                return false;
            }
            
            try {
                const iframeDoc = iframeRef.contentDocument || iframeRef.contentWindow?.document;
                if (iframeDoc) {
                    console.log('Writing content to iframe, body length:', mailBody.length);
                    // Sanitize and write HTML content to iframe
                    const sanitizedContent = sanitizeHtml(mailBody);
                    writeToIframe(sanitizedContent);
                    // Set iframeLoaded after content is written
                    setTimeout(() => {
                        if (selectedMail && selectedMail.id === mailId) {
                            iframeLoaded = true;
                            console.log('Iframe loaded and content written');
                        }
                    }, 100);
                    return true;
                } else {
                    console.log('Iframe document not accessible yet');
                }
            } catch (error) {
                console.error("Error writing to iframe:", error);
            }
            return false;
        };

        // Try to write immediately
        if (!writeContent()) {
            // If iframe not ready, try again with multiple retries
            let retries = 0;
            const maxRetries = 5;
            const timeoutId = setInterval(() => {
                retries++;
                if (selectedMail && selectedMail.id === mailId && iframeRef) {
                    if (writeContent() || retries >= maxRetries) {
                        clearInterval(timeoutId);
                    }
                } else {
                    clearInterval(timeoutId);
                }
            }, 200);
            
            return () => {
                clearInterval(timeoutId);
            };
        }
    });
</script>

{#if selectedMail}
    <Card class="mail-view-card">
        <CardHeader class="pb-3 shrink-0">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold line-clamp-2">{selectedMail.subject}</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    on:click={() => selectedMail = null}
                    title="Close"
                >
                    <X class="h-4 w-4" />
                </Button>
            </div>
        </CardHeader>
        <CardContent class="mail-content-wrapper p-0 flex flex-col h-full min-h-0 max-h-full">
            <div class="px-6 pb-4 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium">{formatEmailString(selectedMail.from)}</div>
                        <div class="text-sm text-muted-foreground">
                            {DateUtil.formatDateTime(selectedMail.received_date, {
                                dateStyle: 'medium',
                                use24Hour: false
                            })}
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            on:click={() => mailMessagesStore.moveToArchive(selectedMail.id)}
                            title="Archive"
                        >
                            <Archive class="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            on:click={() => mailMessagesStore.moveToTrash(selectedMail.id)}
                            title="Delete"
                        >
                            <Trash2 class="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            class={cn(
                                selectedMail.is_starred ? "text-primary" : "text-muted-foreground"
                            )}
                            on:click={() => mailMessagesStore.toggleStar(selectedMail.id)}
                            title="Star"
                        >
                            <Star
                                class={cn(
                                    "h-4 w-4",
                                    selectedMail.is_starred && "fill-current"
                                )}
                            />
                        </Button>
                    </div>
                </div>
                <Separator />
                <Button
                    variant="ghost"
                    size="sm"
                    class="w-full justify-between"
                    on:click={toggleBodyCollapse}
                >
                    <span>{isBodyCollapsed ? "Show" : "Hide"} message</span>
                    {#if isBodyCollapsed}
                        <ChevronDown class="h-4 w-4" />
                    {:else}
                        <ChevronUp class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
            
            <Separator />
            <div class="email-body-container flex-1 min-h-0 overflow-hidden flex flex-col" class:hidden={isBodyCollapsed}>
                {#if selectedMail.body && selectedMail.body.trim()}
                    <!-- Render HTML body in iframe with fallback -->
                    <iframe
                        bind:this={iframeRef}
                        onload={handleIframeLoad}
                        title="Email content"
                        sandbox="allow-same-origin"
                        frameborder="0"
                        class="email-iframe"
                    ></iframe>
                    <!-- Fallback: Show HTML directly if iframe doesn't load -->
                    {#if !iframeLoaded}
                        <div class="email-content-fallback p-4 prose dark:prose-invert max-w-none overflow-y-auto h-full">
                            {@html sanitizeHtml(selectedMail.body)}
                        </div>
                    {/if}
                {:else if selectedMail.snippet && selectedMail.snippet.trim()}
                    <!-- Show snippet if body is empty -->
                    <div class="email-content p-4 overflow-y-auto h-full">
                        <div class="whitespace-pre-wrap text-muted-foreground italic">
                            <p class="text-sm mb-2">Snippet (body not available):</p>
                            {selectedMail.snippet}
                        </div>
                    </div>
                {:else}
                    <div class="email-content p-4 text-muted-foreground overflow-y-auto h-full">
                        <p>No content available for this email.</p>
                        <p class="text-xs mt-2">Body: {selectedMail.body ? 'exists but empty' : 'does not exist'}</p>
                        <p class="text-xs">Snippet: {selectedMail.snippet || 'not available'}</p>
                    </div>
                {/if}
            </div>
        </CardContent>
    </Card>
{:else}
    <Card class="mail-view-card">
        <CardContent class="flex items-center justify-center h-full min-h-0 max-h-full p-8">
            <div class="text-center text-muted-foreground">
                <p class="text-sm">Select an email to view</p>
            </div>
        </CardContent>
    </Card>
{/if}

<style>
    .mail-view-card {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        height: 100%;
        min-height: 0;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    :global(.mail-view-card.bg-card) {
        height: 100%;
        min-height: 0;
        max-height: 100%;
    }
    
    /* Only apply flex layout to CardContent, not CardHeader */
    :global(.mail-view-card .mail-content-wrapper) {
        height: 100%;
        min-height: 0;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .email-body-container {
        position: relative;
    }

    .email-iframe {
        width: 100%;
        height: 100%;
        min-height: 400px;
        border: none;
        overflow-y: auto;
        background: white;
        flex: 1 1 auto;
        display: block;
    }

    :global(.dark .email-iframe) {
        background: transparent;
    }

    .email-content-fallback {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow-y: auto;
        background: var(--background);
        z-index: 1;
    }

    .email-content {
        font-family: inherit;
        line-height: 1.6;
        height: 100%;
        min-height: 300px;
        overflow-y: auto;
        flex: 1 1 auto;
    }
</style>

