<script lang="ts">
    import { onMount } from "svelte";
    import { Mail } from "$lib/features/mail/components";
    import { mailStore, mailMessagesStore } from "$lib/features/mail/stores";

    onMount(() => {
        console.log("Mail route mounted");
    });

    $: console.log("Mail store state:", $mailStore);
    $: console.log("Mail messages state:", $mailMessagesStore);
</script>

{@debug $mailStore, $mailMessagesStore}

<div class="container h-full py-6">
    <Mail />
</div>
