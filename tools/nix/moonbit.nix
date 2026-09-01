{ ... }:

{
  perSystem =
    {
      pkgs,
      system,
      ...
    }:
    let
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

      moonArchive = pkgs.fetchurl {
        url = "https://cli.moonbitlang.com/binaries/latest/moonbit-${moonPlatform.name}.tar.gz";
        inherit (moonPlatform) hash;
      };

      moonCore = pkgs.fetchurl {
        url = "https://cli.moonbitlang.com/cores/core-latest.tar.gz";
        hash = "sha256-ZhQl35u4/3yxSX3Tyyioc7Wkdvs7B8WHoiVFP/0KqbQ=";
      };
    in
    {
      packages.moonbit =
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
    };
}
