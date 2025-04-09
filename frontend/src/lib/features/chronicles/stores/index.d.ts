import type { Writable } from 'svelte/store';
import type { ChronicleState, JournalEntry } from '../types';

export interface ChronicleStore extends Writable<ChronicleState> {
  reset(): void;
  setStep(step: number): void;
  nextStep(): void;
  prevStep(): void;
  setViewMode(mode: 'edit' | 'preview' | 'markdown'): void;
  loadEntry(date: Date): Promise<void>;
  createEmptyEntry(): void;
  updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]): void;
  saveEntry(entry: JournalEntry): Promise<void>;
}

export declare const chroniclesStore: ChronicleStore; 