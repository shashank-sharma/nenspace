<script lang="ts">
    import { logout } from "$lib/services/authService";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        logout();
        goto("/auth/login");
    });
</script>

<div>
    <h1>Logging out...</h1>
    <p>You will be redirected to the login page.</p>
</div>
