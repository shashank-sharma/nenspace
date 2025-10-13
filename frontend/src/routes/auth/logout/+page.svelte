<script lang="ts">
    import { authService } from "$lib/services/authService.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        authService.logout();
        goto("/auth/login");
    });
</script>

<div>
    <h1>Logging out...</h1>
    <p>You will be redirected to the login page.</p>
</div>
