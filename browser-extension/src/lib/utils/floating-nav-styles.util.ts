/**
 * Floating Nav Styles for Shadow DOM
 * 
 * CRITICAL: All styles are injected via getStyle API into Shadow DOM ONLY.
 * This prevents CSS from leaking to the page.
 * 
 * All selectors are prefixed with :host to scope them to the Shadow DOM.
 */

export function getFloatingNavStyles(): string {
  return `
    .floating-nav-wrapper {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
    }

    .trigger-zone {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 180px;
      height: 40px;
      cursor: pointer;
      z-index: 2147483646;
      pointer-events: auto;
      transition: opacity 0.2s ease;
    }

    .trigger-zone:hover {
      background: linear-gradient(to top, rgba(99, 102, 241, 0.08), transparent);
    }

    .trigger-zone:focus {
      outline: 2px solid rgba(99, 102, 241, 0.4);
      outline-offset: -2px;
    }

    .card {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(16px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    }

    .pill {
      padding: 10px 16px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .pill:hover {
      transform: translateY(-2px);
    }

    .pill svg {
      animation: nenspace-bounce 2s infinite;
    }

    @keyframes nenspace-bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-3px);
      }
    }

    .card.expanded {
      min-width: 300px;
      padding: 20px;
    }

    .card-body {
      position: relative;
    }

    .close-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
      transform: rotate(90deg);
    }

    .auth-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 8px 0;
    }

    .auth-text {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
    }

    .btn-login {
      padding: 10px 28px;
      border: none;
      background: linear-gradient(135deg, var(--nenspace-accent-primary, #e88b8b) 0%, var(--nenspace-accent-secondary, #b4c96c) 100%);
      color: var(--nenspace-text-primary, #ffffff);
      font-size: 14px;
      font-weight: 600;
      border-radius: var(--nenspace-radius, 0.5rem);
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    }

    .btn-login:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .nav {
      display: flex;
      gap: 10px;
      align-items: stretch;
      justify-content: center;
    }

    .btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 14px 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      color: #374151;
      font-size: 11px;
      font-weight: 600;
      min-width: 72px;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border-color: var(--nenspace-accent-primary, #e88b8b);
    }

    .btn-accent {
      background: linear-gradient(135deg, var(--nenspace-accent-primary, #e88b8b) 0%, var(--nenspace-accent-secondary, #b4c96c) 100%);
      border-color: transparent;
      color: var(--nenspace-text-primary, #ffffff);
      padding: 16px 18px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    }

    .btn-accent:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    @media (prefers-color-scheme: dark) {
      .card {
        background: rgba(30, 30, 30, 0.98);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      .close-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #9ca3af;
      }

      .close-btn:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
      }

      .auth-text {
        color: #9ca3af;
      }

      .btn {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
        color: #e5e7eb;
      }

      .btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    }
  `
}

