<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { authService } from "$lib/services/authService.svelte";
	import { Input } from "$lib/components/ui/input";
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Label } from "$lib/components/ui/label";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Loader2 } from "lucide-svelte";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	onMount(() => {
		if (authService.isAuthenticated) {
			goto("/dashboard");
		}
	});

	let error = $state<string | null>(null);
	let isLoading = $state(false);

	let username = $state("");
	let password = $state("");

	async function handleLogin() {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			await authService.login(username, password);
			goto("/dashboard");
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isLoading = false;
		}
	}

	function handleLogout() {
		authService.logout();
		goto("/auth/login");
	}
</script>

<div
	class="flex flex-col items-center justify-center min-h-screen bg-background"
>
	{#if authService.isAuthenticated && authService.user}
		<Card class="w-[350px]">
			<CardHeader>
				<CardTitle
					>Welcome, {authService.user.name ||
						authService.user.username}!</CardTitle
				>
				<CardDescription>You are currently signed in.</CardDescription>
			</CardHeader>
			<CardFooter>
				<Button onclick={handleLogout} variant="outline" class="w-full"
					>Sign Out</Button
				>
			</CardFooter>
		</Card>
	{:else}
		<Card class="w-[350px]">
			<CardHeader>
				<CardTitle>Welcome to Nen Space</CardTitle>
				<CardDescription
					>Sign in to your account or create a new one.</CardDescription
				>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleLogin}>
					<div class="grid w-full items-center gap-4">
						<div class="flex flex-col space-y-1.5">
							<Label for="username">Username</Label>
							<Input
								id="username"
								bind:value={username}
								disabled={isLoading}
							/>
						</div>
						<div class="flex flex-col space-y-1.5">
							<Label for="password">Password</Label>
							<Input
								id="password"
								type="password"
								bind:value={password}
								disabled={isLoading}
							/>
						</div>
					</div>
				</form>
				{#if error}
					<Alert variant="destructive" class="mt-4">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}
			</CardContent>
			<CardFooter class="flex justify-between">
				<Button onclick={handleLogin} disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Login
				</Button>
			</CardFooter>
		</Card>
	{/if}
</div>
