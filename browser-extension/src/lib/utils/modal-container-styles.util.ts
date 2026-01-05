/**
 * Modal Container Styles for Shadow DOM
 * 
 * CRITICAL: All styles are injected via getStyle API into Shadow DOM ONLY.
 * This prevents CSS from leaking to the page.
 * 
 * NOTE: Don't use :host for child elements - use direct selectors.
 * :host only targets the shadow host element itself.
 */

export function getModalContainerStyles(): string {
  return `
    .modal-error {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      padding: 16px 20px !important;
      background: #e88b8b !important;
      color: #1e2124 !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
      max-width: 300px !important;
    }

    .modal-error p {
      margin: 0 !important;
      font-size: 14px !important;
      font-weight: 500 !important;
    }

    .modal-error button {
      align-self: flex-end !important;
      padding: 6px 16px !important;
      background: #1e2124 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 6px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: opacity 0.2s !important;
    }

    .modal-error button:hover {
      opacity: 0.9 !important;
    }
  `
}

