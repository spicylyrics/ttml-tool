import { describe, expect, it } from "vitest";
import type { TTMLMetadata } from "$/types/ttml";
import { metadataValues, setMetadataValues } from "./metadata-fields";

describe("setMetadataValues", () => {
	it("adds, replaces and drops blank values", () => {
		const metadata: TTMLMetadata[] = [];
		setMetadataValues(metadata, "musicName", ["Song", " "]);
		expect(metadata).toEqual([{ key: "musicName", value: ["Song"] }]);
		setMetadataValues(metadata, "musicName", ["Other"]);
		expect(metadataValues(metadata, "musicName")).toEqual(["Other"]);
	});

	it("removes a field left empty, unless asked to keep it", () => {
		const metadata: TTMLMetadata[] = [
			{ key: "album", value: ["1989"] },
			{ key: "isrc", value: ["X"] },
		];
		setMetadataValues(metadata, "album", [""]);
		setMetadataValues(metadata, "isrc", [], { removeWhenEmpty: false });
		expect(metadata).toEqual([{ key: "isrc", value: [] }]);
	});
});
