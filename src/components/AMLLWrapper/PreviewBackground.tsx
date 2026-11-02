import {
	BackgroundRender,
	MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
import { useEffect, useRef, useState } from "react";

export function PreviewBackground({
	album,
	playing,
}: {
	album?: string;
	playing: boolean;
}) {
	const container = useRef<HTMLDivElement>(null);
	const [renderer, setRenderer] =
		useState<BackgroundRender<MeshGradientRenderer> | null>(null);

	useEffect(() => {
		const background = BackgroundRender.new(MeshGradientRenderer);
		setRenderer(background);
		background.setRenderScale(0.5);
		const canvas = background.getElement();
		Object.assign(canvas.style, {
			width: "100%",
			height: "100%",
			minHeight: "0",
			minWidth: "0",
			overflow: "hidden",
		});
		container.current?.appendChild(canvas);
		// dispose() frees the renderer's GL objects but leaves the context
		// alive until GC; browsers cap live contexts, so drop it right away.
		const release = () => {
			background.dispose();
			canvas
				.getContext("webgl")
				?.getExtension("WEBGL_lose_context")
				?.loseContext();
		};
		let loading = Boolean(album);
		let disposed = false;
		if (album) {
			void background
				.setAlbum(album)
				.catch(console.error)
				.finally(() => {
					loading = false;
					if (disposed) release();
				});
		}
		return () => {
			disposed = true;
			background.pause();
			canvas.remove();
			if (!loading) release();
		};
	}, [album]);

	useEffect(() => {
		if (playing) renderer?.resume();
		else renderer?.pause();
	}, [renderer, playing]);

	return <div ref={container} style={{ display: "contents" }} />;
}
