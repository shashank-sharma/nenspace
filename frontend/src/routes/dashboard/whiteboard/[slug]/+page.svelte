<script lang="ts">
	import { WhiteboardFeature } from "$lib/features/whiteboard";
</script>

<div class="whiteboard-page">
	<WhiteboardFeature />
</div>

<style>
	:global(main) {
		overflow: hidden !important;
		height: 100% !important;
		padding: 0 !important;
	}

	.whiteboard-page {
		width: 100%;
		height: 100%;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		overflow: hidden;
		position: relative;
	}
</style>

