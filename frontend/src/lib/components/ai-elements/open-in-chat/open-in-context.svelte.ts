import { getContext, setContext } from "svelte";

export interface OpenInState {
	query: string;
}

const OPEN_IN_KEY = Symbol("open-in");

export function setOpenInState(state: OpenInState) {
	setContext(OPEN_IN_KEY, state);
}

export function getOpenInState(): OpenInState {
	return getContext<OpenInState>(OPEN_IN_KEY);
}
