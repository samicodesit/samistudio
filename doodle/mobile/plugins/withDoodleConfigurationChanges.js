const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

module.exports = function withDoodleConfigurationChanges(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    // React Native handles live display/font metrics. Preserve the draft and
    // system picker registration when the user adjusts these in Settings.
    const changes = new Set((activity.$["android:configChanges"] || "").split("|").filter(Boolean));
    changes.add("fontScale");
    changes.add("density");
    activity.$["android:configChanges"] = [...changes].join("|");
    return mod;
  });
};
