import { getContext, setContext } from "svelte";

export interface InlineCitationSource {
	title: string;
	url: string;
	description?: string;
	quote?: string;
}

export interface InlineCitationState {
	sources: string[];
}

const INLINE_CITATION_KEY = Symbol("inline-citation");

export function setInlineCitationState(state: InlineCitationState) {
	setContext(INLINE_CITATION_KEY, state);
}

export function getInlineCitationState(): InlineCitationState {
	return getContext<InlineCitationState>(INLINE_CITATION_KEY);
}
