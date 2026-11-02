import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createInstance } from "i18next";
import ICU from "i18next-icu";
import {
	checkLocale,
	checkLocales,
	checkRegional,
	checkRegionalOverrides,
	checkUsedKeys,
	placeholders,
} from "./check-locales.mjs";

test("reports missing, obsolete, non-string and reordered nested keys", () => {
	const source = { dialog: { title: "Title", text: "Text" } };
	assert.match(
		checkLocale(
			source,
			{ dialog: { title: "Titel", old: "Old" } },
			"nl-NL",
		).join("\n"),
		/extra key dialog.old[\s\S]*missing key dialog.text/,
	);
	assert.throws(
		() => checkLocale(source, { dialog: { title: 3 } }, "nl-NL"),
		/expected an object/,
	);
	assert.match(
		checkLocale(
			source,
			{ dialog: { text: "Tekst", title: "Titel" } },
			"nl-NL",
		)[0],
		/key order/,
	);
});

test("preserves single/double interpolation and paired numbered tags, including duplicates", () => {
	const source = { text: "<0>{name}</0> {{count}} {name}" };
	assert.deepEqual(
		checkLocale(source, { text: "{{count}} <0>{name}</0> {name}" }, "it-IT"),
		[],
	);
	for (const text of [
		"<0>{nome}</0> {{count}} {name}",
		"<0>{name}</1> {{count}} {name}",
		"<0>{name}</0> {count} {name}",
		"<0>{name}</0> {{count}}",
	]) {
		assert.match(
			checkLocale(source, { text }, "it-IT")[0],
			/placeholders differ/,
		);
	}
});

test("rejects empty translations but preserves intentional empty source labels", () => {
	assert.deepEqual(checkLocale({ text: "" }, { text: "" }, "it-IT"), []);
	assert.match(
		checkLocale({ text: "Text" }, { text: " " }, "it-IT")[0],
		/empty translation/,
	);
});

test("reads ICU branches as text and accepts the language's plural categories", () => {
	const source = { text: "{count, plural, one {# line} other {# lines}}" };
	assert.deepEqual(
		checkLocale(
			source,
			{
				text: "{count, plural, one {# строка} few {# строки} many {# строк} other {# строки}}",
			},
			"ru-RU",
		),
		[],
	);
	assert.deepEqual(
		checkLocale(source, { text: "{count, plural, other {# 行}}" }, "zh-CN"),
		[],
	);
	assert.match(checkLocale(source, source, "ru-RU")[0], /Missing ICU few/);
	assert.deepEqual(placeholders("'{literal}' {name} don't"), ["single:name"]);
	assert.throws(
		() => placeholders("{count, plural, one {line} other {lines}"),
		/Expected/,
	);
	assert.throws(
		() => placeholders("{count, plural, one {line} one {line} other {lines}}"),
		/Duplicate/,
	);
});

test("detects changed ICU argument names, types and nested arguments", () => {
	const source = { text: "{count, plural, one {{name}} other {{name}}}" };
	assert.match(
		checkLocale(
			source,
			{ text: "{count, plural, one {{nom}} other {{nom}}}" },
			"en-US",
		)[0],
		/placeholders differ/,
	);
	assert.notDeepEqual(placeholders("{n, number}"), placeholders("{n, date}"));
	assert.throws(() => placeholders("{{name}"), /Unclosed interpolation/);
});

test("allows grammatical pluralization of a simple English count", () => {
	assert.deepEqual(
		checkLocale(
			{ text: "Delete {count} words" },
			{
				text: "Smazat {count, plural, one {# slovo} few {# slova} many {# slova} other {# slov}}",
			},
			"cs-CZ",
		),
		[],
	);
});

test("all repository catalogs match the English source", () => {
	const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
	const { locales, errors } = checkLocales(root);
	assert.equal(locales.length, 16);
	assert.deepEqual(errors, []);
});

test("localized ICU messages render singular, plural, decimal and million counts", async () => {
	const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
	const { locales } = checkLocales(root);
	for (const locale of locales) {
		const translation = JSON.parse(
			readFileSync(`${root}/${locale}/translation.json`, "utf8"),
		);
		const i18n = createInstance().use(ICU);
		await i18n.init({ lng: locale, resources: { [locale]: { translation } } });
		const keys = ["preview.untimedLines", "sectionActions.categorizeSelected"];
		for (const key of [
			"deleteWords",
			"copyLine",
			"deleteLine",
			"moveWordToNewLine",
		]) {
			if (translation.contextMenu[key].includes(", plural,")) {
				keys.push(`contextMenu.${key}`);
			}
		}
		for (const key of keys) {
			for (const count of [0, 1, 2, 5, 21, 1.5, 1_000_000]) {
				const output = i18n.t(key, { count });
				assert.ok(!output.includes("{"), `${locale}: ${key}: ${output}`);
				if (key !== "sectionActions.categorizeSelected") {
					assert.ok(
						output.includes(new Intl.NumberFormat(locale).format(count)),
						`${locale}: ${key} lost count ${count}: ${output}`,
					);
				}
			}
		}
	}
});

test("removed saved languages resolve to English using the existing i18next fallback", async () => {
	for (const lng of ["en-UD", "lol-US", "lolcat"]) {
		const i18n = createInstance().use(ICU);
		await i18n.init({
			lng,
			fallbackLng: "en-US",
			resources: { "en-US": { translation: { title: "English" } } },
		});
		assert.equal(i18n.resolvedLanguage, "en-US");
		assert.equal(i18n.t("title"), "English");
	}
});

test("reports keys used in source that en-US does not define", () => {
	const source = {
		menu: { open: "Open" },
		steps: { intro: { title: "Intro" } },
	};
	const file = (...lines) => [{ path: "a.tsx", text: lines.join("\n") }];
	const id = "$" + "{id}";
	assert.deepEqual(
		checkUsedKeys(
			source,
			file(
				`t("menu.open"); i18next.t('menu.open');`,
				`<Trans i18nKey="menu.open" />; t(\`steps.${id}.title\`);`,
				`format("not.a.key"); dt("not.a.key");`,
			),
		),
		[],
	);
	assert.deepEqual(
		checkUsedKeys(
			source,
			file(
				"const x = 1;",
				`t("menu.close", "Close");`,
				`<Trans i18nKey="menu.gone" />`,
			),
		),
		[
			"a.tsx:2: missing en-US key menu.close",
			"a.tsx:3: missing en-US key menu.gone",
		],
	);
	assert.deepEqual(checkUsedKeys(source, file(`t(\`steps.${id}.waiting\`)`)), [
		`a.tsx:1: no en-US key matches steps.${id}.waiting`,
	]);
});

test("regional overrides need en-US keys, en-US placeholders and order, and a real difference", () => {
	const source = {
		menu: { open: "Open", close: "Close" },
		count: "{count} lines",
	};
	const base = {
		menu: { open: "Abrir", close: "Cerrar" },
		count: "{count} líneas",
	};
	assert.deepEqual(
		checkRegionalOverrides(source, { menu: { close: "Salir" } }, "es-MX", base),
		[],
	);
	assert.deepEqual(
		checkRegionalOverrides(
			source,
			{ menu: { gone: "Ya no" }, count: "{total} líneas" },
			"es-MX",
			base,
		),
		[
			"es-MX: extra key menu.gone",
			"es-MX: count: placeholders differ (single:count / single:total)",
		],
	);
	assert.match(
		checkRegionalOverrides(
			source,
			{ count: "{count} renglones", menu: { open: "Abrir ya" } },
			"es-MX",
			base,
		)[0],
		/key order/,
	);
	assert.deepEqual(
		checkRegionalOverrides(source, { menu: { open: "Abrir" } }, "es-MX", base),
		["es-MX: menu.open: same as the base catalog"],
	);
});

test("the shipped regional override files are valid", () => {
	const { locales, errors } = checkRegional(
		fileURLToPath(new URL("../src/i18n/regional", import.meta.url)),
		fileURLToPath(new URL("../src/i18n/locales", import.meta.url)),
	);
	assert.ok(locales.includes("es-MX"));
	assert.deepEqual(errors, []);
});
