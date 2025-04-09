<script lang="ts">
    import { Mail } from "$lib/features/mail/components";
    import { mailStore, mailMessagesStore } from "$lib/features/mail/stores";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    export let data;

    // Initialize stores with server-provided data
    $: if (browser) {
        // Update mail store state
        mailStore.setAuthenticated(data.initialMailState.isAuthenticated);
        mailStore.setLoading(data.initialMailState.isLoading);
        mailStore.setAuthenticating(data.initialMailState.isAuthenticating);
        mailStore.setSyncStatus(data.initialMailState.syncStatus);

        // Update mail messages store state
        mailMessagesStore.setMessages(data.initialMailMessages.messages);
        mailMessagesStore.setLoading(data.initialMailMessages.isLoading);
        mailMessagesStore.setTotalItems(data.initialMailMessages.totalItems);
        mailMessagesStore.setPage(data.initialMailMessages.page);
        if (data.initialMailMessages.selectedMail) {
            mailMessagesStore.selectMail(data.initialMailMessages.selectedMail);
        }
    }
</script>

<Mail />
