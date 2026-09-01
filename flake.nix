{
  description = "Reproducible Web Highlighter development and release environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/d407951447dcd00442e97087bf374aad70c04cea";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import ./tools/nix/systems.nix;

      imports = [
        ./tools/nix/pkgs.nix
        ./tools/nix/moonbit.nix
        ./tools/nix/vp.nix
        ./tools/nix/packages.nix
        ./tools/nix/formatter.nix
        ./tools/nix/dev-shell.nix
      ];
    };
}
