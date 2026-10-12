const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// Doodle shared source and public build configuration are bundle inputs";
const BUNDLE_INPUTS = `
// Doodle shared source and public build configuration are bundle inputs.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.dir(new File(rootDir, '../../src')).withPropertyName('doodleSharedSource')
    [
        'EXPO_PUBLIC_NATIVE_FIXTURE_MODE',
        'EXPO_PUBLIC_API_BASE_URL',
        'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
        'EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER',
        'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
    ].each { name ->
        inputs.property("doodlePublicConfig.\${name}", System.getenv(name) ?: '')
    }
}
`;

/** Metro imports shared code outside mobile. Gradle must also track that code. */
module.exports = function withDoodleSharedBundleInputs(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") {
      throw new Error("Doodle shared bundle inputs require a Groovy app build");
    }
    if (!mod.modResults.contents.includes(MARKER)) mod.modResults.contents += BUNDLE_INPUTS;
    return mod;
  });
};
