/**
 * Transforms a Genius cover art URL into a better version using an image proxy.
 * This bypasses hotlinking protection and provides optimized thumbnails.
 * @param url The original image URL
 * @param size The desired size (e.g. 310)
 * @returns The proxied and optimized image URL
 */
export const getBetterGeniusCoverArt = (url: string | undefined | null, size = 310) => {
	if (!url) return "";

	// Use Genius's native thumbnail generation proxy which avoids third-party unreliability
	return `https://t2.genius.com/unsafe/${size}x${size}/${encodeURIComponent(url)}`;
};
