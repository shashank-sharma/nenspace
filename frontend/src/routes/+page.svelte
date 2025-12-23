<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import HalftoneBackground from "$lib/components/HalftoneBackground.svelte";
	import ThreeNenCore, {
		type NenTypeKey,
	} from "$lib/components/ThreeNenCore.svelte";

	type NenCard = {
		key: NenTypeKey;
		title: string;
		traces: string;
		accent: string;
		gradient: [string, string];
	};

	const nenTypes: NenCard[] = [
		{
			key: "enhancement",
			title: "Enhancement",
			traces: "Raw strength and resilience",
			accent: "#22c55e",
			gradient: ["rgba(34,197,94,0.28)", "rgba(132,204,22,0.16)"],
		},
		{
			key: "transmutation",
			title: "Transmutation",
			traces: "Shape-shifting aura flow",
			accent: "#c084fc",
			gradient: ["rgba(192,132,252,0.28)", "rgba(124,58,237,0.18)"],
		},
		{
			key: "emission",
			title: "Emission",
			traces: "Projection and reach",
			accent: "#38bdf8",
			gradient: ["rgba(56,189,248,0.3)", "rgba(14,165,233,0.18)"],
		},
		{
			key: "conjuration",
			title: "Conjuration",
			traces: "Manifest what you imagine",
			accent: "#67e8f9",
			gradient: ["rgba(103,232,249,0.32)", "rgba(6,182,212,0.18)"],
		},
		{
			key: "manipulation",
			title: "Manipulation",
			traces: "Fine-grain control",
			accent: "#f97316",
			gradient: ["rgba(249,115,22,0.32)", "rgba(251,146,60,0.18)"],
		},
		{
			key: "specialization",
			title: "Specialization",
			traces: "Unpredictable potential",
			accent: "#ec4899",
			gradient: ["rgba(236,72,153,0.34)", "rgba(244,114,182,0.18)"],
		},
	];

	let activeIndex = $state(0);
	let autoCycle = $state(true);
	let cycleTimer: ReturnType<typeof setInterval>;
	let coreSize = $state(280);

	const activeNen = $derived(nenTypes[activeIndex] ?? nenTypes[0]);

	function updateCoreSize() {
		if (typeof window === "undefined") return;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const reservedSpace = width < 640 ? 250 : width < 768 ? 280 : 300;
		const availableHeight = Math.max(200, height - reservedSpace);
		const availableWidth = width < 640 ? width - 60 : width < 768 ? width - 80 : width - 120;
		
		if (width < 640) {
			coreSize = Math.min(220, Math.min(availableWidth * 0.85, availableHeight));
		} else if (width < 768) {
			coreSize = Math.min(300, Math.min(availableWidth * 0.8, availableHeight));
		} else if (width < 1024) {
			coreSize = Math.min(380, Math.min(availableWidth * 0.75, availableHeight));
		} else {
			coreSize = Math.min(450, Math.min(availableWidth * 0.7, availableHeight));
		}
	}

	function selectNen(index: number) {
		activeIndex = index;
		autoCycle = false;
		setTimeout(() => {
			autoCycle = true;
		}, 9000);
	}

	function startCycle() {
		cycleTimer = setInterval(() => {
			if (!autoCycle) return;
			activeIndex = (activeIndex + 1) % nenTypes.length;
		}, 5600);
	}

	onMount(() => {
		startCycle();
		updateCoreSize();
		window.addEventListener("resize", updateCoreSize);
	});

	onDestroy(() => {
		clearInterval(cycleTimer);
		if (typeof window !== "undefined") {
			window.removeEventListener("resize", updateCoreSize);
		}
	});
</script>

<svelte:head>
	<title>NenSpace — aura playground</title>
</svelte:head>

<main class="relative h-screen bg-slate-950 text-slate-50 overflow-hidden">
	<HalftoneBackground
		dotColor="rgba(255,255,255,0.08)"
		dotSize={1.2}
		spacing={14}
		gradientFrom={activeNen.gradient[0]}
		gradientTo={activeNen.gradient[1]}
		overlayOpacity={0.4}
	/>

		<div
		class="absolute inset-0 pointer-events-none"
		style={`background: radial-gradient(circle at 50% 20%, ${activeNen.accent}22, transparent 45%), radial-gradient(circle at 20% 80%, rgba(94,234,212,0.12), transparent 35%);`}
		></div>

	<section
		class="relative z-10 max-w-6xl mx-auto h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-2 sm:py-4 gap-2 sm:gap-3 md:gap-4 text-center overflow-hidden"
	>
		<div class="flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
			<h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold leading-tight px-2">
				My Nen Space
				</h1>
			<p 
				class="text-sm sm:text-base md:text-lg lg:text-xl font-semibold px-4"
				style={`background: linear-gradient(135deg, ${activeNen.accent}, ${activeNen.gradient[0]}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;`}
			>
				Coming soon
			</p>
		</div>

		<div class="relative w-full max-w-[85vw] sm:max-w-md md:max-w-lg lg:max-w-xl aspect-square flex-shrink-0 flex-grow-0">
			<div
				class="absolute inset-3 sm:inset-4 md:inset-6 rounded-full blur-3xl opacity-50"
				style={`background: radial-gradient(circle, ${activeNen.accent}55, transparent 70%);`}
			></div>
			<div class="relative w-full h-full">
				<ThreeNenCore type={activeNen.key} size={coreSize} />
			</div>
			<div class="absolute inset-0 rounded-full border border-white/5"></div>
							</div>

		<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4 w-full max-w-5xl px-4 flex-shrink-0">
			{#each nenTypes as nen, idx}
				<button
					class={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 ${
						activeIndex === idx
							? "bg-white/5"
							: "bg-white/0 opacity-60"
					}`}
					type="button"
					on:click={() => selectNen(idx)}
					style={`border-color: ${activeIndex === idx ? nen.accent : 'rgba(255,255,255,0.1)'};`}
				>
					<p class="text-[9px] sm:text-[10px] md:text-xs font-medium whitespace-nowrap">{nen.title}</p>
				</button>
				{/each}
			</div>

		<div class="flex items-center justify-center flex-shrink-0 px-4 mt-2">
			<a
				href="https://github.com/shashank-sharma/nenspace"
				target="_blank"
				rel="noopener noreferrer"
				class="text-[9px] sm:text-[10px] md:text-xs text-slate-400 hover:text-slate-300 transition-colors duration-200"
			>
				https://github.com/shashank-sharma/nenspace
			</a>
		</div>

	</section>
</main>
