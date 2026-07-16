///|
/// Exposes the core analysis plan through the browser's Wasm boundary.
pub fn analyze_request(
  source : String,
  hint : String,
  filename : String,
) -> String {
  @core.analyze_request(source, hint, filename)
}

///|
/// Exposes declarative theme selection through the browser's Wasm boundary.
pub fn theme_wire(requested : String, prefers_dark : Bool) -> String {
  @core.theme_wire(requested, prefers_dark)
}

///|
fn main {
  // Browser consumers call the explicitly exported Wasm-GC functions.
}
