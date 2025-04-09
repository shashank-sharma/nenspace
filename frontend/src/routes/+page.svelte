<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { fly, fade, scale, crossfade } from "svelte/transition";
	import { cubicOut, elasticOut, bounceOut } from "svelte/easing";
	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import { Card } from "$lib/components/ui/card";
	import { Avatar } from "$lib/components/ui/avatar";
	import {
		Download,
		ChevronRight,
		Server,
		ListTodo,
		Banknote,
		Book,
		Menu,
	} from "lucide-svelte";
	import { browser } from "$app/environment";
	import {
		showInstallPrompt,
		installPrompt,
		triggerInstallBanner,
		isPwaInstalled,
	} from "$lib/features/pwa/services";
	import NenAura from "$lib/components/icons/NenAura.svelte";
	import { spring } from "svelte/motion";

	let pwaInstallBanner: any;
	let canInstallPwa = false;
	let loaded = false;
	let activeCategoryIndex = 0;
	let categoryHovered = false;
	let auraVisible = false;
	let mouseX = 0;
	let mouseY = 0;
	let cursorAuraSize = 40;
	let cursorVisible = false;
	let lastMouseMoveTime = 0;
	let mouseMoveTimeout: ReturnType<typeof setTimeout>;

	const coords = spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.1,
			damping: 0.4,
		},
	);

	const categories = [
		{
			name: "Servers",
			icon: Server,
			description: "Monitor and manage your servers with precision",
			nenType: "Enhancement",
			color: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
			borderColor: "border-orange-500/50",
			auraColor: "rgba(249, 115, 22, 0.2)",
			nenTypeValue: "enhancement",
		},
		{
			name: "Todo List",
			icon: ListTodo,
			description: "Track tasks and enhance your productivity",
			nenType: "Manipulation",
			color: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
			borderColor: "border-sky-500/50",
			auraColor: "rgba(14, 165, 233, 0.2)",
			nenTypeValue: "manipulation",
		},
		{
			name: "Finance",
			icon: Banknote,
			description: "Analyze and control your financial resources",
			nenType: "Transmutation",
			color: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
			borderColor: "border-emerald-500/50",
			auraColor: "rgba(16, 185, 129, 0.2)",
			nenTypeValue: "transmutation",
		},
		{
			name: "Daily Notes",
			icon: Book,
			description: "Capture and materialize your thoughts and ideas",
			nenType: "Conjuration",
			color: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
			borderColor: "border-purple-500/50",
			auraColor: "rgba(168, 85, 247, 0.2)",
			nenTypeValue: "conjuration",
		},
	];

	let auraInterval: ReturnType<typeof setInterval>;

	function updateMousePosition(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
		coords.set({ x: mouseX, y: mouseY });

		cursorVisible = true;
		lastMouseMoveTime = Date.now();
		clearTimeout(mouseMoveTimeout);

		mouseMoveTimeout = setTimeout(() => {
			if (Date.now() - lastMouseMoveTime > 2000) {
				cursorVisible = false;
			}
		}, 2000);
	}

	function forceShowInstallBanner() {
		if (browser) {
			sessionStorage.removeItem("pwa-banner-dismissed");

			if (
				pwaInstallBanner &&
				typeof pwaInstallBanner.forceShow === "function"
			) {
				pwaInstallBanner.forceShow();
				return;
			}

			const unsubscribe = installPrompt.subscribe((value) => {
				if (value) {
					showInstallPrompt();
				} else {
					triggerInstallBanner();
				}
			});
			unsubscribe();
		}
	}

	function handleMouseMove(e: MouseEvent, index: number) {
		activeCategoryIndex = index;
		categoryHovered = true;
		auraVisible = true;

		updateMousePosition(e);
	}

	function handleMouseLeave() {
		categoryHovered = false;
	}

	onMount(() => {
		const unsubInstalled = isPwaInstalled.subscribe((value) => {
			canInstallPwa = !value;
		});

		if (browser) {
			window.addEventListener(
				"force-show-pwa-banner",
				forceShowInstallBanner,
			);
			window.addEventListener("mousemove", updateMousePosition);
		}

		setTimeout(() => {
			loaded = true;
		}, 300);

		auraInterval = setInterval(() => {
			if (!categoryHovered) {
				activeCategoryIndex =
					(activeCategoryIndex + 1) % categories.length;
				auraVisible = true;
				setTimeout(() => {
					if (!categoryHovered) {
						auraVisible = false;
					}
				}, 2000);
			}
		}, 4000);

		return () => {
			unsubInstalled();
			if (browser) {
				window.removeEventListener(
					"force-show-pwa-banner",
					forceShowInstallBanner,
				);
				window.removeEventListener("mousemove", updateMousePosition);
			}
			clearInterval(auraInterval);
			clearTimeout(mouseMoveTimeout);
		};
	});

	onDestroy(() => {
		clearInterval(auraInterval);
		clearTimeout(mouseMoveTimeout);
	});
</script>

<div class="min-h-screen flex flex-col relative">
	{#if cursorVisible}
		<div
			class="nen-cursor fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2"
			style="left: {$coords.x}px; top: {$coords.y}px;"
		>
			<div class="cursor-dot"></div>
			<div
				class="cursor-aura transition-all duration-500"
				style="background: radial-gradient(circle, {categories[
					activeCategoryIndex
				].auraColor.replace('0.2', '0.8')} 0%, transparent 70%);"
			></div>
		</div>
	{/if}

	{#if auraVisible}
		<div
			class="absolute inset-0 pointer-events-none transition-opacity duration-1000 opacity-70"
			style="background: radial-gradient(circle at center, {categories[
				activeCategoryIndex
			].auraColor} 0%, transparent 70%); z-index: 0;"
			transition:fade={{ duration: 1000 }}
		></div>
	{/if}

	<section
		class="relative z-10 py-12 md:py-24 px-4 text-center flex flex-col items-center justify-center"
	>
		<div
			class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
		>
			<div
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-75 md:scale-90 opacity-0 transform-gpu -mt-16 md:mt-0 transition-opacity duration-700"
				style="width: 800px; height: 800px;"
				class:opacity-40={loaded}
			>
				<div class="w-full h-full" class:scale-aura-in={loaded}>
					<NenAura
						size={800}
						type={categories[activeCategoryIndex].nenTypeValue}
						intensity={0.3}
						pulseSpeed={5}
					/>
				</div>
			</div>
		</div>

		<div class="relative z-10">
			{#if loaded}
				<div
					in:scale={{ duration: 800, delay: 200, easing: elasticOut }}
				>
					<div class="mb-2 flex justify-center">
						<Badge
							variant="outline"
							class="py-1.5 px-4 text-sm uppercase font-bold bg-background/80 backdrop-blur-sm border-primary/20"
						>
							<span class="text-primary mr-1">NEN</span>
							<span class="opacity-70">AWAKENED</span>
						</Badge>
					</div>
				</div>

				<h1
					class="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 mt-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70"
					in:fly={{
						y: 50,
						duration: 800,
						delay: 400,
						easing: cubicOut,
					}}
				>
					Nen Space
				</h1>

				<p
					class="max-w-xl mx-auto text-muted-foreground text-lg mb-8"
					in:fly={{
						y: 20,
						duration: 800,
						delay: 600,
						easing: cubicOut,
					}}
				>
					Harness your aura to control and visualize your personal
					data in one powerful space. Like Nen mastery, your dashboard
					evolves as you use it.
				</p>

				<div
					class="flex flex-wrap gap-4 justify-center"
					in:fly={{
						y: 20,
						duration: 800,
						delay: 800,
						easing: cubicOut,
					}}
				>
					<Button size="lg" class="gap-2 rounded-full px-6">
						Go to Dashboard <ChevronRight class="h-4 w-4" />
					</Button>

					<Button
						size="lg"
						variant="outline"
						class="gap-2 rounded-full px-6"
					>
						Learn More
					</Button>
				</div>
			{/if}
		</div>
	</section>

	<section class="relative z-10 py-12 md:py-20 px-4 max-w-6xl mx-auto w-full">
		{#if loaded}
			<div
				class="text-center mb-16"
				in:fly={{ y: 30, duration: 800, delay: 1000, easing: cubicOut }}
			>
				<h2 class="text-3xl font-bold mb-4">
					Master Your Personal Data Aura
				</h2>
				<p class="text-muted-foreground max-w-xl mx-auto">
					Each aspect of your data represents a different Nen type,
					giving you specialized abilities to manage your digital
					life.
				</p>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				{#each categories as category, i}
					<div
						class="group"
						in:fly={{
							y: 30,
							duration: 800,
							delay: 1200 + i * 200,
							easing: cubicOut,
						}}
						on:mouseenter={(e) => handleMouseMove(e, i)}
						on:mouseleave={handleMouseLeave}
					>
						<Card
							class={`relative h-full p-6 transition-all duration-500 overflow-hidden border-2 hover:shadow-xl ${category.borderColor} hover:border-primary/50`}
						>
							<div
								class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
								style={`background: radial-gradient(circle at center, ${category.auraColor} 0%, transparent 70%);`}
							></div>

							<div
								class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-75 opacity-0 group-hover:opacity-100 transition-all duration-500 z-0"
							>
								<NenAura
									type={category.nenTypeValue}
									size={300}
									intensity={0.5}
									pulseSpeed={3}
								/>
							</div>

							<div class="relative z-10 flex flex-col h-full">
								<Badge
									variant="outline"
									class={`self-start mb-4 ${category.color}`}
								>
									{category.nenType} Type
								</Badge>

								<div
									class={`p-3 rounded-lg mb-4 w-fit ${category.color}`}
								>
									<svelte:component
										this={category.icon}
										class="h-6 w-6"
									/>
								</div>

								<h3 class="text-xl font-bold mb-2">
									{category.name}
								</h3>
								<p class="text-muted-foreground mb-6">
									{category.description}
								</p>

								<Button
									variant="ghost"
									class="justify-start p-0 w-fit mt-auto group"
								>
									Explore
									<ChevronRight
										class="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1"
									/>
								</Button>
							</div>
						</Card>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="relative z-10 py-12 md:py-24 px-4 text-center">
		{#if loaded}
			<div
				class="max-w-3xl mx-auto bg-card p-8 rounded-xl border shadow-lg relative overflow-hidden"
				in:scale={{ duration: 800, delay: 2000, easing: bounceOut }}
			>
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-75 opacity-50 pointer-events-none z-0"
				>
					<NenAura
						type="emission"
						size={400}
						intensity={0.4}
						pulseSpeed={4}
					/>
				</div>

				<div class="relative z-10">
					<h2 class="text-2xl md:text-3xl font-bold mb-4">
						Begin Your Nen Training Today
					</h2>
					<p class="text-muted-foreground mb-8">
						Like mastering Nen, organizing your digital life takes
						practice. Start your journey to digital mastery now.
					</p>

					<Button size="lg" class="gap-2 rounded-full px-8">
						Start Now <ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	</section>
	{#if browser && canInstallPwa}
		<div class="fixed top-4 right-4 z-50">
			<Button
				variant="default"
				size="sm"
				class="shadow-lg gap-1"
				on:click={forceShowInstallBanner}
			>
				<Download class="w-4 h-4" /> Install App
			</Button>
		</div>
	{/if}
</div>

<style>
	@keyframes pulse-aura {
		0% {
			opacity: 0.5;
			transform: scale(0.95);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.05);
		}
		100% {
			opacity: 0.5;
			transform: scale(0.95);
		}
	}

	.nen-cursor {
		mix-blend-mode: screen;
	}

	.cursor-dot {
		width: 6px;
		height: 6px;
		background: hsl(var(--primary));
		border-radius: 50%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
	}

	.cursor-aura {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1;
		animation: pulse-cursor 2s infinite ease-in-out;
	}

	@keyframes pulse-cursor {
		0% {
			transform: translate(-50%, -50%) scale(0.8);
			opacity: 0.3;
		}
		50% {
			transform: translate(-50%, -50%) scale(1.2);
			opacity: 0.7;
		}
		100% {
			transform: translate(-50%, -50%) scale(0.8);
			opacity: 0.3;
		}
	}

	:global(html) {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--primary) / 0.3) transparent;
		cursor: none;
	}

	:global(::-webkit-scrollbar) {
		width: 8px;
	}

	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(::-webkit-scrollbar-thumb) {
		background-color: hsl(var(--primary) / 0.3);
		border-radius: 20px;
	}

	:global(::-webkit-scrollbar-thumb:hover) {
		background-color: hsl(var(--primary) / 0.5);
	}

	.scale-aura-in {
		animation: scale-in 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	@keyframes scale-in {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
