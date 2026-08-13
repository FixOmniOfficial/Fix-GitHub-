/**
 * Expo Config Plugin — Android Caller ID
 *
 * Adds READ_PHONE_STATE to AndroidManifest.xml.
 * The BroadcastReceiver is registered dynamically from JS/Kotlin, so no
 * manifest <receiver> entry is needed (avoids background data concerns).
 *
 * Usage in app.json:
 *   "plugins": ["./plugin/withCallerIdAndroid"]
 */
import { type ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';

const withCallerIdAndroid: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const mainApplication = manifest.manifest['uses-permission'] ?? [];

    const PERM = 'android.permission.READ_PHONE_STATE';

    const alreadyAdded = mainApplication.some(
      (p: any) => p.$?.['android:name'] === PERM
    );

    if (!alreadyAdded) {
      manifest.manifest['uses-permission'] = [
        ...mainApplication,
        { $: { 'android:name': PERM } },
      ];
    }

    return mod;
  });
};

export default withCallerIdAndroid;
