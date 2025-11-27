{
  description = "A Nix-flake-based Node.js development environment";

  inputs.nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1"; # unstable Nixpkgs
  inputs.chinese-fonts-overlay.url = "github:lihaoze123/chinese-fonts-overlay/main";

  outputs =
    { self, ... }@inputs:

    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSupportedSystem =
        f:
        inputs.nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            pkgs = import inputs.nixpkgs {
              inherit system;
              overlays = [
                inputs.self.overlays.default
                inputs.chinese-fonts-overlay.overlays.default
              ];

              config.allowUnfree = true;
            };
          }
        );
    in
    {
      overlays.default = final: prev: rec {
        nodejs = prev.nodejs;
        yarn = (prev.yarn.override { inherit nodejs; });
      };

      devShells = forEachSupportedSystem (
        { pkgs }:
        {
          default = pkgs.mkShellNoCC {
            buildInputs = [
              pkgs.fontconfig
            ];
            packages = with pkgs; [
              node2nix
              nodejs
              nodePackages.pnpm
              yarn
              typst
            ];
            shellHook = ''
              export FONTCONFIG_FILE=${pkgs.makeFontsConf {
                fontDirectories = with pkgs; [ foundertype-fonts cm_unicode ];
              }}
            '';
          };
        }
      );
    };
}
