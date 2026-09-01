{ ... }:

{
  perSystem =
    { config, pkgs, ... }:
    {
      devShells.default = pkgs.mkShell {
        packages = [
          config.packages.moonbit
          config.packages.vp
          config.packages.vpr
          pkgs.nodejs_24
          pkgs.pnpm
          pkgs.git
          pkgs.gh
          pkgs.nixfmt
          pkgs.why3
          pkgs.cvc5
          pkgs.z3
          pkgs.actionlint
          pkgs.zip
          pkgs.unzip
        ];

        shellHook = ''
          export WEB_HIGHLIGHTER_WORKSPACE_ROOT="$PWD"
          export MOON_HOME="${config.packages.moonbit}"
          export PATH="$WEB_HIGHLIGHTER_WORKSPACE_ROOT/node_modules/.bin:$PATH"
        '';
      };
    };
}
