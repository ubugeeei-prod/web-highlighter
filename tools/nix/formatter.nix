{ ... }:

{
  perSystem =
    { pkgs, ... }:
    {
      formatter = pkgs.writeShellApplication {
        name = "web-highlighter-nixfmt";
        text = ''
          if [[ "$#" -eq 0 ]]; then
            exec ${pkgs.nixfmt}/bin/nixfmt flake.nix tools/nix/*.nix
          fi

          exec ${pkgs.nixfmt}/bin/nixfmt "$@"
        '';
      };
    };
}
