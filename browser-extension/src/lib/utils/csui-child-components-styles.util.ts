/**
 * CSUI Child Component Styles for Shadow DOM
 * 
 * CRITICAL: All styles are injected via getStyle API into Shadow DOM ONLY.
 * This prevents CSS from leaking to the page.
 * 
 * All selectors are prefixed with :host to scope them to the Shadow DOM.
 * 
 * This file consolidates styles from ALL child components used in CSUI:
 * - FloatingModal.svelte
 * - HelpDialog.svelte
 * - TimerDisplay.svelte
 * - ErrorBoundary.svelte
 * - SettingsPanel.svelte
 * - And other shared components
 */

export function getFloatingModalStyles(): string {
  return `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--nenspace-overlay-bg, rgba(0, 0, 0, 0.7));
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      padding: 20px;
    }

    .modal-card {
      background: var(--nenspace-background, #1e2124);
      border-radius: 8px;
      box-shadow:
        0 0 0 1px var(--nenspace-border, rgba(255, 255, 255, 0.1)),
        0 20px 60px rgba(0, 0, 0, 0.5);
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .modal-accent {
      display: none;
    }

    .modal-small {
      width: 100%;
      max-width: 450px;
    }

    .modal-medium {
      width: 100%;
      max-width: 650px;
    }

    .modal-large {
      width: 100%;
      max-width: 900px;
    }

    .modal-card.positioned {
      position: absolute;
      top: var(--position-y, 50%);
      left: var(--position-x, 50%);
      transform: translate(-50%, -50%);
      animation: none;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 28px;
      border-bottom: 1px solid var(--nenspace-divider, rgba(255, 255, 255, 0.08));
      background: linear-gradient(
        180deg,
        var(--nenspace-card-background, #2a2d31) 0%,
        transparent 100%
      );
    }

    .title-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title-decoration {
      width: 4px;
      height: 24px;
      background: linear-gradient(
        180deg,
        var(--nenspace-accent-primary, #e88b8b),
        var(--nenspace-accent-secondary, #b4c96c)
      );
      border-radius: 2px;
    }

    .modal-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--nenspace-text-primary, #ffffff);
      letter-spacing: -0.3px;
    }

    .modal-close-btn,
    .modal-header .close-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--nenspace-text-secondary, #e5e7eb);
      transition: all 0.2s;
      border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    }

    .modal-close-btn:hover,
    .modal-header .close-btn:hover {
      background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--nenspace-accent-primary, #e88b8b);
      transform: rotate(90deg);
      border-color: var(--nenspace-accent-primary, #e88b8b);
    }

    .modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px;
      position: relative;
    }

    .modal-content::-webkit-scrollbar {
      width: 8px;
    }

    .modal-content::-webkit-scrollbar-track {
      background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
      border-radius: 4px;
      margin: 4px;
    }

    .modal-content::-webkit-scrollbar-thumb {
      background: linear-gradient(
        180deg,
        var(--nenspace-accent-primary, #e88b8b),
        var(--nenspace-accent-secondary, #b4c96c)
      );
      border-radius: 4px;
    }

    .modal-content::-webkit-scrollbar-thumb:hover {
      background: var(--nenspace-accent-primary, #e88b8b);
    }

    .modal-footer-accent {
      display: none;
    }
  `
}

export function getHelpDialogStyles(): string {
  return `
    .backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 2147483646;
    }

    .help-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      background: var(--nenspace-card-background, #1a1a1a);
      border-radius: 16px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .help-dialog .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 32px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .help-dialog .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: var(--nenspace-text-primary, #ffffff);
    }

    .vim {
      color: var(--nenspace-accent-primary, #3b82f6);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .help-dialog .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: var(--nenspace-text-muted, #9ca3af);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s;
    }

    .help-dialog .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: var(--nenspace-text-primary, #ffffff);
    }

    .search-container {
      padding: 16px 32px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .search-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: var(--nenspace-text-primary, #ffffff);
      font-size: 16px;
      outline: none;
      transition: all 0.2s;
    }

    .search-input:focus {
      border-color: var(--nenspace-accent-primary, #3b82f6);
      background: rgba(255, 255, 255, 0.08);
    }

    .search-input::placeholder {
      color: var(--nenspace-text-muted, #9ca3af);
    }

    .help-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 32px;
    }

    .help-section {
      margin-bottom: 32px;
      opacity: 0.7;
      transition: all 0.2s;
    }

    .help-section.selected {
      opacity: 1;
    }

    .help-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
    }

    .commands-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .command-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      transition: all 0.2s;
    }

    .command-row:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .command-keys {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .key {
      display: inline-block;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
      font-size: 12px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
      min-width: 24px;
      text-align: center;
    }

    .command-description {
      color: var(--nenspace-text-secondary, #d1d5db);
      font-size: 14px;
      line-height: 1.4;
    }

    .help-dialog .footer {
      padding: 16px 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
    }

    .footer-info {
      text-align: center;
    }

    .footer-info p {
      margin: 0;
      font-size: 12px;
      color: var(--nenspace-text-muted, #9ca3af);
    }

    .footer-info kbd {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
      font-size: 10px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
      margin: 0 2px;
    }

    .help-content::-webkit-scrollbar {
      width: 8px;
    }

    .help-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .help-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }

    .help-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `
}

export function getTimerDisplayStyles(): string {
  return `
    .timer-display {
      display: flex !important;
      align-items: center !important;
      height: 100% !important;
      width: fit-content !important;
      min-width: fit-content !important;
      padding: 0 0.75rem !important;
      flex-shrink: 0 !important;
    }

    .timer-content {
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      width: fit-content !important;
      min-width: fit-content !important;
      flex-shrink: 0 !important;
    }

    .timer-icon-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
      transition: all 0.2s ease;
    }

    .timer-icon-button:hover {
      background: rgba(239, 68, 68, 0.2);
      border: 2px solid #ef4444;
    }

    .timer-icon-button:active {
      transform: scale(0.95);
    }

    .timer-text {
      display: flex;
      flex-direction: column;
      width: fit-content;
      min-width: fit-content;
    }

    .timer-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .timer-time {
      font-size: 0.875rem;
      font-weight: 600;
      color: white;
      white-space: nowrap;
      line-height: 1.4;
      font-variant-numeric: tabular-nums;
    }

    .stop-button-inner {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: #ef4444;
    }
  `
}

export function getErrorBoundaryStyles(): string {
  return `
    .error-boundary-fallback {
      min-height: 40px;
    }
  `
}

export function getSettingsPanelStyles(): string {
  return `
    .settings-panel-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .settings-card {
      position: relative;
      width: 100%;
      max-width: 600px;
      max-height: 85vh;
      background: var(--nenspace-card-background, #1e2124);
      border: 2px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
      border-radius: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .card-corner-bl,
    .card-corner-br {
      position: absolute;
      bottom: 0;
      width: 16px;
      height: 16px;
      border-bottom: 2px solid var(--nenspace-text-primary, #ffffff);
      pointer-events: none;
      z-index: 10;
    }

    .card-corner-bl {
      left: 0;
      border-left: 2px solid var(--nenspace-text-primary, #ffffff);
    }

    .card-corner-br {
      right: 0;
      border-right: 2px solid var(--nenspace-text-primary, #ffffff);
    }

    .close-button {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border: none;
      background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--nenspace-text-primary, #ffffff);
      transition: all 0.2s;
      border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
      z-index: 20;
    }

    .close-button:hover {
      background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--nenspace-accent-primary, #e88b8b);
      transform: rotate(90deg);
      border-color: var(--nenspace-accent-primary, #e88b8b);
    }

    /* Settings panel content styles */
    .settings-header {
      padding: 24px 28px;
      border-bottom: 1px solid var(--nenspace-divider, rgba(255, 255, 255, 0.08));
    }

    .settings-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--nenspace-text-primary, #ffffff);
    }

    .settings-content {
      padding: 24px 28px;
    }

    .settings-section {
      margin-bottom: 24px;
    }

    .settings-section:last-child {
      margin-bottom: 0;
    }

    .settings-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
      margin-bottom: 8px;
    }

    .settings-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
      border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
      border-radius: 8px;
      color: var(--nenspace-text-primary, #ffffff);
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
    }

    .settings-input:focus {
      border-color: var(--nenspace-accent-primary, #e88b8b);
      background: rgba(255, 255, 255, 0.08);
    }

    .settings-input::placeholder {
      color: var(--nenspace-text-muted, #9ca3af);
    }

    .settings-btn {
      padding: 12px 24px;
      background: var(--nenspace-accent-primary, #e88b8b);
      color: var(--nenspace-text-primary, #ffffff);
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .settings-btn:hover {
      opacity: 0.9;
    }

    .settings-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `
}

export function getTasksPanelStyles(): string {
  return `
    .tasks-panel {
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }

    .tasks-panel .header {
      margin-bottom: 24px;
    }

    .tasks-panel .header h2 {
      font-size: 24px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
      margin: 0 0 8px 0;
    }

    .tasks-panel .subtitle {
      font-size: 14px;
      color: var(--nenspace-text-muted, #9ca3af);
      margin: 0;
    }

    .legend {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
      border-radius: 8px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--nenspace-text-secondary, #e5e7eb);
    }

    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .indicator.backend {
      background: var(--nenspace-accent-primary, #e88b8b);
    }

    .indicator.frontend {
      background: var(--nenspace-accent-secondary, #b4c96c);
    }

    .indicator.in-progress {
      background: var(--nenspace-accent-tertiary, #d4a35a);
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding-top: 20px;
      border-top: 1px solid var(--nenspace-divider, rgba(255, 255, 255, 0.08));
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 16px;
      background: var(--nenspace-card-background, #2a2d31);
      border-radius: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: var(--nenspace-text-primary, #ffffff);
    }

    .stat-label {
      font-size: 12px;
      color: var(--nenspace-text-muted, #9ca3af);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `
}

export function getTaskCardStyles(): string {
  return `
    .task-card {
      background: var(--nenspace-card-background, #2a2d31);
      border-radius: var(--nenspace-radius, 10px);
      padding: 16px 20px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .task-card.in-progress {
      background: var(--nenspace-accent-tertiary, #d4a35a);
    }

    .task-card.in-progress .deadline,
    .task-card.in-progress .task-title {
      color: #1e2124;
    }

    .checkbox-container {
      flex-shrink: 0;
      padding-top: 2px;
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid var(--nenspace-border, rgba(255, 255, 255, 0.3));
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .checkbox.checked {
      background: var(--nenspace-accent-secondary, #b4c96c);
      border-color: var(--nenspace-accent-secondary, #b4c96c);
    }

    .task-card .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .deadline {
      font-size: 12px;
      color: var(--nenspace-text-muted, #888888);
      font-weight: 500;
      letter-spacing: 0.3px;
    }

    .task-title {
      font-size: 15px;
      color: var(--nenspace-text-primary, #ffffff);
      line-height: 1.4;
      font-weight: 400;
    }

    .task-title.completed-text {
      text-decoration: line-through;
      opacity: 0.6;
    }

    .category-indicator {
      position: absolute;
      top: 0;
      right: 0;
      width: 40px;
      height: 4px;
      border-radius: 0 0 4px 4px;
    }

    .category-indicator.backend {
      background: var(--nenspace-accent-primary, #e88b8b);
    }

    .category-indicator.frontend {
      background: var(--nenspace-accent-secondary, #b4c96c);
    }
  `
}

/**
 * Get all child component styles consolidated
 * This should be included in getStyle API for modal-container.tsx
 */
export function getAllChildComponentStyles(): string {
  return [
    getFloatingModalStyles(),
    getHelpDialogStyles(),
    getTimerDisplayStyles(),
    getErrorBoundaryStyles(),
    getSettingsPanelStyles(),
    getTasksPanelStyles(),
    getTaskCardStyles()
  ].join('\n')
}

