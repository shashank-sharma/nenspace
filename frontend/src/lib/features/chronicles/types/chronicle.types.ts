/**
 * Types for Chronicle features
 */

/**
 * Represents the four seasons that can be displayed in the background
 */
export type Season = "Winter" | "Spring" | "Summer" | "Autumn";

/**
 * Represents the various weather conditions that can be applied to the background
 */
export type Weather = 
  | "sunny" 
  | "partly-cloudy" 
  | "cloudy" 
  | "rainy" 
  | "stormy" 
  | "aurora" 
  | "stardust";

/**
 * Configuration for a Chronicle background
 */
export interface ChronicleBackgroundConfig {
  /** The initial season to display */
  startingSeason: Season;
  /** Whether to show season control buttons */
  enableControls: boolean;
  /** CSS height value */
  height: string;
  /** CSS width value */
  width: string;
  /** The weather condition to display */
  weather: Weather;
} 