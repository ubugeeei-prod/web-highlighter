///|
/// Decides whether weighted language evidence is safe to inject.
///
/// This proof kernel is the neighbor of `src/detection.mbt` because Discord and
/// other chat surfaces often discard language metadata, so this predicate is
/// the fail-closed boundary between evidence and page mutation.
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
