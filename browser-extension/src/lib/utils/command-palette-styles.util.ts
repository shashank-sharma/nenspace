/**
 * Command Palette Component Styles
 * 
 * CRITICAL: All styles are injected via getStyle API into Shadow DOM ONLY
 * This prevents any CSS from leaking to the page
 */

export function getCommandPaletteStyles(): string {
  return `
    /* Command Palette Styles - Injected into Shadow DOM only */
    /* NOTE: Don't use :host for child elements - use direct selectors */
    
    /* CRITICAL: Base styles for Shadow DOM host */
    :host {
      display: block !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 16px !important;
      line-height: 1.5 !important;
      color: #ffffff !important;
      box-sizing: border-box !important;
    }
    
    /* Universal box-sizing for all elements inside shadow */
    *,
    *::before,
    *::after {
      box-sizing: border-box !important;
    }
    
    /* CRITICAL: Ensure input elements have base styling */
    input,
    input[type="text"],
    .search-input {
      display: block !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 20px !important;
      color: #ffffff !important;
      background: transparent !important;
      border: none !important;
      outline: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
    }
    
    .card {
      position: relative !important;
      background: hsl(222.2 84% 4.9%) !important;
      color: hsl(210 40% 98%) !important;
      border: 2px solid hsl(217.2 32.6% 17.5%) !important;
      overflow: visible !important;
    }

    .card::before {
      content: '' !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 16px !important;
      height: 16px !important;
      border-top: 2px solid hsl(210 40% 98%) !important;
      border-left: 2px solid hsl(210 40% 98%) !important;
      pointer-events: none !important;
      z-index: 30 !important;
    }

    .card::after {
      content: '' !important;
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      width: 16px !important;
      height: 16px !important;
      border-top: 2px solid hsl(210 40% 98%) !important;
      border-right: 2px solid hsl(210 40% 98%) !important;
      pointer-events: none !important;
      z-index: 30 !important;
    }

    .card-corner-bl {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 16px !important;
      height: 16px !important;
      border-bottom: 2px solid hsl(210 40% 98%) !important;
      border-left: 2px solid hsl(210 40% 98%) !important;
      pointer-events: none !important;
      z-index: 30 !important;
    }

    .card-corner-br {
      position: absolute !important;
      bottom: 0 !important;
      right: 0 !important;
      width: 16px !important;
      height: 16px !important;
      border-bottom: 2px solid hsl(210 40% 98%) !important;
      border-right: 2px solid hsl(210 40% 98%) !important;
      pointer-events: none !important;
      z-index: 30 !important;
    }

    .bg-grid-pattern {
      background-image: 
        linear-gradient(to right, rgba(155, 155, 155, 0.1) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(155, 155, 155, 0.1) 1px, transparent 1px) !important;
      background-size: 24px 24px !important;
      background-color: hsl(222.2 84% 4.9%) !important;
    }

    .command-palette,
    .command-palette * {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }

    .backdrop {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.7) !important;
      backdrop-filter: blur(4px) !important;
      z-index: 2147483646 !important;
      overflow: hidden !important;
    }

    .grid-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100vw;
      height: 100vh;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.25) 1px, transparent 1px);
      background-size: 24px 24px;
      background-position: center;
      mask-image: radial-gradient(
        ellipse 1000px 500px at center,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 0.95) 15%,
        rgba(255, 255, 255, 0.8) 30%,
        rgba(255, 255, 255, 0.5) 45%,
        rgba(255, 255, 255, 0.25) 60%,
        rgba(255, 255, 255, 0.1) 75%,
        rgba(255, 255, 255, 0) 90%
      );
      -webkit-mask-image: radial-gradient(
        ellipse 1000px 500px at center,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 0.95) 15%,
        rgba(255, 255, 255, 0.8) 30%,
        rgba(255, 255, 255, 0.5) 45%,
        rgba(255, 255, 255, 0.25) 60%,
        rgba(255, 255, 255, 0.1) 75%,
        rgba(255, 255, 255, 0) 90%
      );
      filter: blur(0.2px);
      box-shadow: 
        0 0 200px rgba(255, 255, 255, 0.25),
        0 0 350px rgba(255, 255, 255, 0.15),
        0 0 500px rgba(255, 255, 255, 0.08),
        0 0 700px rgba(255, 255, 255, 0.03),
        inset 0 0 250px rgba(255, 255, 255, 0.15),
        inset 0 0 400px rgba(255, 255, 255, 0.08);
      pointer-events: none;
      animation: nenspace-gridPulse 4s ease-in-out infinite;
      opacity: 0.8;
    }

    @keyframes nenspace-gridPulse {
      0%, 100% {
        opacity: 0.75;
        filter: blur(0.2px);
        box-shadow: 
          0 0 200px rgba(255, 255, 255, 0.22),
          0 0 350px rgba(255, 255, 255, 0.12),
          0 0 500px rgba(255, 255, 255, 0.06),
          0 0 700px rgba(255, 255, 255, 0.02),
          inset 0 0 250px rgba(255, 255, 255, 0.12),
          inset 0 0 400px rgba(255, 255, 255, 0.06);
      }
      50% {
        opacity: 0.9;
        filter: blur(0.15px);
        box-shadow: 
          0 0 250px rgba(255, 255, 255, 0.3),
          0 0 400px rgba(255, 255, 255, 0.18),
          0 0 600px rgba(255, 255, 255, 0.1),
          0 0 800px rgba(255, 255, 255, 0.04),
          inset 0 0 300px rgba(255, 255, 255, 0.18),
          inset 0 0 450px rgba(255, 255, 255, 0.1);
      }
    }

    .search-card {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 90% !important;
      max-width: 600px !important;
      z-index: 2147483647 !important;
      padding: 16px 16px 12px 16px !important;
      border-radius: 0 !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3) !important;
      pointer-events: auto !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      gap: 8px !important;
      background: hsl(222.2, 84%, 4.9%) !important;
      border: 2px solid hsl(217.2, 32.6%, 17.5%) !important;
      color: hsl(210, 40%, 98%) !important;
      min-height: 120px !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    }
    
    .search-card.card {
      background: hsl(222.2, 84%, 4.9%) !important;
      border-radius: 0 !important;
    }

    .search-line {
      position: relative !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 0 0 12px 0 !important;
      border-bottom: 2px solid hsl(210 40% 98% / 0.3) !important;
      background: transparent !important;
      transition: border-color 0.3s ease !important;
      margin: 0 0 4px 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .search-line:focus-within {
      border-bottom-color: hsl(210 40% 98% / 0.6) !important;
    }

    .search-line::after {
      display: none !important;
    }

    .search-icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
      background: transparent !important;
      color: hsl(210 40% 98%) !important;
    }

    .search-icon svg,
    .search-icon * {
      color: hsl(210 40% 98%) !important;
      stroke: hsl(210 40% 98%) !important;
      fill: none !important;
    }

    .search-input {
      display: block;
      flex: 1;
      border: none !important;
      background: transparent !important;
      color: hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      font-size: 20px !important;
      font-weight: 500 !important;
      outline: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-text-fill-color: hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      line-height: 1.5 !important;
      width: 100% !important;
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
    }

    .search-input:focus {
      background: transparent;
      box-shadow: none;
      color: hsl(var(--nenspace-foreground)) !important;
      -webkit-text-fill-color: hsl(var(--nenspace-foreground)) !important;
    }

    .search-input::placeholder {
      color: hsl(var(--nenspace-muted-foreground));
      font-weight: 400;
      opacity: 0.7;
    }

    .search-input:-webkit-autofill,
    .search-input:-webkit-autofill:hover,
    .search-input:-webkit-autofill:focus,
    .search-input:-webkit-autofill:active {
      box-shadow: 0 0 0 30px transparent inset !important;
      -webkit-box-shadow: 0 0 0 30px transparent inset !important;
      background-color: transparent !important;
      -webkit-text-fill-color: hsl(var(--nenspace-foreground)) !important;
      color: hsl(var(--nenspace-foreground)) !important;
    }

    .clear-btn {
      padding: 6px;
      border: none;
      background: transparent;
      color: hsl(var(--nenspace-muted-foreground));
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      opacity: 0.6;
    }

    .clear-btn:hover {
      opacity: 1;
      background: transparent;
      color: hsl(var(--nenspace-primary));
    }

    .hint-text {
      font-size: 10px;
      color: hsl(var(--nenspace-muted-foreground, 215 20.2% 65.1%));
      opacity: 0.6;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex-wrap: wrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      margin: 0;
      padding: 0;
    }

    .hint-text .separator {
      margin: 0 2px;
      opacity: 0.4;
    }

    .hint-text span:not(.separator) {
      font-size: 10px;
      opacity: 0.7;
    }

    .hint-text .key-icon {
      min-width: 20px;
      height: 20px;
      padding: 2px 6px;
      font-size: 10px;
      opacity: 0.8;
    }

    .results-card {
      position: fixed;
      top: calc(50% + 90px);
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 600px;
      max-height: 400px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
      z-index: 2147483647;
      border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
    }

    .results-card.mode-commands {
      border-color: hsl(var(--nenspace-primary) / 0.3);
    }

    .results-card.mode-tabs {
      border-color: hsl(var(--nenspace-secondary) / 0.3);
    }

    .commands-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .command-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      position: relative;
      margin-bottom: 4px;
    }

    .command-item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: transparent;
      border-radius: 0 6px 6px 0;
      transition: all 0.2s ease;
    }

    .command-item:hover {
      background: hsl(var(--nenspace-muted) / 0.4);
      transform: translateX(4px);
      outline: 1px solid hsl(var(--nenspace-border) / 0.5);
    }

    .command-item.selected {
      background: hsl(var(--nenspace-muted) / 0.5);
      transform: translateX(4px);
      outline: 2px solid hsl(var(--nenspace-primary) / 0.6);
      box-shadow: 0 0 0 1px hsl(var(--nenspace-primary) / 0.3);
    }

    .command-item.selected::before {
      background: hsl(var(--nenspace-primary));
      width: 4px;
    }

    .results-card.mode-tabs .command-item.selected {
      outline: 2px solid hsl(var(--nenspace-secondary) / 0.6);
      box-shadow: 0 0 0 1px hsl(var(--nenspace-secondary) / 0.3);
    }

    .results-card.mode-tabs .command-item.selected::before {
      background: hsl(var(--nenspace-secondary));
      width: 4px;
    }

    .command-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: hsl(var(--nenspace-muted) / 0.2);
      border-radius: 8px;
      transition: all 0.2s ease;
      color: hsl(var(--nenspace-foreground));
    }

    .command-item:hover .command-icon,
    .command-item.selected .command-icon {
      transform: scale(1.1);
      background: hsl(var(--nenspace-muted) / 0.4);
    }

    .command-info {
      flex: 1;
      min-width: 0;
    }

    .command-label {
      font-size: 16px;
      font-weight: 600;
      color: hsl(var(--nenspace-foreground));
      margin-bottom: 4px;
      line-height: 1.25;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .command-description {
      font-size: 14px;
      color: hsl(var(--nenspace-muted-foreground));
      line-height: 1.375;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .command-shortcut {
      font-size: 12px;
      font-weight: 600;
      color: hsl(var(--nenspace-foreground));
      background: hsl(var(--nenspace-muted) / 0.3);
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid hsl(var(--nenspace-border) / 0.5);
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 20px;
      text-align: center;
      color: hsl(var(--nenspace-muted-foreground));
    }

    .empty-state p {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 500;
      color: hsl(var(--nenspace-foreground));
    }

    .empty-state small {
      font-size: 14px;
      opacity: 0.7;
    }

    .commands-list::-webkit-scrollbar {
      width: 8px;
    }

    .commands-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .commands-list::-webkit-scrollbar-thumb {
      background: hsl(var(--nenspace-border) / 0.5);
      border-radius: 4px;
    }

    .commands-list::-webkit-scrollbar-thumb:hover {
      background: hsl(var(--nenspace-border) / 0.7);
    }

    .status-bar-card {
      position: fixed !important;
      bottom: 16px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 90% !important;
      max-width: 600px !important;
      z-index: 2147483647 !important;
      padding: 10px 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      background: hsl(222.2, 84%, 4.9%) !important;
      border: 2px solid hsl(217.2, 32.6%, 17.5%) !important;
      border-radius: 0 !important;
      box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.3), 0 -2px 4px -2px rgba(0, 0, 0, 0.3) !important;
      min-height: auto !important;
      height: auto !important;
    }

    .status-bar-corner-tl {
      position: absolute;
      top: 0;
      left: 0;
      width: 16px;
      height: 16px;
      border-top: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      border-left: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      pointer-events: none;
      z-index: 30;
    }

    .status-bar-corner-tr {
      position: absolute;
      top: 0;
      right: 0;
      width: 16px;
      height: 16px;
      border-top: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      border-right: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      pointer-events: none;
      z-index: 30;
    }

    .status-bar-corner-bl {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 16px;
      height: 16px;
      border-bottom: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      border-left: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      pointer-events: none;
      z-index: 30;
    }

    .status-bar-corner-br {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      border-bottom: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      border-right: 2px solid hsl(var(--nenspace-foreground, 210 40% 98%)) !important;
      pointer-events: none;
      z-index: 30;
    }

    .status-bar-card .mode-indicator {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 16px !important;
      background: hsl(var(--nenspace-muted, 217.2 32.6% 17.5%) / 0.3) !important;
      border-radius: 0 !important;
      border: 1px solid hsl(var(--nenspace-border, 217.2 32.6% 17.5%) / 0.5) !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      backdrop-filter: blur(24px) !important;
      transition: all 0.3s ease !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }

    .mode-indicator.mode-commands {
      border-color: hsl(var(--nenspace-primary, 5 100% 69%) / 0.5) !important;
      color: hsl(var(--nenspace-primary, 5 100% 69%)) !important;
      background: hsl(var(--nenspace-primary, 5 100% 69%) / 0.15) !important;
      box-shadow: none !important;
    }

    .mode-indicator.mode-tabs {
      border-color: hsl(var(--nenspace-secondary, 217.2 32.6% 17.5%) / 0.5) !important;
      color: hsl(var(--nenspace-secondary-foreground, 210 40% 98%)) !important;
      background: hsl(var(--nenspace-secondary, 217.2 32.6% 17.5%) / 0.3) !important;
      box-shadow: none !important;
    }

    .mode-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .mode-commands .mode-dot {
      background: hsl(var(--nenspace-primary, 5 100% 69%)) !important;
      box-shadow: none !important;
    }

    .mode-tabs .mode-dot {
      background: hsl(var(--nenspace-secondary-foreground, 210 40% 98%)) !important;
      box-shadow: none !important;
    }

    .mode-label {
      color: hsl(var(--nenspace-foreground));
      font-weight: 600;
    }

    .mode-count {
      color: hsl(var(--nenspace-muted-foreground));
      font-size: 11px;
    }

    .tab-favicon {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .tab-favicon-placeholder {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .tab-item .command-description {
      font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .results-card.mode-commands .command-item.selected::before {
      background: hsl(var(--nenspace-primary));
    }

    .results-card.mode-tabs .command-item.selected::before {
      background: hsl(var(--nenspace-secondary));
    }

    .command-label .match,
    .command-description .match {
      color: hsl(var(--nenspace-primary));
      font-weight: 700;
      background: hsl(var(--nenspace-primary) / 0.3);
      padding: 2px 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      text-decoration: underline;
      text-decoration-color: hsl(var(--nenspace-primary) / 0.5);
      text-underline-offset: 2px;
    }

    .results-card.mode-tabs .command-label .match,
    .results-card.mode-tabs .command-description .match {
      color: hsl(var(--nenspace-secondary-foreground));
      background: hsl(var(--nenspace-secondary) / 0.4);
      text-decoration-color: hsl(var(--nenspace-secondary) / 0.6);
    }

    .command-item:hover .match {
      background: hsl(var(--nenspace-primary) / 0.5);
      color: hsl(var(--nenspace-primary-foreground, 210 40% 98%));
      text-decoration-color: hsl(var(--nenspace-primary));
      box-shadow: 0 0 8px hsl(var(--nenspace-primary) / 0.4);
    }

    .command-item.selected .match {
      background: hsl(var(--nenspace-primary) / 0.6);
      color: hsl(var(--nenspace-primary-foreground, 210 40% 98%));
      text-decoration-color: hsl(var(--nenspace-primary));
      box-shadow: 0 0 12px hsl(var(--nenspace-primary) / 0.5);
      transform: scale(1.02);
    }

    .results-card.mode-tabs .command-item:hover .match {
      background: hsl(var(--nenspace-secondary) / 0.5);
      color: hsl(var(--nenspace-secondary-foreground));
      text-decoration-color: hsl(var(--nenspace-secondary));
      box-shadow: 0 0 8px hsl(var(--nenspace-secondary) / 0.4);
    }

    .results-card.mode-tabs .command-item.selected .match {
      background: hsl(var(--nenspace-secondary) / 0.6);
      color: hsl(var(--nenspace-secondary-foreground));
      text-decoration-color: hsl(var(--nenspace-secondary));
      box-shadow: 0 0 12px hsl(var(--nenspace-secondary) / 0.5);
      transform: scale(1.02);
    }
  `
}

