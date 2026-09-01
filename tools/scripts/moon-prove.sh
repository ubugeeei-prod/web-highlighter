#!/usr/bin/env bash
set -euo pipefail

config="$(mktemp)"
trap 'rm -f "$config"' EXIT

moon_bin="$(command -v moon)"
moon_home="${MOON_HOME:-$(cd "$(dirname "$moon_bin")/.." && pwd)}"
prover_path="$(command -v cvc5)"

cat >"$config" <<EOF
[main]
magic = 14
datadir = "$moon_home/share/why3"
libdir = "$moon_home/lib/why3"
memlimit = 0
running_provers_max = 1
timelimit = 5.000000

[partial_prover]
name = "CVC5"
path = "$prover_path"
version = ""

[strategy]
code = "start:
c CVC5, .2 0
c CVC5, 1 0
t compute_specified start
t split_vc start
c CVC5, 2 0
"
desc = "MoonBit CI single CVC5 strategy"
name = "MoonBit_CI_CVC5"
shortcut = "4"
EOF

targets=(
  src/cursor_contract
  src/scanner_contract
  src/model_contract
  src/detection_contract
  src/sweep_contract
  src/theme_contract
)

if [[ $# -gt 0 ]]; then
  targets=("$@")
fi

for target in "${targets[@]}"; do
  "$moon_bin" prove --deny-warn --jobs 1 --why3-config "$config" "$target"
done
