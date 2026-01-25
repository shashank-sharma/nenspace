import { getContext, setContext } from "svelte";

export interface WebPreviewState {
	url: string;
	setUrl: (newUrl: string) => void;
}

const WEB_PREVIEW_KEY = Symbol("web-preview");

export function setWebPreviewState(state: WebPreviewState) {
	setContext(WEB_PREVIEW_KEY, state);
}

export function getWebPreviewState(): WebPreviewState {
	return getContext<WebPreviewState>(WEB_PREVIEW_KEY);
}
