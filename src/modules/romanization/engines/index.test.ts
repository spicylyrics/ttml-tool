import { describe, expect, it } from "vitest";
import { romanizeSyllables } from "./index";

describe("on-device romanization", () => {
	it("spaces Chinese readings per character", async () => {
		expect(await romanizeSyllables(["今天", "明", "天"], "zh")).toEqual([
			"jīn tiān ",
			"míng ",
			"tiān",
		]);
		expect(await romanizeSyllables(["我", "愛", "你"], "yue")).toEqual([
			"ngo5 ",
			"oi3 ",
			"nei5",
		]);
	});

	it("keeps the lyrics' own word gaps in spaced scripts", async () => {
		expect(await romanizeSyllables(["사랑해 ", "보고"], "ko")).toEqual([
			"saranghae ",
			"bogo",
		]);
		expect(await romanizeSyllables(["Я ", "те", "бя"], "cyrillic")).toEqual([
			"Ya ",
			"te",
			"bya",
		]);
		expect(await romanizeSyllables(["αγα", "πώ"], "greek")).toEqual([
			"aga",
			"pō",
		]);
	});

	it("reads Ukrainian letters the Ukrainian way", async () => {
		expect(await romanizeSyllables(["Їжак"], "cyrillic")).toEqual(["Yizhak"]);
	});

	it("leaves English words alone", async () => {
		expect(await romanizeSyllables(["love ", "我"], "zh")).toEqual(["", "wǒ"]);
	});
});
