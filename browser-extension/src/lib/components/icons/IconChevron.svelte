<script lang="ts">
  export let size = 20
  export let color = "currentColor"
  export let className = ""
  export let direction: "up" | "down" | "left" | "right" = "down"

  const rotations = {
    up: "180",
    down: "0",
    left: "90",
    right: "-90"
  }
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
  class={className}
  style="transform: rotate({rotations[direction]}deg)">
  <polyline points="6 9 12 15 18 9" />
</svg>
