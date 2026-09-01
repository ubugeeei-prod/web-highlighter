///|
/// Decides whether a source length is allowed by an analyzer budget.
///
/// This proof kernel is the neighbor of `src/model.mbt` because oversize
/// rejection is part of the core data model, not a host-page convention.
pub fn source_length_is_allowed(
  length : Int,
  limit : Int,
) -> Bool where {
  proof_ensure: result => result == source_length_allowed(length, limit),
  proof_reasoning: (
    #| Oversize rejection must be owned by the Wasm analyzer, not by a host page
    #| that may be missing a selector edge case. The executable formula and the
    #| logic predicate are the same non-negative bounded counter check.
  ),
} {
  0 <= length && 0 <= limit && length <= limit
}
