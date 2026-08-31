#!/usr/bin/env bash
set -euo pipefail

config="$(mktemp)"
trap 'rm -f "$config"' EXIT

moon_bin="$(command -v moon)"
moon_home="${MOON_HOME:-$(cd "$(dirname "$moon_bin")/.." && pwd)}"
prover_path="$(command -v z3)"
prover_version="$(z3 --version | awk '{ print $3 }')"

cat >"$config" <<EOF
[main]
magic = 14
datadir = "$moon_home/share/why3"
libdir = "$moon_home/lib/why3"
memlimit = 256
running_provers_max = 1
timelimit = 5.000000

[partial_prover]
name = "Z3"
path = "$prover_path"
version = "$prover_version"

[strategy]
code = "start:
c Z3,$prover_version .2 128
c Z3,$prover_version 1 256
t compute_specified start
t split_vc start
c Z3,$prover_version 2 512
"
desc = "MoonBit CI single prover strategy"
name = "MoonBit_CI"
shortcut = "4"
EOF

"$moon_bin" prove --deny-warn --jobs 1 --why3-config "$config" src/proof "$@"
