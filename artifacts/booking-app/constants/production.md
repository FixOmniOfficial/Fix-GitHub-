# Fix Omni — Play Store / Production Readiness Checklist

## ✅ Done (already in place)
- `EXPO_PUBLIC_API_URL` used for all API calls (no hardcoded localhost)
- Admin panel gated behind PIN (safe to ship in APK)
- Sandbox tools only in Service Center admin panel (super_admin, web-only)
- Customer app UI is clean — no debug overlays, no test buttons
- `app.json` has correct Android package `com.bookservice.app`
- `app.json` name set to "Fix Omni"
- `__DEV__` flag from React Native automatically `false` in production builds

## 📋 Before Submitting to Play Store

### 1. EAS Build Setup
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### 2. EAS Secrets (production env vars)
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-api.replit.app"
eas secret:create --scope project --name EXPO_PUBLIC_APP_ENV --value "production"
```

### 3. Build APK / AAB
```bash
# APK for testing
eas build --platform android --profile preview

# AAB for Play Store submission
eas build --platform android --profile production
```

### 4. Supabase Migration (when ready)
Add these in Replit Secrets (no code changes needed):
- `SUPABASE_DB_URL` — Supabase project → Settings → Database → URI
- Remove or keep `DATABASE_URL` as fallback

### 5. app.json fields to verify before submission
- `android.package` — com.bookservice.app (change if needed)
- `android.versionCode` — increment for each Play Store release
- `version` — user-facing version string
- `android.permissions` — review for minimum required

## 🔒 Security
- All API routes are auth-gated (Clerk for admin, OTP for technicians)
- Sandbox routes: super_admin only, not accessible from customer app
- No API keys or secrets bundled in the app — all via EXPO_PUBLIC_* vars
