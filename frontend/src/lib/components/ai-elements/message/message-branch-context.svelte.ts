import { getContext, setContext } from "svelte";

export interface MessageBranchState {
	currentBranch: number;
	totalBranches: number;
	onBranchChange: (index: number) => void;
}

const MESSAGE_BRANCH_KEY = Symbol("message-branch");

export function setMessageBranchState(state: MessageBranchState) {
	setContext(MESSAGE_BRANCH_KEY, state);
}

export function getMessageBranchState(): MessageBranchState {
	return getContext<MessageBranchState>(MESSAGE_BRANCH_KEY);
}
