<script lang="ts">
    import MailSearchBar from "./MailSearchBar.svelte";
    import MailStatusBar from "./MailStatusBar.svelte";
    import MailList from "./MailList.svelte";
    import MailView from "./MailView.svelte";
    import { mailStore, mailMessagesStore } from "../stores";
    import { MailService } from "../services/mail.service";
    import { Loader2, AlertCircle, Mail as MailIcon, CheckCircle2, Settings, Shield } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { fade } from "svelte/transition";
    import { browser } from "$app/environment";
    import { pb } from "$lib/config/pocketbase";
    import { toast } from "svelte-sonner";
    import type { MailMessage, SyncStatus } from "../types";

    // Subscribe to realtime updates
    let unsubscribeSync: (() => void) | null = null;
    let unsubscribeMessages: (() => void) | null = null;
    let initialized = $state(false);
    let authWindow: Window | null = null;
    let inactiveSyncs = $state<Array<{ id: string; provider: string; sync_status: string; last_synced: string; created: string }>>([]);
    let selectedMailSyncId = $state<string | undefined>(undefined);
    let isLoadingInactiveSyncs = $state(false);
    let hasLoadedInactiveSyncs = $state(false);

    // Load inactive syncs when not authenticated (only once)
    $effect(() => {
        const syncAvailable = mailStore.syncAvailable;
        
        // Only load if not authenticated, not currently loading, and haven't loaded yet
        if (!syncAvailable && !isLoadingInactiveSyncs && !hasLoadedInactiveSyncs) {
            isLoadingInactiveSyncs = true;
            hasLoadedInactiveSyncs = true; // Mark as loaded to prevent re-fetching
            MailService.getInactiveSyncs()
                .then((syncs) => {
                    inactiveSyncs = syncs;
                })
                .catch((error) => {
                    console.error('Failed to load inactive syncs:', error);
                    hasLoadedInactiveSyncs = false; // Reset on error so we can retry
                })
                .finally(() => {
                    isLoadingInactiveSyncs = false;
                });
        }
        
        // Reset the flag when sync becomes available (user authenticated)
        if (syncAvailable && hasLoadedInactiveSyncs) {
            hasLoadedInactiveSyncs = false;
            inactiveSyncs = []; // Clear inactive syncs when authenticated
        }
    });

    // Listen for auth completion message
    $effect(() => {
        function handleMessage(event: MessageEvent) {
            if (event.data === 'AUTH_COMPLETE') {
                // Refresh status when auth is complete
                mailStore.checkStatus(true).then(() => {
                    if (authWindow) {
                        authWindow.close();
                        authWindow = null;
                    }
                    // Also fetch messages if authenticated
                    if (mailStore.syncAvailable) {
                        mailMessagesStore.fetchMails(true);
                    }
                    // Reset selection
                    selectedMailSyncId = undefined;
                    // Reset flag so inactive syncs can be reloaded if needed
                    hasLoadedInactiveSyncs = false;
                });
            }
        }

        if (browser) {
            window.addEventListener('message', handleMessage);
        }

        return () => {
            if (browser) {
                window.removeEventListener('message', handleMessage);
            }
            if (authWindow) {
                authWindow.close();
                authWindow = null;
            }
        };
    });

    // Subscribe to sync status changes - only when syncStatus.id changes
    $effect(() => {
        const syncId = mailStore.syncStatus?.id;
        if (!syncId) {
            if (unsubscribeSync) {
                unsubscribeSync();
                unsubscribeSync = null;
            }
            return;
        }

        // Only subscribe if we don't already have a subscription
        if (unsubscribeSync) return;

        pb.collection("mail_sync")
            .subscribe(
                syncId,
                (e: { record: SyncStatus }) => {
                    const previousStatus = mailStore.syncStatus?.status;
                    mailStore.updateSyncStatus(e.record);
                    
                    // Show toast for errors (status is parsed in updateSyncStatus)
                    const currentStatus = mailStore.syncStatus;
                    if (currentStatus?.status === "failed" && currentStatus?.error_message) {
                        toast.error(currentStatus.error_message, {
                            duration: 10000, // Show for 10 seconds
                        });
                    }
                    
                    // Show toast for inactive status requiring re-authentication
                    if (currentStatus?.needs_reauth || currentStatus?.status === "inactive" || !currentStatus?.is_active) {
                        toast.warning("Email sync is inactive. Please re-authenticate to continue syncing.", {
                            duration: 10000, // Show for 10 seconds
                        });
                    }
                    
                    if (e.record.status === "completed") {
                        mailMessagesStore.refreshMails();
                        // Don't call checkStatus here - it might overwrite the "completed" status
                        // The realtime event already has the correct status, and message_count
                        // will be preserved by updateSyncStatus
                        // Only show success toast if it was previously syncing
                        if (previousStatus === "in_progress" || previousStatus === "in-progress") {
                            toast.success("Email sync completed successfully");
                        }
                    }
                }
            )
            .then((unsub) => {
                unsubscribeSync = unsub;
            })
            .catch((error) => {
                console.error("Failed to subscribe to mail sync:", error);
                toast.error("Failed to connect to realtime updates");
            });

        return () => {
            if (unsubscribeSync) {
                unsubscribeSync();
                unsubscribeSync = null;
            }
        };
    });

    // Subscribe to message changes - only once
    $effect(() => {
        // Only subscribe once
        if (unsubscribeMessages) return;

        pb.collection("mail_messages")
            .subscribe("*", (e: { action: string; record: MailMessage }) => {
                if (e.action === "create") {
                    mailMessagesStore.upsertMessage(e.record);
                } else if (e.action === "update") {
                    mailMessagesStore.upsertMessage(e.record);
                } else if (e.action === "delete") {
                    mailMessagesStore.removeMessage(e.record.id);
                }
            })
            .then((unsub) => {
                unsubscribeMessages = unsub;
            })
            .catch((error) => {
                console.error("Failed to subscribe to mail messages:", error);
                toast.error("Failed to connect to realtime updates");
            });

        return () => {
            if (unsubscribeMessages) {
                unsubscribeMessages();
                unsubscribeMessages = null;
            }
        };
    });

    // Initialize on mount - only once
    $effect(() => {
        if (initialized) return;
        initialized = true;
        
        mailStore.initialize().then(() => {
            if (mailStore.syncAvailable) {
                mailMessagesStore.fetchMails(true);
            }
        }).catch((error) => {
            console.error('Failed to initialize mail feature:', error);
        });
    });

    // Watch for authentication changes - only fetch once when authenticated
    let hasFetchedOnAuth = $state(false);
    
    $effect(() => {
        const isAuth = mailStore.isAuthenticated;
        const hasAttempted = mailMessagesStore.hasAttemptedFetch;
        const isLoading = mailMessagesStore.isLoading;
        
        if (isAuth && !hasAttempted && !isLoading && !hasFetchedOnAuth) {
            hasFetchedOnAuth = true;
            mailMessagesStore.fetchMails(true).catch((error) => {
                console.error('Failed to fetch mails on auth:', error);
                hasFetchedOnAuth = false;
            });
        }
    });

    function handleSelectMail(mail: MailMessage) {
        mailMessagesStore.selectMail(mail).catch(console.error);
    }
</script>

{#if mailStore.isLoading}
    <div class="flex items-center justify-center h-full">
        <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
{:else if mailStore.error}
    <div class="flex items-center justify-center h-full flex-col gap-4">
        <AlertCircle class="w-8 h-8 text-destructive" />
        <p class="text-sm text-muted-foreground">{mailStore.error}</p>
        <Button variant="outline" on:click={() => mailStore.initialize()}>
            Retry
        </Button>
    </div>
{:else if !mailStore.syncAvailable}
    <div class="flex flex-col items-center justify-center h-full p-8 gap-8 max-w-5xl mx-auto">
        <!-- Main Connect Card -->
        <Card class="w-full">
            <CardHeader class="text-center">
                <div class="flex justify-center mb-4">
                    <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <MailIcon class="w-10 h-10 text-primary" />
                    </div>
                </div>
                <CardTitle class="text-3xl">Connect Your Email</CardTitle>
                <CardDescription class="text-base mt-2">
                    Securely connect your Gmail account to start managing your emails
                </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4 pt-6">
                {#if inactiveSyncs.length > 0}
                    <div class="space-y-2">
                        <label class="text-sm font-medium">Re-authenticate existing account (optional)</label>
                        <Select
                            value={selectedMailSyncId}
                            onValueChange={(value) => {
                                selectedMailSyncId = value === "new" ? undefined : value;
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select an inactive account or create new" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">Create new connection</SelectItem>
                                {#each inactiveSyncs as sync}
                                    <SelectItem value={sync.id}>
                                        {sync.provider} - Last synced: {sync.last_synced ? new Date(sync.last_synced).toLocaleDateString() : 'Never'}
                                    </SelectItem>
                                {/each}
                            </SelectContent>
                        </Select>
                        {#if selectedMailSyncId}
                            <p class="text-xs text-muted-foreground">
                                This will update the existing account with a new token
                            </p>
                        {/if}
                    </div>
                {/if}
                <div class="flex justify-center">
                <Button 
                    size="lg" 
                    class="px-8"
                    on:click={async () => {
                        const url = await mailStore.startAuth();
                        if (url) {
                                // Store selected mail_sync_id in sessionStorage to retrieve after OAuth
                                if (selectedMailSyncId) {
                                    sessionStorage.setItem('mail_sync_id', selectedMailSyncId);
                                }
                            authWindow = window.open(
                                url,
                                'auth',
                                'width=600,height=800'
                            );
                        }
                    }}
                    disabled={mailStore.isAuthenticating}
                >
                    {#if mailStore.isAuthenticating}
                        <Loader2 class="mr-2 h-5 w-5 animate-spin" />
                        Connecting...
                    {:else}
                        <MailIcon class="mr-2 h-5 w-5" />
                            {selectedMailSyncId ? "Re-authenticate" : "Connect Gmail"}
                    {/if}
                </Button>
                </div>
            </CardContent>
        </Card>

        <!-- 3-Step Progression -->
        <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Step 1: Authorize -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-3 mb-2">
                        <Shield class="h-6 w-6 text-primary" />
                        <CardTitle class="text-lg">Authorize Gmail</CardTitle>
                    </div>
                    <CardDescription>
                        Securely authorize access to your Google account with OAuth 2.0.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="space-y-2 text-sm text-muted-foreground">
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>OAuth 2.0 secure authentication</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>No password storage</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Google-managed security</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <!-- Step 2: Sync Configuration -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-3 mb-2">
                        <Settings class="h-6 w-6 text-primary" />
                        <CardTitle class="text-lg">Sync Configuration</CardTitle>
                    </div>
                    <CardDescription>
                        Configure sync frequency, folders, and preferences to match your workflow.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="space-y-2 text-sm text-muted-foreground">
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Customizable sync frequency</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Select folders to sync</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Real-time updates</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <!-- Step 3: Take Control -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-3 mb-2">
                        <CheckCircle2 class="h-6 w-6 text-primary" />
                        <CardTitle class="text-lg">Take Control</CardTitle>
                    </div>
                    <CardDescription>
                        Organize, search, filter, and manage your emails exactly how you want.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="space-y-2 text-sm text-muted-foreground">
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Advanced search and filters</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Organize with labels and folders</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>Full email management</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    </div>
{:else}
    <div class="mail-floating-layout">
        <!-- Top: Search and Filters -->
        <div class="mail-top-card">
            <MailSearchBar />
        </div>

        <!-- Main Content Area -->
        <div class="mail-content-area">
            <!-- Left: Email List -->
            <div class="mail-left-card">
                <MailList />
            </div>

            <!-- Right: Email View -->
            <div class="mail-right-card">
                <MailView bind:selectedMail={mailMessagesStore.selectedMail} />
            </div>
        </div>

        <!-- Bottom: Status Bar -->
        <div class="mail-bottom-card">
            <MailStatusBar />
        </div>
    </div>
{/if}

<style>
    .mail-floating-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 1rem;
        padding: 1rem;
        overflow: hidden;
    }

    .mail-top-card {
        flex-shrink: 0;
        z-index: 10;
    }

    .mail-content-area {
        display: grid;
        grid-template-columns: 400px 1fr;
        gap: 1rem;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .mail-left-card {
        min-width: 0;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .mail-right-card {
        min-width: 0;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .mail-bottom-card {
        flex-shrink: 0;
        z-index: 10;
    }

    @media (max-width: 1024px) {
        .mail-content-area {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
        }
    }
</style>
