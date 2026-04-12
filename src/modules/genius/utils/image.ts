/**
 * Transforms a cover art URL into a better version using an image proxy.
 * This bypasses hotlinking protection, avoids CORS issues, and provides optimized thumbnails.
 * @param url The original image URL
 * @param size The desired size (e.g. 300)
 * @returns The proxied and optimized image URL
 */
export const getBetterGeniusCoverArt = (url: string | undefined | null, size = 300) => {
	if (!url || typeof url !== "string") return "";

	let cleaned = url.trim();
	if (cleaned.startsWith("//")) {
		cleaned = `https:${cleaned}`;
	}

	// We use wsrv.nl to proxy the image. This bypasses Referer checks and CORS issues
	// commonly found with Genius and other image hosting services.
	const encodedUrl = encodeURIComponent(cleaned.replace(/^http:/, "https:"));
	return `https://wsrv.nl/?url=${encodedUrl}&w=${size}&h=${size}&fit=cover`;
};
