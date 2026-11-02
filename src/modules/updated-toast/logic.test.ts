import { describe, expect, it } from "vitest";
import { decideUpdatedToast } from "./logic";

describe("decideUpdatedToast", () => {
	it("stores the version silently on the first run", () => {
		expect(decideUpdatedToast("0.16.0", null)).toEqual({
			show: false,
			store: "0.16.0",
		});
	});

	it("treats an empty stored value like a first run", () => {
		expect(decideUpdatedToast("0.16.0", "")).toEqual({
			show: false,
			store: "0.16.0",
		});
	});

	it("replaces an unreadable stored value without a toast", () => {
		expect(decideUpdatedToast("0.16.0", "garbage")).toEqual({
			show: false,
			store: "0.16.0",
		});
	});

	it("shows once after an update", () => {
		expect(decideUpdatedToast("0.17.0", "0.16.0")).toEqual({
			show: true,
			store: "0.17.0",
		});
	});

	it("shows for a patch release", () => {
		expect(decideUpdatedToast("0.16.1", "0.16.0").show).toBe(true);
	});

	it("does nothing on the same version, so it never shows twice", () => {
		expect(decideUpdatedToast("0.17.0", "0.17.0")).toEqual({
			show: false,
			store: null,
		});
	});

	it("keeps the higher version after a downgrade", () => {
		expect(decideUpdatedToast("0.16.0", "0.17.0")).toEqual({
			show: false,
			store: null,
		});
	});

	it("does not repeat the toast after going back and forth", () => {
		const first = decideUpdatedToast("0.17.0", "0.16.0");
		expect(first.show).toBe(true);
		const down = decideUpdatedToast("0.16.0", first.store);
		expect(down.store).toBeNull();
		expect(decideUpdatedToast("0.17.0", first.store).show).toBe(false);
	});

	it("ignores an invalid current version", () => {
		expect(decideUpdatedToast("", "0.16.0")).toEqual({
			show: false,
			store: null,
		});
	});
});
