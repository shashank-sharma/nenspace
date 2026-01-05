<script lang="ts">
  export let size = 20
  export let color = "currentColor"
  export let className = ""
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}>
  <circle cx="12" cy="12" r="3" />
  <path
    d="M12 1v6m0 6v6M6.697 3.868l4.244 4.244M13.059 13.059l4.244 4.244M1 12h6m6 0h6M3.868 17.303l4.244-4.244M13.059 10.941l4.244-4.244" />
</svg>
