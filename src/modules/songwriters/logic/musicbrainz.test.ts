import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildRecordingQuery,
	getRecordingWriters,
	searchRecordings,
} from "./musicbrainz";

const json = (body: unknown) =>
	Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("buildRecordingQuery", () => {
	it("quotes both fields and escapes quotes", () => {
		expect(buildRecordingQuery('Say "Hi"', "AC/DC")).toBe(
			'recording:"Say \\"Hi\\"" AND artist:"AC/DC"',
		);
		expect(buildRecordingQuery("Song", " ")).toBe('recording:"Song"');
	});
});

describe("MusicBrainz requests", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		fetchMock.mockReset();
	});

	it("keeps one result per title and artist, shown through its studio release", async () => {
		const credit = [{ name: "Taylor Swift", artist: { id: "t" } }];
		fetchMock.mockImplementation(() =>
			json({
				recordings: [
					{
						id: "karaoke",
						title: "Shake It Off",
						"artist-credit": credit,
						releases: [
							{
								id: "k",
								title: "Karaoke Hits",
								status: "Official",
								"release-group": {
									"primary-type": "Album",
									"secondary-types": ["Compilation"],
								},
							},
						],
					},
					{
						id: "studio",
						title: "Shake It Off",
						"artist-credit": credit,
						releases: [
							{ id: "live", title: "Live", status: "Bootleg" },
							{
								id: "1989",
								title: "1989",
								status: "Official",
								"release-group": { "primary-type": "Album" },
							},
						],
					},
					{ id: "bare", title: "Shake It Off", "artist-credit": credit },
				],
			}),
		);
		const pending = searchRecordings("query");
		await vi.runAllTimersAsync();
		expect(await pending).toEqual([
			{
				source: "musicbrainz",
				id: "studio",
				title: "Shake It Off",
				artist: "Taylor Swift",
				album: "1989",
				coverUrl: "https://coverartarchive.org/release/1989/front-250",
				alternateIds: ["karaoke", "bare"],
			},
		]);
	});

	it("retries once when MusicBrainz asks to slow down", async () => {
		fetchMock
			.mockImplementationOnce(() =>
				Promise.resolve(new Response("", { status: 503 })),
			)
			.mockImplementation(() => json({ recordings: [] }));
		const pending = searchRecordings("query");
		await vi.runAllTimersAsync();
		expect(await pending).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("skips recordings without a work and adds legal names", async () => {
		fetchMock.mockImplementation((input) => {
			const url = String(input);
			if (url.includes("/recording/first")) return json({ relations: [] });
			if (url.includes("/recording/second"))
				return json({
					relations: [
						{
							type: "performance",
							work: {
								id: "w",
								title: "Song",
								relations: [
									{ type: "writer", artist: { id: "1", name: "Shellback" } },
									{ type: "arranger", artist: { id: "2", name: "Arranger" } },
									{ type: "composer", artist: { id: "3", name: "Composer" } },
								],
							},
						},
					],
				});
			return json({
				artists: [
					{
						id: "1",
						name: "Shellback",
						aliases: [
							{ name: "Johan Schuster", type: "Search hint" },
							{ name: "Johan Karl Schuster", type: "Legal name" },
						],
					},
					{ id: "3", name: "Composer", aliases: [] },
				],
			});
		});
		const pending = getRecordingWriters({
			source: "musicbrainz",
			id: "first",
			title: "Song",
			artist: "Artist",
			alternateIds: ["second"],
		});
		await vi.runAllTimersAsync();
		expect(await pending).toEqual([
			{ credited: "Shellback", legal: "Johan Karl Schuster" },
			{ credited: "Composer", legal: undefined },
		]);
	});
});
