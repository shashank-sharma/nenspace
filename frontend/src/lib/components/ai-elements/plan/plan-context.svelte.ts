import { getContext, setContext } from "svelte";

export interface PlanState {
	isStreaming: boolean;
}

const PLAN_KEY = Symbol("plan");

export function setPlanState(state: PlanState) {
	setContext(PLAN_KEY, state);
}

export function getPlanState(): PlanState {
	return getContext<PlanState>(PLAN_KEY);
}
