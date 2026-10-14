const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

module.exports = function withDoodleConfigurationChanges(config) {
  return withAndroidManifest(config, (mod) => {
    // The picker does not use camera capture. Explicitly keep camera hardware
    // optional, including when lint inspects removed library permissions.
    const features = mod.modResults.manifest["uses-feature"] ?? [];
    const camera = features.find((feature) => feature.$?.["android:name"] === "android.hardware.camera");
    if (camera) camera.$["android:required"] = "false";
    else features.push({ $: { "android:name": "android.hardware.camera", "android:required": "false" } });
    mod.modResults.manifest["uses-feature"] = features;
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
