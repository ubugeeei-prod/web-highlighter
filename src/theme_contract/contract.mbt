///|
/// Decides whether raw theme colors are safe for the rendered code surface.
///
/// This proof kernel is colocated with `src/theme.mbt` because the browser host
/// only supplies a surface polarity; the MoonBit theme resolver owns the
/// fail-readable decision before CSS variables are serialized.
pub fn theme_needs_surface_fallback_flag(
  selected_dark : Int,
  prefers_dark : Int,
) -> Bool where {
  proof_require: surface_flag(selected_dark),
  proof_require: surface_flag(prefers_dark),
  proof_ensure: result =>
    result == surface_palette_fallback_needed(selected_dark, prefers_dark),
  proof_reasoning: (
    #| `Theme.dark` is the polarity contract for its foreground colors. Raw
    #| colors are safe exactly when that contract equals the actual code
    #| surface polarity. Any inequality is therefore the complete fallback
    #| condition.
  ),
} {
  selected_dark != prefers_dark
}

///|
/// Returns the polarity flag that the emitted CSS variables must satisfy.
pub fn resolved_surface_dark_flag(
  selected_dark : Int,
  prefers_dark : Int,
) -> Int where {
  proof_require: surface_flag(selected_dark),
  proof_require: surface_flag(prefers_dark),
  proof_ensure: result => emitted_palette_matches_surface(result, prefers_dark),
  proof_reasoning: (
    #| If fallback is needed, the emitted colors are taken from the surface
    #| default palette. If fallback is not needed, `selected_dark` already
    #| equals `prefers_dark`; both branches therefore emit the surface polarity.
  ),
} {
  if theme_needs_surface_fallback_flag(selected_dark, prefers_dark) {
    prefers_dark
  } else {
    selected_dark
  }
}
