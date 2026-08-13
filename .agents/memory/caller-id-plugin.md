---
name: Caller ID Plugin
description: withCallerIdAndroid is an EAS-only native plugin; removing it from app.json plugins[] is required for Expo Go dev mode to start.
---

The `./plugin/withCallerIdAndroid` plugin references a native Android module that requires EAS Build. If it remains in `app.json`'s `plugins` array, Expo Go startup throws `PluginError: Failed to resolve plugin`.

**Fix:** Remove `"./plugin/withCallerIdAndroid"` from the `plugins` array in `app.json`. The plugin file in `/plugin/withCallerIdAndroid.ts` can stay — it is excluded by `tsconfig.json` and only runs during EAS Build.

**Why:** Expo Go cannot compile native modules. EAS Build handles the plugin separately.
