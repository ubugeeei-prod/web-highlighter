{ ... }:

{
  perSystem =
    { config, ... }:
    {
      packages.default = config.packages.vpr;

      apps = {
        default = {
          type = "app";
          program = "${config.packages.vpr}/bin/vpr";
        };
        vp = {
          type = "app";
          program = "${config.packages.vp}/bin/vp";
        };
        vpr = {
          type = "app";
          program = "${config.packages.vpr}/bin/vpr";
        };
      };
    };
}
