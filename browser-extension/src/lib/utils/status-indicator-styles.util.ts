/**
 * Status Indicator Styles for Shadow DOM
 * 
 * These styles are injected via getStyle API into Shadow DOM ONLY.
 * This prevents CSS from leaking to the page.
 * 
 * NOTE: Most styling is now done via inline styles in the component
 * using the island-styles.config.ts. This file only contains:
 * - Essential base styles
 * - Animation keyframes
 * - SVG normalization
 */

import { ISLAND_TYPOGRAPHY } from '../config/island-styles.config'

export function getStatusIndicatorStyles(): string {
  return `
    /* =======================================================================
       BASE STYLES
       ======================================================================= */
    
    .island-container {
      font-family: ${ISLAND_TYPOGRAPHY.FONT_FAMILY};
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    
    .island-container *,
    .island-container *::before,
    .island-container *::after {
      box-sizing: border-box;
    }

    /* =======================================================================
       SVG NORMALIZATION
       Ensures icons render correctly regardless of page styles
       ======================================================================= */
    
    .island-container svg {
      display: block;
      width: auto;
      height: auto;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      color: inherit;
      margin: 0;
      padding: 0;
      border: none;
    }

    /* =======================================================================
       ANIMATIONS
       ======================================================================= */
    
    .nenspace-animate-spin {
      animation: nenspace-spin 1s linear infinite;
    }

    @keyframes nenspace-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .nenspace-island-shimmer {
      animation: nenspace-shimmer 2s infinite linear;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.1),
        transparent
      );
      background-size: 200% 100%;
    }

    @keyframes nenspace-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* =======================================================================
       LEGACY CONTENT TYPE STYLES
       For image, chart, and component content types
       ======================================================================= */
    
    .nenspace-island-image-content,
    .nenspace-island-chart-content,
    .nenspace-island-component-content {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    .nenspace-island-image-content {
      padding: 0.5rem;
    }

    .nenspace-island-chart-content {
      padding: 1rem;
    }

    .nenspace-island-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 0.25rem;
    }

    .nenspace-island-chart-inner {
      text-align: center;
    }

    .nenspace-island-chart-title {
      font-size: 0.75rem;
      color: #d1d5db;
      margin-bottom: 0.5rem;
    }

    .nenspace-island-chart-placeholder,
    .nenspace-island-component-placeholder {
      font-size: 0.75rem;
      color: #9ca3af;
    }
  `
}
