const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// Doodle local preview build types";

/**
 * Keep the local-only APK variants available after a clean Expo prebuild.
 * Both variants use package suffixes, so they cannot replace the Play package.
 * The fixture variant is a bundled, release-like UI check with its own
 * package id. Its runtime is selected only when that id and an explicit
 * fixture flag both match.
 */
module.exports = function withDoodleLocalBuildTypes(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy" || mod.modResults.contents.includes(MARKER)) return mod;

    const buildTypes = `
        ${MARKER}
        // Bundled local preview that can coexist with the Play package and
        // the older debug install on the QA emulator. Release keeps the
        // production application id unchanged.
        preview {
            initWith release
            applicationIdSuffix '.preview'
            matchingFallbacks = ['release']
            debuggable false
        }
        // Bundled presentation fixture. It inherits release resources so the
        // Expo development launcher cannot intercept the direct app launch.
        // The runtime still requires the explicit fixture flag and this exact
        // package id, and is never suitable for distribution verification.
        fixture {
            initWith release
            applicationIdSuffix '.fixture'
            matchingFallbacks = ['release']
            debuggable false
        }
`;

    const boundary = /\n    }\n    packagingOptions \{/;
    if (!boundary.test(mod.modResults.contents)) throw new Error("Doodle build type insertion point was not found");
    mod.modResults.contents = mod.modResults.contents.replace(boundary, `${buildTypes}    }\n    packagingOptions {`);
    return mod;
  });
};
