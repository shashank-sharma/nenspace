<script lang="ts">
    import {
        MailLayout,
        MailTable,
        MailDisplay,
    } from "$lib/features/mail/components";
    import { MailService } from "../services/mail.service";
    import type { MailMessage } from "../types";
    import { Loader2, AlertCircle, Mail as MailIcon } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { fade } from "svelte/transition";
    import { pb } from "$lib/config/pocketbase";
    import MailList from "./MailList.svelte";
    import MailDisplayComponent from "./MailDisplay.svelte";
    import { toast } from "svelte-sonner";
    import type { SyncStatus } from "../types";

    // --- State Management with Runes ---

    // Mail Status State
    let isAuthenticated = $state(false);
    let syncStatus = $state<SyncStatus | null>(null);

    // Messages State
    let mails = $state<MailMessage[]>([]);
    let selectedMail = $state<MailMessage | null>(null);
    let totalItems = $state(0);
    let page = $state(1);

    // UI State
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // --- Logic ---

    async function initialize() {
        isLoading = true;
        error = null;
        try {
            const status = await MailService.checkStatus();
            isAuthenticated = !!status;
            syncStatus = status;

            if (isAuthenticated) {
                await fetchMails(true);
                subscribeToChanges();
            }
        } catch (e: any) {
            if (e.status !== 404) {
                error = "Failed to initialize mail component.";
            }
            isAuthenticated = false;
        } finally {
            isLoading = false;
        }
    }

    async function fetchMails(reset = false) {
        if (reset) {
            page = 1;
            mails = [];
        }
        try {
            const result = await MailService.getMails({ page, perPage: 20 });
            mails = reset ? result.items : [...mails, ...result.items];
            totalItems = result.totalItems;
            page = result.page + 1;
        } catch (e) {
            toast.error("Failed to fetch emails.");
        }
    }

    function subscribeToChanges() {
        if (syncStatus?.id) {
            pb.collection("mail_sync").subscribe(
                syncStatus.id,
                (e: { record: SyncStatus }) => {
                    syncStatus = e.record;
                    if (e.record.sync_status === "completed") {
                        fetchMails(true);
                    }
                },
            );
        }
        pb.collection("mail_messages").subscribe(
            "*",
            (e: { action: string; record: MailMessage }) => {
                if (e.action === "create") {
                    mails = [e.record, ...mails];
                } else if (e.action === "update") {
                    mails = mails.map((m) =>
                        m.id === e.record.id ? e.record : m,
                    );
                }
            },
        );
    }

    $effect(() => {
        initialize();
        return () => {
            pb.collection("mail_sync").unsubscribe();
            pb.collection("mail_messages").unsubscribe();
        };
    });

    function handleSelectMail(e: CustomEvent<MailMessage>) {
        selectedMail = e.detail;
    }
</script>

{#if isLoading}
    <div class="flex items-center justify-center h-full">
        <Loader2 class="w-8 h-8 animate-spin" />
    </div>
{:else if error}
    <div class="flex items-center justify-center h-full">{error}</div>
{:else if !isAuthenticated}
    <div class="flex items-center justify-center h-full">
        <div class="text-center">
            <MailIcon class="w-16 h-16 mx-auto mb-4" />
            <h2 class="text-2xl font-bold mb-3">Connect Your Email</h2>
            <Button asChild>
                <a href="/api/mail/auth/redirect">Connect Gmail</a>
            </Button>
        </div>
    </div>
{:else}
    <MailLayout>
        <div class="flex h-full">
            <div class="w-[500px] border-r">
                <MailList bind:mails on:selectMail={handleSelectMail} />
            </div>
            <div class="flex-1">
                <MailDisplayComponent {selectedMail} />
            </div>
        </div>
    </MailLayout>
{/if}
