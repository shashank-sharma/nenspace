import { getContext, setContext } from "svelte";

export interface LanguageModelUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	cachedTokens?: number;
	reasoningTokens?: number;
}

export interface ContextState {
	usedTokens: number;
	maxTokens: number;
	usage?: LanguageModelUsage;
	modelId?: string;
}

const CONTEXT_KEY = Symbol("context");

export function setContextState(state: ContextState) {
	setContext(CONTEXT_KEY, state);
	return state;
}

export function getContextState(): ContextState {
	return getContext<ContextState>(CONTEXT_KEY);
}
