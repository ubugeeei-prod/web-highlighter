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
memlimit = 2048
running_provers_max = 1
timelimit = 5.000000

[partial_prover]
name = "CVC5"
path = "$prover_path"
version = ""

[strategy]
code = "start:
c CVC5, .2 1024
c CVC5, 1 1024
t compute_specified start
t split_vc start
c CVC5, 2 2048
"
desc = "MoonBit CI single CVC5 strategy"
name = "MoonBit_CI_CVC5"
shortcut = "4"
EOF

"$moon_bin" prove --deny-warn --jobs 1 --why3-config "$config" src/proof "$@"
