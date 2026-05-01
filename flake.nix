{
  description = "GemiDesk - Native Desktop Client for Gemini";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        
        gemidesk = pkgs.buildNpmPackage {
          pname = "gemidesk";
          version = "1.0.0";
          
          src = ./.;
          
          npmDepsHash = "sha256-PxILrezBUh72+jp31uq2oNf7GAcbA2wEQ59HJ4P51os=";
          
          npmBuildScript = "build-nix";
          
          nativeBuildInputs = with pkgs; [
            copyDesktopItems
            makeWrapper
          ];
          
          buildInputs = with pkgs; [
            nodejs_20
            electron
          ];

          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

          postInstall = ''
            mkdir -p $out/lib/node_modules/gemidesk
            cp -r dist dist-electron package.json $out/lib/node_modules/gemidesk/
            
            mkdir -p $out/share/icons/hicolor/512x512/apps
            cp assets/icons/logo.png $out/share/icons/hicolor/512x512/apps/gemidesk.png
            
            makeWrapper ${pkgs.electron}/bin/electron $out/bin/gemidesk \
              --add-flags $out/lib/node_modules/gemidesk/dist-electron/main/main.js \
              --set ELECTRON_FORCE_IS_PACKAGED 1
          '';

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "gemidesk";
              exec = "gemidesk";
              icon = "gemidesk";
              desktopName = "GemiDesk";
              genericName = "Gemini Desktop Client";
              categories = [ "Office" "Network" ];
              startupWMClass = "GemiDesk";
            })
          ];
        };
      in {
        packages.default = gemidesk;
        
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            electron
            pkg-config
          ];

          shellHook = ''
            export ELECTRON_SKIP_BINARY_DOWNLOAD=1
            export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron}/bin"
          '';
        };
      }
    );
}
