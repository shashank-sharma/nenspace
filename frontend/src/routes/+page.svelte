<script lang="ts">
	import BlackHole from "$lib/components/BlackHole.svelte";
	import HomepageOverlay from "$lib/components/HomepageOverlay.svelte";

	// Configuration
	const SIMULATION_CONFIG = {
		speed: 1.0,
		isFluxMode: true,
		defaultTheme: "interstellar",
	};

	type Theme = {
		id: string;
		name: string;
		colors: {
			core: [number, number, number];
			outer: [number, number, number];
		};
	};

	const THEMES: Theme[] = [
		{
			id: "interstellar",
			name: "Gargantua",
			colors: {
				core: [1.0, 0.95, 0.8],
				outer: [0.8, 0.4, 0.1],
			},
		},
		{
			id: "cyberpunk",
			name: "Neon Flux",
			colors: {
				core: [0.2, 1.0, 1.0],
				outer: [0.6, 0.0, 1.0],
			},
		},
		{
			id: "void",
			name: "Abyssal",
			colors: {
				core: [0.9, 0.9, 1.0],
				outer: [0.1, 0.1, 0.3],
			},
		},
		{
			id: "crimson",
			name: "Red Giant",
			colors: {
				core: [1.0, 0.2, 0.1],
				outer: [0.3, 0.0, 0.0],
			},
		},
	];

	const activeTheme = THEMES.find((t) => t.id === SIMULATION_CONFIG.defaultTheme) || THEMES[0];
</script>

<svelte:head>
	<title>Nenspace</title>
</svelte:head>

<main class="relative w-screen h-screen overflow-hidden bg-black selection:bg-white/20">
	<!-- Background Shader Layer -->
	<div class="absolute inset-0 z-0">
		<BlackHole
			speed={SIMULATION_CONFIG.speed}
			colorCore={activeTheme.colors.core}
			colorOuter={activeTheme.colors.outer}
			isFluxMode={SIMULATION_CONFIG.isFluxMode}
		/>
	</div>

	<!-- UI Overlay Layer -->
	<div class="absolute inset-0 z-10 pointer-events-none">
		<HomepageOverlay />
	</div>
</main>
