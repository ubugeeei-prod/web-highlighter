///|
/// Advances a UTF-16 cursor by a checked scalar width.
///
/// The hot scanner computes the width from the actual code units and delegates
/// only the arithmetic to this function. Keeping the proof here avoids forcing
/// the whole lexical engine through SMT while still proving the bounds contract
/// every token span relies on.
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

///|
/// Advances a synthetic cursor to a known limit.
///
/// This is a proof kernel for the scanner's many "walk until a delimiter,
/// newline, or token boundary" loops: the body is intentionally byte-agnostic,
/// while the loop invariant proves the monotonic bounded shape shared by those
/// loops.
pub fn walk_to_limit(
  length : Int,
  start : Int,
  limit : Int,
) -> Int where {
  proof_require: bounded_span(start, limit, length),
  proof_ensure: result => result == limit && bounded_cursor(result, length),
  proof_reasoning: (
    #| The cursor starts at the left edge of a bounded half-open span. Each
    #| iteration advances it by one code unit while the loop guard proves it is
    #| still below `limit`. The invariants keep both cursor and limit inside the
    #| original source bounds. Normal loop exit means `cursor < limit` is false,
    #| so together with `cursor <= limit` the result is exactly `limit`.
  ),
} {
  for cursor = start; cursor < limit; {
    continue cursor + 1
  } nobreak {
    cursor
  } where {
    proof_invariant: start <= cursor,
    proof_invariant: cursor <= limit,
    proof_invariant: bounded_cursor(cursor, length),
    proof_invariant: bounded_cursor(limit, length),
    proof_yield: result => result == limit && bounded_cursor(result, length),
    proof_reasoning: (
      #| The increment preserves `cursor <= limit` because it only runs under
      #| `cursor < limit`. Since `limit` is already bounded by `length`, the new
      #| cursor also remains a legal UTF-16 boundary.
    ),
  }
}

///|
/// Decides whether a candidate span is within a UTF-16 source length.
///
/// Runtime tests use this executable checker to mirror the proof predicate in
/// `bounds.mbtp`; the function is deliberately tiny so the verifier can prove
/// it is an exact decision procedure for the predicate.
pub fn span_is_bounded(
  start : Int,
  end_ : Int,
  length : Int,
) -> Bool where {
  proof_ensure: result => result == bounded_span(start, end_, length),
  proof_reasoning: (
    #| The executable guard and the predicate are intentionally the same
    #| half-open interval formula. The checker is used by scanner regression
    #| tests, while `bounded_span` remains the logic-side name for contracts.
  ),
} {
  0 <= start && start <= end_ && end_ <= length
}

///|
/// Decides whether a candidate emitted span is bounded and non-empty.
pub fn span_is_nonempty(
  start : Int,
  end_ : Int,
  length : Int,
) -> Bool where {
  proof_ensure: result => result == nonempty_span(start, end_, length),
  proof_reasoning: (
    #| This is the executable counterpart of `nonempty_span`. Tests use it for
    #| every emitted token, definition, and reference because zero-width spans
    #| would make DOM wrapping ambiguous and can cause infinite rendering loops.
  ),
} {
  0 <= start && start < end_ && end_ <= length
}

///|
/// Decides whether a token can be appended after the previous emitted cursor.
pub fn span_is_ordered_after(
  cursor : Int,
  start : Int,
  end_ : Int,
  length : Int,
) -> Bool where {
  proof_ensure: result => {
    result == ordered_span_after(cursor, start, end_, length)
  },
  proof_reasoning: (
    #| Ordered appends are exactly the conjunction of a bounded previous cursor,
    #| a non-empty span, and non-overlap. Keeping this as one predicate gives the
    #| scanner tests a direct executable mirror of the proof-side invariant.
  ),
} {
  0 <= cursor &&
  cursor <= length &&
  0 <= start &&
  start < end_ &&
  end_ <= length &&
  cursor <= start
}

///|
/// Returns the cursor after appending one proved-safe token span.
pub fn cursor_after_ordered_span(
  cursor : Int,
  start : Int,
  end_ : Int,
  length : Int,
) -> Int where {
  proof_require: ordered_span_after(cursor, start, end_, length),
  proof_ensure: result => {
    result == end_ && bounded_cursor(result, length) && cursor < result
  },
  proof_reasoning: (
    #| `ordered_span_after` gives `cursor <= start < end <= length`. Returning
    #| `end` therefore advances the emitted-token cursor while keeping it a
    #| valid half-open UTF-16 boundary.
  ),
} {
  end_
}

///|
/// Computes the exact positive width of an emitted span.
pub fn token_span_width(
  start : Int,
  end_ : Int,
  length : Int,
) -> Int where {
  proof_require: nonempty_span(start, end_, length),
  proof_ensure: result => positive_span_width(start, end_, result),
  proof_reasoning: (
    #| `nonempty_span` proves `start < end`, so subtracting the start from the
    #| end produces a strictly positive width. This is the arithmetic fact the
    #| renderer relies on when replacing one source slice by exactly one span.
  ),
} {
  end_ - start
}

///|
/// Computes the cursor after a sorted pair of emitted spans.
pub fn cursor_after_ordered_pair(
  left_start : Int,
  left_end : Int,
  right_start : Int,
  right_end : Int,
  length : Int,
) -> Int where {
  proof_require: ordered_pair(
    left_start, left_end, right_start, right_end, length,
  ),
  proof_ensure: result => {
    result == right_end &&
    bounded_cursor(result, length) &&
    ordered_span_after(left_end, right_start, right_end, length)
  },
  proof_reasoning: (
    #| `ordered_pair` states both spans are non-empty and `left_end <=
    #| right_start`. Returning the right span end is therefore exactly the merge
    #| cursor after appending the pair in source order.
  ),
} {
  right_end
}

///|
/// Computes the end offset for a matched non-empty prefix.
pub fn prefix_end(
  start : Int,
  prefix_length : Int,
  length : Int,
) -> Int where {
  proof_require: 0 <= start &&
  0 < prefix_length &&
  start + prefix_length <= length,
  proof_ensure: result => prefix_span(start, prefix_length, result, length),
  proof_reasoning: (
    #| Prefix matching already proves the opener is non-empty and fits inside
    #| the source. The end offset is exactly `start + prefix_length`, which gives
    #| the scanner a non-empty bounded span for comments and delimiters.
  ),
} {
  start + prefix_length
}

///|
/// Checks that a region cursor stayed inside the original source bounds.
pub fn region_cursor_is_bounded(
  start : Int,
  cursor : Int,
  length : Int,
) -> Bool where {
  proof_ensure: result => result == region_cursor(start, cursor, length),
  proof_reasoning: (
    #| Region scanning moves from an opener toward either a closer or the source
    #| end. This checker names the exact invariant shared by comments and
    #| strings so tests can validate unterminated and escaped paths uniformly.
  ),
} {
  0 <= start &&
  start <= length &&
  0 <= cursor &&
  cursor <= length &&
  start <= cursor
}

///|
/// Counts are monotonic natural numbers in scanner accounting.
pub fn count_is_nonnegative(
  count : Int,
) -> Bool where {
  proof_ensure: result => result == nonnegative_count(count),
  proof_reasoning: (
    #| Line accounting increments from zero only. Exposing the proof predicate
    #| as an executable decision procedure lets tests check generated metadata
    #| without depending on a particular token class.
  ),
} {
  0 <= count
}

///|
/// Adds a line-count delta while preserving non-negative accounting.
pub fn add_line_count(
  before : Int,
  delta : Int,
) -> Int where {
  proof_require: nonnegative_count(before) && nonnegative_count(delta),
  proof_ensure: result => {
    count_step(before, delta, result) && nonnegative_count(result)
  },
  proof_reasoning: (
    #| Scanner line metadata starts at one and only adds counts produced by
    #| bounded source slices. The arithmetic kernel proves that such additions
    #| cannot underflow into invalid line numbers.
  ),
} {
  before + delta
}

///|
/// Decides whether a source length is allowed by an analyzer budget.
pub fn source_length_is_allowed(
  length : Int,
  limit : Int,
) -> Bool where {
  proof_ensure: result => result == source_length_allowed(length, limit),
  proof_reasoning: (
    #| This executable guard is exactly the logic predicate used by the
    #| analyzer budget. Keeping it in the proof package makes oversize
    #| rejection a Wasm-owned invariant instead of a browser-host convention.
  ),
} {
  0 <= length && 0 <= limit && length <= limit
}

///|
/// Decides whether an output array may accept one more item.
pub fn item_budget_allows(
  count : Int,
  limit : Int,
) -> Bool where {
  proof_ensure: result => result == can_push_item(count, limit),
  proof_reasoning: (
    #| The append decision is a natural-number counter check. It is shared by
    #| tokens, definitions, references, and deferred reference candidates, so
    #| every potentially large output path uses the same verified formula.
  ),
} {
  0 <= count && count < limit
}

///|
/// Computes the counter after a budgeted optional append.
pub fn next_budget_count(
  before : Int,
  limit : Int,
) -> Int where {
  proof_require: budget_count(before, limit),
  proof_ensure: result => {
    budget_push_step(before, limit, result) && budget_count(result, limit)
  },
  proof_reasoning: (
    #| Below the limit, recording an item increments the counter by one. At the
    #| limit, the analyzer refuses the append and the counter stays fixed. In
    #| both branches the result remains within the declared budget.
  ),
} {
  if before < limit {
    before + 1
  } else {
    before
  }
}

///|
/// Decides whether weighted language evidence is safe to inject.
pub fn score_is_dominant(
  best : Int,
  runner_up : Int,
  threshold : Int,
  margin : Int,
) -> Bool where {
  proof_ensure: result => {
    result == dominant_score(best, runner_up, threshold, margin)
  },
  proof_reasoning: (
    #| Unlabelled syntax injection is allowed only when the winning language has
    #| enough positive evidence and remains separated from the nearest
    #| competitor by a configured margin. Weak or tied fingerprints therefore
    #| fail closed and leave the page unchanged.
  ),
} {
  0 <= runner_up &&
  runner_up <= best &&
  0 < threshold &&
  0 < margin &&
  threshold <= best &&
  runner_up + margin <= best
}
