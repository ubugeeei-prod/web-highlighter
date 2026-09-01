///|
/// Advances a synthetic cursor to a known limit.
///
/// This proof kernel is the neighbor of `src/scanner.mbt` because it models the
/// scanner's many "walk until a delimiter, newline, or token boundary" loops.
/// The body deliberately ignores source contents; the loop invariant proves the
/// monotonic bounded shape those loops must preserve before they hand a span to
/// the emitter.
pub fn walk_to_limit(
  length : Int,
  start : Int,
  limit : Int,
) -> Int where {
  proof_require: bounded_span(start, limit, length),
  proof_ensure: result => {
    result == limit && @cursor_proof.bounded_cursor(result, length)
  },
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
    proof_invariant: @cursor_proof.bounded_cursor(cursor, length),
    proof_invariant: @cursor_proof.bounded_cursor(limit, length),
    proof_yield: result => {
      result == limit && @cursor_proof.bounded_cursor(result, length)
    },
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
/// This is the executable mirror of `bounded_span` and stays beside the scanner
/// because all token, symbol, and renderer spans are emitted from this owner.
pub fn span_is_bounded(
  start : Int,
  end_ : Int,
  length : Int,
) -> Bool where {
  proof_ensure: result => result == bounded_span(start, end_, length),
  proof_reasoning: (
    #| The executable guard and the predicate are intentionally the same
    #| half-open interval formula. Tests use the executable form as a regression
    #| oracle, while `bounded_span` remains the logic-side proof name.
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
    #| Tokens, definitions, and references use half-open DOM ranges. A zero
    #| width range would be impossible to render without inventing a synthetic
    #| text position, so the scanner rejects it before it reaches the wire plan.
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
    #| a non-empty span, and non-overlap. The scanner and the JS decoder both
    #| use this shape so malformed or overlapping plans are discarded at every
    #| boundary where they could otherwise create invalid DOM surgery.
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
    result == end_ &&
    @cursor_proof.bounded_cursor(result, length) &&
    cursor < result
  },
  proof_reasoning: (
    #| `ordered_span_after` gives `cursor <= start < end <= length`. Returning
    #| `end` therefore advances the emitted-token cursor while keeping it a
    #| valid half-open UTF-16 boundary for the next append.
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
    #| end produces a strictly positive width. This is the renderer-side fact
    #| needed when replacing one source slice by exactly one highlighted span.
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
    @cursor_proof.bounded_cursor(result, length) &&
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
    #| the source. The end offset is exactly `start + prefix_length`, giving the
    #| scanner a non-empty bounded span for comments and delimiters.
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
    #| end. This checker names the invariant shared by comments and strings so
    #| tests can validate unterminated and escaped paths uniformly.
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
    #| Line metadata starts from one and only adds newline totals over bounded
    #| source slices. The executable predicate gives tests a direct way to
    #| assert that arithmetic never falls out of the natural-number model.
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
/// Decides whether an output array may accept one more item.
pub fn item_budget_allows(
  count : Int,
  limit : Int,
) -> Bool where {
  proof_ensure: result => result == can_push_item(count, limit),
  proof_reasoning: (
    #| The append decision is a natural-number counter check. Tokens,
    #| definitions, references, and deferred reference candidates all use it, so
    #| every potentially large output path shares one verified formula.
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
