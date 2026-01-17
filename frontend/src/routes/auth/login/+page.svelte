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
	import { browser } from "$app/environment";
	import LoginVisualization from "$lib/components/LoginVisualization.svelte";

	onMount(() => {
		if (authService.isAuthenticated) {
			goto("/dashboard");
		}
		
		function updateRotation() {
			if (browser) {
				isSmallOrMediumScreen = window.innerWidth < 1024;
				if (visualizationComponent) {
					visualizationComponent.setRotation(isSmallOrMediumScreen);
				}
			}
		}
		
		updateRotation();
		window.addEventListener("resize", updateRotation);
		
		return () => {
			window.removeEventListener("resize", updateRotation);
		};
	});

	let error = $state<string | null>(null);
	let isLoading = $state(false);

	let username = $state("");
	let password = $state("");
	let visualizationComponent: LoginVisualization | null = $state(null);
	
		let loginState = $state<'idle' | 'animating' | 'processing' | 'success' | 'failed'>('idle');
	let isFormVisible = $state(true);
	let isVisualizationExpanded = $state(false);
	let isSmallOrMediumScreen = $state(false);

	async function handleLogin() {
		if (isLoading || loginState !== 'idle') return;
		
		error = null;
		loginState = 'animating';
		
		isFormVisible = false;
		
		setTimeout(() => {
			isVisualizationExpanded = true;
			
			if (visualizationComponent) {
				visualizationComponent.triggerAllCharacters();
			}
			
			setTimeout(async () => {
				loginState = 'processing';
				isLoading = true;
				
				if (visualizationComponent) {
					visualizationComponent.setLoginProcessingMode(true);
				}
				
				try {
					await authService.login(username, password);
					
					await new Promise(resolve => setTimeout(resolve, 2000));
					
					loginState = 'success';
					if (visualizationComponent) {
						visualizationComponent.setLoginProcessingMode(false);
						visualizationComponent.changeAllSignalsColor('#10b981');
						
						visualizationComponent.collapseToSingleLine(1000);
						
						setTimeout(() => {
							if (visualizationComponent) {
								visualizationComponent.fadeOutAll(800);
							}
							
							setTimeout(() => {
								goto("/dashboard");
							}, 900);
						}, 1100);
					} else {
						setTimeout(() => {
							goto("/dashboard");
						}, 2000);
					}
				} catch (err) {
					await new Promise(resolve => setTimeout(resolve, 2000));
					
					loginState = 'failed';
					if (visualizationComponent) {
						visualizationComponent.setLoginProcessingMode(false);
						visualizationComponent.changeAllSignalsColor('#ef4444');
						
						setTimeout(() => {
							if (visualizationComponent) {
								visualizationComponent.destroyAllSignals();
							}
							
							setTimeout(() => {
								resetLoginView();
								error = (err as Error).message;
							}, 800);
						}, 300);
					}
				} finally {
					isLoading = false;
				}
			}, 500);
		}, 50);
	}
	
	function resetLoginView() {
		if (visualizationComponent) {
			try {
				visualizationComponent.resetVisualization();
			} catch (err) {
				console.error("Error resetting visualization:", err);
			}
		}
		
		isVisualizationExpanded = false;
		
		setTimeout(() => {
			isFormVisible = true;
			loginState = 'idle';
		}, 100);
	}

	function handleLogout() {
		authService.logout();
		goto("/auth/login");
	}
</script>

<div class="flex min-h-screen bg-background relative overflow-hidden lg:flex-row flex-col">
	<div 
		class="flex items-center justify-center transition-all duration-500 ease-in-out z-10 overflow-hidden lg:relative lg:bg-background"
		class:w-full={isFormVisible && !isSmallOrMediumScreen}
		class:lg:w-[420px]={isFormVisible}
		class:xl:w-[560px]={isFormVisible}
		class:w-0={!isFormVisible && !isSmallOrMediumScreen}
		class:translate-x-[-100%]={!isFormVisible && !isSmallOrMediumScreen}
		class:opacity-0={!isFormVisible}
		class:pointer-events-none={!isFormVisible}
		class:hidden={!isFormVisible && isSmallOrMediumScreen}
		class:absolute={isSmallOrMediumScreen && isFormVisible}
		class:inset-0={isSmallOrMediumScreen && isFormVisible}
		class:bg-transparent={isSmallOrMediumScreen}
		class:p-8={isFormVisible}
		class:lg:p-20={isFormVisible}
		class:p-0={!isFormVisible}
	>
		<div class="w-full max-w-sm mx-auto">
			{#if authService.isAuthenticated && authService.user}
				<Card class="p-4">
					<CardHeader class="p-0 pb-3">
						<CardTitle class="text-xl">Welcome, {authService.user.name ||
								authService.user.username}!</CardTitle>
						<CardDescription class="text-xs">You are currently signed in.</CardDescription>
					</CardHeader>
					<CardFooter class="p-0 pt-2">
						<Button onclick={handleLogout} variant="outline" class="w-full text-sm h-9">
							Sign Out
						</Button>
					</CardFooter>
				</Card>
			{:else}
				<Card class="p-4">
					<CardHeader class="p-0 pb-3">
						<CardTitle class="text-xl">Welcome to Nen Space</CardTitle>
						<CardDescription class="text-xs">
							Sign in to your account or create a new one.
						</CardDescription>
					</CardHeader>
					<CardContent class="p-0 pb-3">
						<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
							<div class="grid w-full items-center gap-3">
								<div class="flex flex-col space-y-1">
									<Label for="username" class="text-xs">Username</Label>
									<Input
										id="username"
										bind:value={username}
										disabled={isLoading || loginState !== 'idle'}
										class="h-9 text-sm"
										oninput={(e) => {
											const char = (e.target as HTMLInputElement).value.slice(-1);
											if (char && visualizationComponent) {
												visualizationComponent.onCharacterTyped(char);
											}
										}}
										onkeydown={(e) => {
											if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
												if (visualizationComponent) {
													visualizationComponent.onCharacterTyped(e.key);
												}
											}
										}}
									/>
								</div>
								<div class="flex flex-col space-y-1">
									<Label for="password" class="text-xs">Password</Label>
									<Input
										id="password"
										type="password"
										bind:value={password}
										disabled={isLoading || loginState !== 'idle'}
										class="h-9 text-sm"
										onkeydown={(e) => {
											if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== "Enter") {
												if (visualizationComponent) {
													visualizationComponent.onCharacterTyped(e.key);
												}
											}
											if (e.key === "Enter" && !isLoading && loginState === 'idle') {
												e.preventDefault();
												handleLogin();
											}
										}}
									/>
								</div>
							</div>
						</form>
						{#if error}
							<Alert variant="destructive" class="mt-3 py-2">
								<AlertDescription class="text-xs">{error}</AlertDescription>
							</Alert>
						{/if}
					</CardContent>
					<CardFooter class="p-0">
						<Button onclick={handleLogin} disabled={isLoading || loginState !== 'idle'} class="w-full text-sm h-9">
							{#if isLoading}
								<Loader2 class="mr-2 h-3 w-3 animate-spin" />
							{/if}
							Login
						</Button>
					</CardFooter>
				</Card>
			{/if}
		</div>
	</div>

	<div 
		class="flex relative bg-[#020817] transition-all duration-500 ease-in-out flex-grow w-full h-full min-h-screen"
		class:fixed={isVisualizationExpanded}
		class:inset-0={isVisualizationExpanded}
		class:h-full={isVisualizationExpanded}
		class:z-20={isVisualizationExpanded}
		class:z-0={!isVisualizationExpanded}
		class:py-8={!isVisualizationExpanded && !isSmallOrMediumScreen}
		class:min-w-0={!isVisualizationExpanded}
	>
		<LoginVisualization bind:this={visualizationComponent} />
	</div>
</div>

