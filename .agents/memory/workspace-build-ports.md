---
name: Workspace build ports
description: Build-time port handling for parallel web and Expo artifact builds
---

# Workspace build ports

**The rule:** Static Vite bundles must provide safe defaults when `PORT` and `BASE_PATH` are absent; workflow-provided values still override at runtime. The Expo static exporter must select an available Metro port unless `EXPO_BUILD_METRO_PORT` explicitly chooses one.

**Why:** Root `npm run build` builds artifacts in parallel. A Vite preview workflow can occupy the Expo exporter's previous fixed Metro port, causing Expo to stop for a non-interactive “use another port?” prompt even though TypeScript and application code are valid.

**How to apply:** Keep port validation for explicit values, but never make static bundle builds depend on a running workflow's injected port. Test changes with the root build command while normal workflows are running.