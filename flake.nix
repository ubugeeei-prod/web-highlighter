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
                hash = "sha256-n5SWgs+/Q4t6qcqT1E/kYt1sUi2JsLm9Ofh9q/jYZVE=";
              };
              x86_64-linux = {
                name = "linux-x86_64";
                hash = "sha256-Mbf8XMeGV5ZKbVRXkuzX+47tUbl8dDGhdFi1hzQwM4E=";
              };
            }
            .${system};
          vpPlatform =
            {
              aarch64-darwin = {
                name = "aarch64-apple-darwin";
                hash = "sha256-s7sbXQsgUrl9PHso/Eodl1Wu+XKSR8ZSkiiRUc0B2Mo=";
              };
              x86_64-linux = {
                name = "x86_64-unknown-linux-gnu";
                hash = "sha256-qA914Zwqko85EN94Qnqftk9/pUzg0mIaYIFwFvHPzJ0=";
              };
            }
            .${system};
          moonArchive = pkgs.fetchurl {
            url = "https://cli.moonbitlang.com/binaries/latest/moonbit-${moonPlatform.name}.tar.gz";
            inherit (moonPlatform) hash;
          };
          moonCore = pkgs.fetchurl {
            url = "https://cli.moonbitlang.com/cores/core-latest.tar.gz";
            hash = "sha256-A61VuZ8+Qx88uBtOK7KLuYFzME5KGxiokeoCfKu6XRw=";
          };
          moonbit =
            pkgs.runCommand "moonbit-0.1.20260713"
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
            url = "https://github.com/voidzero-dev/vite-plus/releases/download/v0.2.4/vp-${vpPlatform.name}.tar.gz";
            inherit (vpPlatform) hash;
          };
          vitePlus =
            pkgs.runCommand "vite-plus-0.2.4"
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
        in
        {
          inherit moonbit vitePlus;
          default = vitePlus;
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
              pkgs.nodejs_24
              pkgs.pnpm
              pkgs.git
              pkgs.gh
              pkgs.zip
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
