///|
/// Validates that every emitted token span is bounded and ordered.
///
/// This executable checker mirrors the colocated scanner predicates and is
/// intentionally independent from theme or language policy. Tests use it as a
/// broad regression oracle for scanner changes.
pub fn analysis_is_bounded(analysis : Analysis, source_length : Int) -> Bool {
  let mut cursor = 0
  for token_ in analysis.tokens {
    if !@scanner_contract.span_is_ordered_after(
        cursor,
        token_.span.start,
        token_.span.end_,
        source_length,
      ) {
      return false
    }
    cursor = @scanner_contract.cursor_after_ordered_span(
      cursor,
      token_.span.start,
      token_.span.end_,
      source_length,
    )
  }
  for definition in analysis.definitions {
    if !@scanner_contract.span_is_nonempty(
        definition.span.start,
        definition.span.end_,
        source_length,
      ) {
      return false
    }
  }
  for reference in analysis.references {
    if !@scanner_contract.span_is_nonempty(
        reference.span.start,
        reference.span.end_,
        source_length,
      ) {
      return false
    }
  }
  true
}

///|
/// Mirrors the renderer's "token intersects DOM segment" predicate.
///
/// The renderer itself lives in the extension host, but the algebra is kept in
/// MoonBit so tests can compare host-style sweeping against the same proved
/// predicate that `src/sweep_contract/contract.mbtp` reasons about.
pub fn render_span_covers_segment(
  token_start : Int,
  token_end : Int,
  segment_start : Int,
  segment_end : Int,
) -> Bool {
  @sweep_contract.span_covers_segment(
    token_start,
    token_end,
    segment_start,
    segment_end,
  )
}

///|
/// Mirrors the renderer's forward-token skip predicate.
pub fn render_span_precedes_segment(
  token_end : Int,
  segment_start : Int,
) -> Bool {
  @sweep_contract.span_precedes_segment(token_end, segment_start)
}

///|
/// Mirrors the renderer's per-segment stop predicate.
pub fn render_span_follows_segment(
  token_start : Int,
  segment_end : Int,
) -> Bool {
  @sweep_contract.span_follows_segment(token_start, segment_end)
}
