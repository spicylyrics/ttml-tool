declare module "kuromoji/build/kuromoji.js" {
	import kuromoji from "kuromoji";
	export default kuromoji;
}

declare module "kuroshiro/lib/util" {
	export function kanaToRomaji(
		kana: string,
		system: "nippon" | "passport" | "hepburn",
	): string;
}
