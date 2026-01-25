import { Popover as PopoverPrimitive } from "bits-ui";
import Content from "./popover-content.svelte";
import Portal from "./popover-portal.svelte";
const Root = PopoverPrimitive.Root;
const Trigger = PopoverPrimitive.Trigger;
const Close = PopoverPrimitive.Close;

export {
	Root,
	Content,
	Trigger,
	Close,
	Portal,
	//
	Root as Popover,
	Content as PopoverContent,
	Trigger as PopoverTrigger,
	Close as PopoverClose,
	Portal as PopoverPortal,
};
