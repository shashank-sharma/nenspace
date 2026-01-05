<script lang="ts">
  import { workspaceStore } from '../../stores'

  let isDragging = $state(false)
  let startX = 0
  let startY = 0

  function handleMouseDown(e: MouseEvent) {
    isDragging = true
    startX = e.clientX
    startY = e.clientY
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY
  }

  function handleMouseUp() {
    isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
</script>

<div
  class="pane-splitter w-1 bg-border hover:bg-primary/50 cursor-col-resize"
  on:mousedown={handleMouseDown}
  role="separator"
></div>

