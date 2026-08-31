{
  description = "Reproducible Web Highlighter development and release environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/d407951447dcd00442e97087bf374aad70c04cea";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      mkTools =
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          moonPlatform =
            {
              aarch64-darwin = {
                name = "darwin-aarch64";
                hash = "sha256-n2F8mueLCOGTVOcKQgPCFX/1Nzx4w0CuvnIog0Qa5bU=";
              };
              x86_64-linux = {
                name = "linux-x86_64";
                hash = "sha256-lXP031b/f+maogDd6rw3mRnoAgPDeYZkLY50rdGn574=";
              };
            }
            .${system};
          vpPlatform =
            {
              aarch64-darwin = {
                name = "aarch64-apple-darwin";
                hash = "sha256-0+eh5oK2Qhbj2pOTcdclm4I47CHeQp0DmRwZg6gqlh4=";
              };
              x86_64-linux = {
                name = "x86_64-unknown-linux-gnu";
                hash = "sha256-aOAquir4d8OPGepADnMB0IPqGOrYdx3IB1eBLCSsxNA=";
              };
            }
            .${system};
          moonArchive = pkgs.fetchurl {
            url = "https://cli.moonbitlang.com/binaries/latest/moonbit-${moonPlatform.name}.tar.gz";
            inherit (moonPlatform) hash;
          };
          moonCore = pkgs.fetchurl {
            url = "https://cli.moonbitlang.com/cores/core-latest.tar.gz";
            hash = "sha256-ZhQl35u4/3yxSX3Tyyioc7Wkdvs7B8WHoiVFP/0KqbQ=";
          };
          moonbit =
            pkgs.runCommand "moonbit-0.1.20260827"
              {
                nativeBuildInputs = [
                  pkgs.gnutar
                ]
                ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.autoPatchelfHook ];
                buildInputs = pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.stdenv.cc.cc.lib ];
              }
              ''
                mkdir -p "$out/lib"
                tar -xzf ${moonArchive} -C "$out"
                tar -xzf ${moonCore} -C "$out/lib"
                find "$out/bin" -type f -exec chmod +x {} +
                ${pkgs.lib.optionalString pkgs.stdenv.isLinux ''autoPatchelf "$out"''}
                (cd "$out/lib/core" && MOON_HOME="$out" "$out/bin/moon" bundle --target wasm-gc --release)
              '';
          vitePlusArchive = pkgs.fetchurl {
            url = "https://github.com/voidzero-dev/vite-plus/releases/download/v0.3.0/vp-${vpPlatform.name}.tar.gz";
            inherit (vpPlatform) hash;
          };
          vitePlusBinary =
            pkgs.runCommand "vite-plus-0.3.0"
              {
                nativeBuildInputs = [
                  pkgs.gnutar
                ]
                ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.autoPatchelfHook ];
                buildInputs = pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.stdenv.cc.cc.lib ];
              }
              ''
                mkdir -p "$out/bin"
                tar -xzf ${vitePlusArchive} -C "$out/bin"
                chmod +x "$out/bin/vp"
                ${pkgs.lib.optionalString pkgs.stdenv.isLinux ''autoPatchelf "$out"''}
              '';
          vitePlus = pkgs.writeShellApplication {
            name = "vp";
            text = ''
              # The Darwin launcher delegates to the project-local package. Keep the
              # first dependency install bootstrappable through the pinned launcher.
              if [[ "$#" -gt 0 && "$1" == "install" && ! -f node_modules/vite-plus/dist/bin.js ]]; then
                exec ${pkgs.pnpm}/bin/pnpm "$@"
              fi
              exec ${vitePlusBinary}/bin/vp "$@"
            '';
          };
          vitePlusRun = pkgs.writeShellApplication {
            name = "vpr";
            text = ''
              if [[ "$#" -gt 0 && "$1" == "install" ]]; then
                shift
                exec ${vitePlus}/bin/vp install --frozen-lockfile "$@"
              fi

              if [[ "$#" -gt 0 && "$1" == "ready" ]]; then
                shift
                ${vitePlus}/bin/vp install --frozen-lockfile
                exec ${vitePlus}/bin/vp run ready "$@"
              fi

              exec ${vitePlus}/bin/vp run "$@"
            '';
          };
        in
        {
          inherit moonbit vitePlus;
          vpr = vitePlusRun;
          default = vitePlusRun;
        };
    in
    {
      packages = forAllSystems mkTools;

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          tools = mkTools system;
        in
        {
          default = pkgs.mkShell {
            packages = [
              tools.moonbit
              tools.vitePlus
              tools.vpr
              pkgs.nodejs_24
              pkgs.pnpm
              pkgs.git
              pkgs.gh
              pkgs.why3
              pkgs.cvc5
              pkgs.z3
              pkgs.actionlint
              pkgs.zip
              pkgs.unzip
            ];
            shellHook = ''
              export MOON_HOME="${tools.moonbit}"
            '';
          };
        }
      );

      formatter = forAllSystems (system: (import nixpkgs { inherit system; }).nixfmt);
    };
}
