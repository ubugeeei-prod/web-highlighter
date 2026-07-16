# Writing add-ons

Add-ons are ordinary typed modules, but their values are declarative and serializable. They are included at build time because Manifest V3 forbids remotely hosted executable code.

## Language contract

`defineLanguage` accepts:

- `id`: stable lower-case identifier.
- `name`: display name.
- `aliases`: fenced-code language tags.
- `extensions`: filename extensions without a leading dot.
- `filenames`: exact special filenames.
- `signatures`: literal fragments used only when a site discarded the language tag.
- `grammar`: lexical vocabulary and region declarations.

The grammar fields are:

- `keywords`, `types`, and `constants`: exact words.
- `declarations`: a keyword-to-symbol-kind mapping for the next name.
- `lineComments`: literal line-comment openings.
- `blockComments`: opening/closing delimiter pairs.
- `strings`: opening/closing delimiter pairs with backslash escaping.
- `operatorCharacters`: characters grouped as operator tokens.
- `identifierExtra`: non-ASCII or punctuation characters allowed in identifiers.

Use `words("...")` for long word lists. This stays readable while producing a normal array—not a language grammar DSL.

## Detection rules

Detection is deterministic:

1. an explicit service language hint or alias;
2. an exact filename or extension;
3. weighted literal signatures.

Signature inference requires a score above one. Give syntax unique to the language weight 3, characteristic library names weight 2, and common fragments weight 1. Never use a single common word as a strong signature.

## Theme contract

`defineTheme` maps the stable semantic scopes to CSS colors. A theme also supplies foreground, background, and selection colors. Values are validated before build and installed as CSS variables, so switching themes is allocation-free with respect to analysis.

## Quality checklist

- Add aliases used by GitHub-flavored Markdown and popular chat renderers.
- Add an extension and at least two independent signatures.
- Keep longer prefix delimiters before shorter ones.
- Include representative valid, incomplete, comment, and string samples in `tests/analyzer.test.ts`.
- Verify definition and reference behavior for at least one declaration form.
- Run `npm run verify`.
- Confirm the content bundle remains within the compressed-size budget.

## Security and distribution

Add-ons cannot be downloaded and executed after installation. This is a deliberate Manifest V3 boundary. A third-party add-on is distributed as source, imported into a catalog, checked by TypeScript, and bundled into a reviewed extension package.

Data-only import/export may be added later, but it must compile into the same validated immutable representation and cannot introduce regex callbacks, `eval`, or `new Function`.
