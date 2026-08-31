///|
/// Rebuilds the host's ordered DOM segments: one rendered slice per source line.
fn line_segments(source : String) -> Array[(Int, Int)] {
  let segments : Array[(Int, Int)] = []
  let mut start = 0
  for index in 0..<source.length() {
    if source[index].to_int() == '\n'.to_int() {
      segments.push((start, index))
      start = index + 1
    }
  }
  segments.push((start, source.length()))
  segments
}

///|
/// Mirrors the browser renderer: one forward cursor over segments and tokens.
///
/// Skipping and stopping are sound only because emitted tokens are ordered and
/// non-overlapping, which `skipped_token_cannot_cover`,
/// `stopped_token_cannot_cover`, `skipped_token_skips_its_prefix`, and
/// `stopped_token_stops_its_suffix` prove in the verified kernel.
fn swept_token_indexes(
  tokens : Array[Token],
  segments : Array[(Int, Int)],
) -> Array[Array[Int]] {
  let covered : Array[Array[Int]] = []
  let mut head = 0
  for segment in segments {
    while head < tokens.length() &&
          @proof.span_precedes_segment(tokens[head].span.end_, segment.0) {
      head = head + 1
    }
    let indexes : Array[Int] = []
    let mut index = head
    while index < tokens.length() &&
          !@proof.span_follows_segment(tokens[index].span.start, segment.1) {
      indexes.push(index)
      index = index + 1
    }
    covered.push(indexes)
  }
  covered
}

///|
/// Scans every token for every segment, the cost the sweep is meant to remove.
fn scanned_token_indexes(
  tokens : Array[Token],
  segments : Array[(Int, Int)],
) -> Array[Array[Int]] {
  let covered : Array[Array[Int]] = []
  for segment in segments {
    let indexes : Array[Int] = []
    for index in 0..<tokens.length() {
      if @proof.span_covers_segment(
          tokens[index].span.start,
          tokens[index].span.end_,
          segment.0,
          segment.1,
        ) {
        indexes.push(index)
      }
    }
    covered.push(indexes)
  }
  covered
}

///|
test "the renderer sweep matches a full token scan on every line" {
  let cases = [
    "fn greet() {\n  print(\"hi\")\n}", "/* multi\n\n   line */\nlet x = 1\nx", "let s = \"unterminated\nlet t = 2",
    "// trailing comment", "\n\n\n", "let $\u{10401} = 1\n$\u{10401}", "fn a() {}\nfn b() {}\na\nb",
  ]
  for source in cases {
    let analysis = analyze(test_language(), source)
    assert_analysis_safe(analysis, source)
    let segments = line_segments(source)
    assert_eq(
      swept_token_indexes(analysis.tokens, segments),
      scanned_token_indexes(analysis.tokens, segments),
    )
  }
}
