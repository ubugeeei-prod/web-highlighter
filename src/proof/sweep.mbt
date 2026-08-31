///|
/// Decides whether a token must be rendered inside a segment.
///
/// The browser renderer sweeps ordered tokens against ordered segments with one
/// forward cursor each. This is the exact membership test that sweep replaces,
/// kept here so the host mirrors a proved formula instead of a local one.
pub fn span_covers_segment(
  token_start : Int,
  token_end : Int,
  segment_start : Int,
  segment_end : Int,
) -> Bool where {
  proof_ensure: result => {
    result == covers_segment(token_start, token_end, segment_start, segment_end)
  },
  proof_reasoning: (
    #| Two half-open spans meet exactly when each starts before the other ends.
    #| Tokens crossing a line break therefore cover every segment they reach,
    #| which is what keeps a multi-line comment highlighted on all of its lines.
  ),
} {
  segment_start < token_end && token_start < segment_end
}

///|
/// Decides whether the sweep may skip a token before reaching a segment.
pub fn span_precedes_segment(
  token_end : Int,
  segment_start : Int,
) -> Bool where {
  proof_ensure: result => result == precedes_segment(token_end, segment_start),
  proof_reasoning: (
    #| `precedes_segment_excludes_cover` proves a skipped token cannot cover the
    #| segment, and `skipped_token_stays_skipped` proves later segments cannot
    #| reach it either, so the sweep cursor is safe to advance and never rewind.
  ),
} {
  token_end <= segment_start
}

///|
/// Decides whether the sweep may stop scanning a segment at this token.
pub fn span_follows_segment(
  token_start : Int,
  segment_end : Int,
) -> Bool where {
  proof_ensure: result => result == follows_segment(token_start, segment_end),
  proof_reasoning: (
    #| `follows_segment_excludes_cover` proves the stopping token covers nothing
    #| in this segment, and `ordered_pair_stops_as_suffix` proves every later
    #| token starts even further away, so the scan can end at the first one.
  ),
} {
  segment_end <= token_start
}

///|
/// Computes where a token starts inside one segment.
pub fn clip_span_start(
  token_start : Int,
  segment_start : Int,
) -> Int where {
  proof_ensure: result => clip_start(token_start, segment_start, result),
  proof_reasoning: (
    #| Rendering a token that begins in an earlier segment must start at the
    #| segment boundary instead. The later of the two starts is exactly that
    #| offset, and it is still one of the two inputs, so no new offset appears.
  ),
} {
  if token_start < segment_start {
    segment_start
  } else {
    token_start
  }
}

///|
/// Computes where a token ends inside one segment.
pub fn clip_span_end(
  token_end : Int,
  segment_end : Int,
) -> Int where {
  proof_ensure: result => clip_end(token_end, segment_end, result),
  proof_reasoning: (
    #| A token continuing into a later segment must end at the segment boundary.
    #| With `clip_span_start` this pair satisfies `clipped_span`, so
    #| `covered_clip_is_bounded` proves the rendered slice stays in range.
  ),
} {
  if segment_end < token_end {
    segment_end
  } else {
    token_end
  }
}
