import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildLineRomanization,
	formatPhoneticForDisplay,
	getPhonetic,
	getPhoneticSyllables,
} from "./phonetic";

const googleResponse = (romanized: string) =>
	new Response(JSON.stringify([[["", "", "", romanized]]]), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("phonetic conversion requests", () => {
	it("limits simultaneous Google transliteration requests", async () => {
		let activeRequests = 0;
		let maximumActiveRequests = 0;
		const fetchMock = vi.fn(async () => {
			activeRequests++;
			maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
			await new Promise((resolve) => setTimeout(resolve, 5));
			activeRequests--;
			return googleResponse("a");
		});
		vi.stubGlobal("fetch", fetchMock);

		await getPhoneticSyllables(
			["一", "二", "三", "四", "五", "六", "七", "八"],
			"ja",
		);

		expect(fetchMock).toHaveBeenCalledTimes(9);
		expect(maximumActiveRequests).toBeLessThanOrEqual(4);
	});

	it("retries Google after a temporary fallback", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(googleResponse("retry"));
		vi.stubGlobal("fetch", fetchMock);

		expect(await getPhonetic("重新嘗試獨特文字", "yue")).toBe("");
		expect(await getPhonetic("重新嘗試獨特文字", "yue")).toBe("retry");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("reuses successful Google results", async () => {
		const fetchMock = vi.fn(async () => googleResponse("Cached Value"));
		vi.stubGlobal("fetch", fetchMock);

		expect(await getPhonetic("成功快取獨特文字", "yue")).toBe("cachedvalue");
		expect(await getPhonetic("成功快取獨特文字", "yue")).toBe("cachedvalue");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("preserves contextual Chinese pinyin and tone marks", async () => {
		const fetchMock = vi.fn(async () => googleResponse("YĪN YUÈ YÍN HÁNG"));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getPhoneticSyllables(["音乐", "银行"], "zh")).resolves.toEqual(
			["yīnyuè", "yínháng"],
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("formats displayed romanization as lowercase compact text", () => {
		expect(formatPhoneticForDisplay("Wǒ néng gòu fēi xiáng")).toBe(
			"wǒnénggòufēixiáng",
		);
	});

	it("leaves Latin capsules blank in mixed Chinese lines", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const query = new URL(String(input)).searchParams.get("q");
			return googleResponse(query === "中国" ? "Zhōng guó" : "I zhōng guó");
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(getPhoneticSyllables(["I", "中国"], "zh")).resolves.toEqual([
			"",
			"zhōngguó",
		]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps word gaps in a capsule that holds several words", async () => {
		const readings: Record<string, string> = {
			君の名前を呼ぶ: "Kimi no Namae wo Yobu",
			君の名前を呼ぶあ: "Kimi no Namae wo Yobu a",
			あ: "a",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL | Request) =>
				googleResponse(
					readings[new URL(String(input)).searchParams.get("q") ?? ""],
				),
			),
		);

		await expect(
			getPhoneticSyllables(["君の名前を呼ぶ", "あ"], "ja"),
		).resolves.toEqual(["kimi no namae wo yobu", "a"]);
	});

	it("preserves source spacing and Latin text in line romanization", () => {
		expect(
			buildLineRomanization(
				["I", " ", "told", " ", "you,", " ", "it's", " ", "中", "国"],
				["", "", "", "", "", "", "", "", "zhōng", "guó"],
			),
		).toBe("i told you, it's zhōngguó");
	});
});
