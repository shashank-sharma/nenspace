<script lang="ts">
	import { File, FileText, Image as ImageIcon, X, Download, ExternalLink } from "lucide-svelte";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { cn } from "$lib/utils";
	import { onMount } from "svelte";

	type Props = {
		name: string;
		type: string;
		size: number;
		url?: string;
		onRemove?: () => void;
		class?: string;
	};

	let { name, type, size, url, onRemove, class: className }: Props = $props();

	const formattedSize = $derived(() => {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	});

	const fileIcon = $derived(() => {
		if (type.startsWith("image/")) return ImageIcon;
		if (type.startsWith("text/") || type.includes("pdf")) return FileText;
		return File;
	});

	const isImage = $derived(type.startsWith("image/"));
	const showPreview = $derived(isImage && url);

	function handleDownload() {
		if (url) {
			const link = document.createElement('a');
			link.href = url;
			link.download = name;
			link.target = '_blank';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	function handleView() {
		if (url) {
			window.open(url, '_blank');
		}
	}
</script>

<div class={cn("flex flex-col gap-2", className)}>
	{#if showPreview && url}
		<div class="relative rounded-lg border border-border overflow-hidden bg-muted/50">
			<img
				src={url}
				alt={name}
				class="w-full h-auto max-h-64 object-contain"
				loading="lazy"
			/>
			<div class="absolute top-2 right-2 flex gap-1">
				<Button
					variant="secondary"
					size="icon"
					class="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
					onclick={handleView}
					title="View full size"
				>
					<ExternalLink size={14} />
				</Button>
				{#if url.startsWith('http') || url.startsWith('data:')}
					<Button
						variant="secondary"
						size="icon"
						class="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background"
						onclick={handleDownload}
						title="Download"
					>
						<Download size={14} />
					</Button>
				{/if}
			</div>
		</div>
	{/if}
	
	<Badge variant="secondary" class={cn("gap-2 pr-1 w-fit", showPreview && "mt-1")}>
		<svelte:component this={fileIcon()} size={14} />
		<div class="flex flex-col items-start">
			<span class="text-xs font-medium truncate max-w-[150px]" title={name}>{name}</span>
			<span class="text-[10px] text-muted-foreground">{formattedSize()}</span>
		</div>
		{#if !showPreview && url}
			<Button
				variant="ghost"
				size="icon"
				class="h-4 w-4 p-0"
				onclick={handleView}
				title="View file"
			>
				<ExternalLink size={12} />
			</Button>
		{/if}
		{#if onRemove}
			<Button variant="ghost" size="icon" class="h-4 w-4 p-0" onclick={onRemove} title="Remove">
				<X size={12} />
			</Button>
		{/if}
	</Badge>
</div>
