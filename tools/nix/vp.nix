{ ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    let
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

      workspacePrelude = ''
        workspace_root="''${WEB_HIGHLIGHTER_WORKSPACE_ROOT:-}"
        if [[ -z "$workspace_root" ]]; then
          workspace_root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
        fi
        cd "$workspace_root"
      '';
    in
    {
      packages.vp = pkgs.writeShellApplication {
        name = "vp";
        text = ''
          ${workspacePrelude}

          # The Darwin launcher delegates to the project-local package. Keep the
          # first dependency install bootstrappable through the pinned launcher.
          if [[ "$#" -gt 0 && "$1" == "install" && ! -f node_modules/vite-plus/dist/bin.js ]]; then
            exec ${pkgs.pnpm}/bin/pnpm "$@"
          fi

          exec ${vitePlusBinary}/bin/vp "$@"
        '';
      };

      packages.vpr = pkgs.writeShellApplication {
        name = "vpr";
        text = ''
          ${workspacePrelude}

          if [[ "$#" -gt 0 && "$1" == "install" ]]; then
            shift
            exec ${config.packages.vp}/bin/vp install --frozen-lockfile "$@"
          fi

          if [[ "$#" -gt 0 && "$1" == "ready" ]]; then
            shift
            ${config.packages.vp}/bin/vp install --frozen-lockfile
            exec ${config.packages.vp}/bin/vp run ready "$@"
          fi

          exec ${config.packages.vp}/bin/vp run "$@"
        '';
      };
    };
}
