<script lang="ts">
	export let dotColor = "rgba(255, 255, 255, 0.08)";
	export let dotSize = 1.4;
	export let spacing = 14;
	export let gradientFrom = "rgba(94, 234, 212, 0.25)";
	export let gradientTo = "rgba(59, 130, 246, 0.25)";
	export let overlayOpacity = 0.35;
</script>

<div
	class="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
	style={`--dot-color:${dotColor}; --dot-size:${dotSize}px; --dot-spacing:${spacing}px; --grad-from:${gradientFrom}; --grad-to:${gradientTo}; --overlay-opacity:${overlayOpacity};`}
>
	<div class="absolute inset-0 opacity-[var(--overlay-opacity)] halftone-pattern"></div>
	<div
		class="absolute inset-0 mix-blend-screen"
		style="
			background:
				radial-gradient(circle at 20% 20%, var(--grad-from), transparent 40%),
				radial-gradient(circle at 80% 30%, var(--grad-to), transparent 38%),
				radial-gradient(circle at 30% 80%, color-mix(in srgb, var(--grad-from) 60%, transparent), transparent 50%),
				linear-gradient(135deg, rgba(10, 12, 22, 0.95), rgba(4, 7, 15, 0.92));
		"
	></div>
</div>

<style>
	.halftone-pattern {
		background-image:
			radial-gradient(circle at center, var(--dot-color) 0, var(--dot-color) calc(var(--dot-size)), transparent calc(var(--dot-size))),
			radial-gradient(circle at center, var(--dot-color) 0, var(--dot-color) calc(var(--dot-size)), transparent calc(var(--dot-size)));
		background-position: 0 0, calc(var(--dot-spacing) / 2) calc(var(--dot-spacing) / 2);
		background-size: var(--dot-spacing) var(--dot-spacing);
		filter: blur(0.3px);
	}
</style>

