# Writing add-ons

Add-ons are declarative MoonBit values compiled into the extension's Wasm engine. They are build-time source dependencies, not remotely loaded code. This preserves Manifest V3 reviewability and guarantees that an add-on cannot execute an arbitrary matcher on untrusted page content.

## Package contract

An add-on is a normal MoonBit package that imports `ubugeeei-prod/web_highlighter/src` and exports one `Addon` value. The core package exposes `addon(...)`, `make_language(...)`, `theme(...)`, and the small delimiter/signature helpers. The executable analyzer imports selected packages and lists their values in `configured_addons`; no core source file or generated DSL is edited.

Catalog composition is explicit and deterministic. `addon_languages(...)` and `addon_themes(...)` retain built-ins first, then append contributions in package order. `analyze_catalog_request(...)` and `theme_catalog_wire(...)` accept those composed immutable catalogs.

The bundled `addons/ush` and `addons/paper` packages are the executable contract examples. They import only the public core API, own their declarations and tests, and are selected by the thin analyzer entrypoint. Removing an import and its `configured_addons` entry removes that language or theme without changing the scanner or browser shell.

## Language contract

`language(...)` and its compact convenience constructor `make_language(...)` accept:

- a stable lowercase `id` and human-readable `name`;
- fenced-code `aliases`;
- filename `extensions` and exact special `filenames`;
- weighted literal `signatures` for metadata-free blocks;
- exact `keywords`, `types`, and `constants`;
- declaration introducers mapped to function, type, module, variable, or property symbols;
- line comments, block comments, string delimiters, operators, and extra identifier characters.

There are no arbitrary regular expressions, recursive repositories, executable callbacks, or presentation-specific TextMate scopes. `words("...")` is only a readability helper that produces an ordinary `Array[String]`.

## Detection precedence

Detection is deterministic:

1. explicit language hint or alias retained by the service;
2. exact filename or extension, especially on GitHub;
3. weighted literal signatures when metadata is gone.

Inference requires a total score above one. Give unique syntax weight 3, characteristic APIs weight 2, and common contextual fragments weight 1. A common keyword alone must never recolor prose.

## Theme contract

`theme(...)` declares colors for stable semantic roles: foreground, background, selection, keyword, type, constant, string, number, comment, operator, function, variable, property, and punctuation. Theme selection, fallback, and the popup catalog all come from the composed MoonBit values. The host only installs the resulting CSS variables.

## Quality checklist

- Include aliases used by Markdown renderers and chat services.
- Include an extension and at least two independent signatures.
- Put longer overlapping delimiters before shorter ones.
- Test explicit hints, filename fallback, representative source, strings, comments, and at least one declaration/reference pair.
- Assert that `validate_addons(...)` is empty so IDs and aliases cannot shadow another package.
- Keep inference conservative; a false negative is preferable to recoloring unrelated content.
- Run `vp run verify` and retain the 32 KiB combined Brotli budget.

The add-on contract suite lives in `src/addon_wbtest.mbt`; built-in cases live in `src/catalog_wbtest.mbt`; scanner edge cases live beside the scanner in `src/scanner_wbtest.mbt`.

## Distribution boundary

To distribute a third-party add-on, publish or vendor its MoonBit package, import that package from the analyzer entrypoint, and produce a reviewed extension build. A future data import format may compile to the same immutable model, but it must not introduce remote executable code, `eval`, regex callbacks, or page-data uploads.
