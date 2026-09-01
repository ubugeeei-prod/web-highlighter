///|
/// Advances a UTF-16 cursor by a checked scalar width.
///
/// This proof kernel is colocated with `src/cursor.mbt` because the scanner's
/// safety boundary is the browser's UTF-16 code-unit coordinate system. The hot
/// path computes `width` from real code units; this helper owns only the
/// arithmetic contract that the next cursor is bounded and strictly forward.
pub fn advance_utf16_index(
  length : Int,
  index : Int,
  width : Int,
) -> Int where {
  proof_require: safe_advance_input(length, index, width),
  proof_ensure: result => {
    cursor_advanced_exact(length, index, width, result) &&
    cursor_advanced(length, index, result)
  },
  proof_reasoning: (
    #| `safe_advance_input` states all arithmetic facts needed by the scanner:
    #| the old cursor is in range, the width is exactly one BMP code unit or one
    #| surrogate pair, and adding that width does not pass the input length.
    #| Returning `index + width` therefore strictly increases the cursor while
    #| preserving the UTF-16 end-offset bound used by browser DOM APIs.
  ),
} {
  index + width
}
