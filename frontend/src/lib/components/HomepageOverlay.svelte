<script lang="ts">
	import { goto } from "$app/navigation";
	import { Button } from "$lib/components/ui/button";
	
	// Version is injected by Vite at build time from package.json
	const version = __APP_VERSION__;
</script>

<div class="flex flex-col justify-between w-full h-full p-6 md:p-12 text-white overflow-hidden">
	<!-- Header -->
	<header class="flex items-start justify-between w-full">
		<div class="flex flex-col gap-1 pointer-events-auto cursor-pointer group">
			<div class="flex items-center gap-3">
				<div class="relative w-14 h-14 flex items-center justify-center">
					<img
						src="/nenspace-logo.png"
						alt="Nenspace Logo"
						class="w-full h-full object-contain"
					/>
				</div>
				<div class="flex flex-col">
					<span class="font-mono text-sm tracking-[0.2em] text-white group-hover:text-cyan-200 transition-colors"
						>NENSPACE</span
					>
					<span class="text-[10px] font-mono text-white/40 tracking-widest uppercase">v{version}</span>
				</div>
			</div>
		</div>

		<div class="hidden md:flex flex-col items-end gap-2 pointer-events-auto">
			<div class="px-3 py-1 rounded-full border border-white/10 bg-black/20 backdrop-blur-md text-[10px] font-mono text-white/50">
				FPS: 60 // GPU: ACTIVE
			</div>
		</div>
	</header>

	<footer class="w-full flex flex-col md:flex-row items-end justify-between gap-8 pointer-events-none">
		<div class="flex flex-col gap-4 max-w-sm pointer-events-auto">
			<h2 class="text-4xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">
				Nenspace
			</h2>
			<p class="text-sm text-white/60 leading-relaxed border-l border-white/20 pl-4">
				Own your data. Control your digital life. Generate insights from what you create.
				A personal dashboard for complete data sovereignty and intelligent self-reflection.
			</p>
			<div class="mt-2">
				<Button
					variant="default"
					size="lg"
					on:click={() => goto("/dashboard")}
					class="pointer-events-auto"
				>
					Go to Dashboard
				</Button>
			</div>
		</div>
	</footer>
</div>
