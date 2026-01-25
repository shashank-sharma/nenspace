<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		placeholder,
		class: className,
		...restProps
	}: {
		placeholder?: string;
		class?: string;
	} = $props();
</script>

<!-- 
	Note: According to Bits UI migration guide, Select.Value was removed in v1.
	However, bits-ui 2.14.4 may still have it for backward compatibility.
	If this causes errors, we'll need to implement a manual solution that
	accesses the Select's value through context or props.
-->
<SelectPrimitive.Value
	data-slot="select-value"
	{placeholder}
	class={cn("", className)}
	{...restProps}
/>
