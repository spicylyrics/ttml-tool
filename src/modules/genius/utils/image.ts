/**
 * Transforms a Genius cover art URL into a better version using an image proxy.
 * This bypasses hotlinking protection and provides optimized thumbnails.
 * @param url The original image URL
 * @param size The desired size (e.g. 310)
 * @returns The proxied and optimized image URL
 */
export const getBetterGeniusCoverArt = (url: string | undefined | null) => {
	if (!url) return "";

	// Return the direct url without using any proxy (neither t2.genius.com nor weserv).
	// This avoids 403 Forbidden errors which currently happen on image scalers. 
	// The native images.genius.com works universally without restrictions.
	return url;
};
