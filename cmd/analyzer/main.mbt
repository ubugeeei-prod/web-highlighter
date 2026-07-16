///|
let configured_addons : Array[@core.Addon] = [
  @ush.contribution(),
  @paper.contribution(),
]

///|
let language_catalog : Array[@core.Language] =
  @core.addon_languages(configured_addons)

///|
let theme_catalog : Array[@core.Theme] = @core.addon_themes(configured_addons)

///|
/// Exposes the core analysis plan through the browser's Wasm boundary.
pub fn analyze_request(
  source : String,
  hint : String,
  filename : String,
) -> String {
  @core.analyze_catalog_request(language_catalog, source, hint, filename)
}

///|
/// Exposes declarative theme selection through the browser's Wasm boundary.
pub fn theme_wire(requested : String, prefers_dark : Bool) -> String {
  @core.theme_catalog_wire(theme_catalog, requested, prefers_dark)
}

///|
/// Exposes the composed theme catalog for the extension popup.
pub fn themes_wire() -> String {
  @core.theme_catalog_list_wire(theme_catalog)
}

///|
fn main {
  // Browser consumers call the explicitly exported Wasm-GC functions.
}
