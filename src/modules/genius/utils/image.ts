/**
 * Transforms a Genius cover art URL into a better version using an image proxy.
 * This bypasses hotlinking protection and provides optimized thumbnails.
 * @param url The original image URL
 * @param size The desired size (e.g. 310)
 * @returns The proxied and optimized image URL
 */
export const getBetterGeniusCoverArt = (url: string | undefined | null, size = 310) => {
	if (!url) return "";

	// Using images.weserv.nl as a reliable proxy to bypass Genius hotlinking protection.
	// This service handles the resizing and provides a neutral referrer.
	return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=cover`;
};
