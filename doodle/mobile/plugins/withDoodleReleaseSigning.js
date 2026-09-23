const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// Doodle release signing from external environment";

/**
 * Keep the upload keystore outside the repository. Real release tasks require
 * all four external values; local preview and fixture variants intentionally
 * remain debug-signed and never read or copy the production key.
 */
module.exports = function withDoodleReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy" || mod.modResults.contents.includes(MARKER)) return mod;

    const signingInputs = `
// Doodle release signing from external environment
def doodleReleaseSigningValues = [
    System.getenv('DOODLE_UPLOAD_STORE_FILE'),
    System.getenv('DOODLE_UPLOAD_STORE_PASSWORD'),
    System.getenv('DOODLE_UPLOAD_KEY_ALIAS'),
    System.getenv('DOODLE_UPLOAD_KEY_PASSWORD'),
]
def doodleReleaseSigningReady = doodleReleaseSigningValues.every { value -> value != null && !value.trim().isEmpty() }
def doodleReleaseRequested = gradle.startParameter.taskNames.any { task -> task.toLowerCase(Locale.ROOT).contains('release') }
if (doodleReleaseRequested && !doodleReleaseSigningReady) {
    throw new GradleException('Doodle release signing requires DOODLE_UPLOAD_STORE_FILE, DOODLE_UPLOAD_STORE_PASSWORD, DOODLE_UPLOAD_KEY_ALIAS, and DOODLE_UPLOAD_KEY_PASSWORD')
}
`;
    const androidBoundary = "android {";
    if (!mod.modResults.contents.includes(androidBoundary)) throw new Error("Doodle Android block insertion point was not found");
    mod.modResults.contents = mod.modResults.contents.replace(androidBoundary, `${signingInputs}\n${androidBoundary}`);

    const debugSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (doodleReleaseSigningReady) {
                storeFile file(doodleReleaseSigningValues[0])
                storePassword doodleReleaseSigningValues[1]
                keyAlias doodleReleaseSigningValues[2]
                keyPassword doodleReleaseSigningValues[3]
            }
        }
    }`;
    const existingSigning = /    signingConfigs \{[\s\S]*?\n    \}\n    buildTypes \{/;
    if (!existingSigning.test(mod.modResults.contents)) throw new Error("Doodle signing config insertion point was not found");
    mod.modResults.contents = mod.modResults.contents.replace(existingSigning, `${debugSigning}\n    buildTypes {`);
    mod.modResults.contents = mod.modResults.contents.replace(
      "            signingConfig = signingConfigs.debug\n            def enableShrinkResources",
      "            signingConfig = signingConfigs.release\n            def enableShrinkResources",
    );
    mod.modResults.contents = mod.modResults.contents.replace(
      /(        preview \{[\s\S]*?            debuggable false)\n        \}/,
      "$1\n            signingConfig = signingConfigs.debug\n        }",
    );
    mod.modResults.contents = mod.modResults.contents.replace(
      "            debuggable false\n        }\n    }\n    packagingOptions",
      "            debuggable false\n            signingConfig = signingConfigs.debug\n        }\n    }\n    packagingOptions",
    );
    return mod;
  });
};
