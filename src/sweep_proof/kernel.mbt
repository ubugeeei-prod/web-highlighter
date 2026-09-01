///|
/// Decides whether a token must be rendered inside a segment.
///
/// The browser renderer sweeps ordered tokens against ordered segments with one
/// forward cursor each. This is the exact membership test that sweep replaces,
/// kept beside the sweep regression tests so the host mirrors a proved formula
/// instead of a local one.
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
    #| Half-open spans intersect exactly when each starts before the other
    #| ends. This admits tokens crossing line breaks while rejecting both
    #| boundary-touching cases, so empty adjacency never becomes a render span.
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
    #| Once `token_end <= segment_start`, `skipped_token_cannot_cover` proves the
    #| token cannot affect this segment. With ordered segments,
    #| `skipped_token_stays_skipped` then proves the same token cannot reappear
    #| in any later segment, so the sweep cursor only moves forward.
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
    #| If `segment_end <= token_start`, the current token starts after the
    #| segment. For ordered tokens, `stopped_token_stops_its_suffix` proves every
    #| later token starts no earlier, so scanning this segment can stop here.
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
    #| Together with `clip_span_start`, this gives `clipped_span`; the
    #| `covered_clip_*` lemmas prove the DOM slice stays bounded and non-empty
    #| when the source segment itself is non-empty.
  ),
} {
  if segment_end < token_end {
    segment_end
  } else {
    token_end
  }
}
