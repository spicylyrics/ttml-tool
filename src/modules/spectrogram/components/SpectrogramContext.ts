import { createContext, type RefObject } from "react";

export interface ISpectrogramContext {
	// Keep scroll position out of this shared context: it changes every frame.
	// The overlay subscribes to it; drag handlers read it from the store on demand.
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	zoom: number;
}

export const SpectrogramContext = createContext<ISpectrogramContext>({
	scrollContainerRef: { current: null },
	zoom: 200,
});
