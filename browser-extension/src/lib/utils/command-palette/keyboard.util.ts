export function createEscapeHandler(
  onClose: () => void
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      const paletteVisible = 
        document.querySelector('.command-palette') !== null ||
        document.querySelector('[data-modal="command-palette"]') !== null

      if (paletteVisible) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
  }
}

