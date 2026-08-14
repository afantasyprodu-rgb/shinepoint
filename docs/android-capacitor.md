# Shipping ShinePoint as an Android app (Capacitor)

See `docs/ios-capacitor.md` for the iOS side of this same setup.

The web app is already wrapped for Capacitor in code:

- `capacitor.config.ts` — appId `app.shinepoint`, `webDir: dist`
- `src/lib/native.js` — `isNative` + OAuth redirect switch
- `src/components/NativeBridge.jsx` — hides splash, themes status bar, catches the
  `shinepoint://auth/callback` deep link and finishes Google sign-in
- `AuthCard` opens Google OAuth in the system browser on native
- Plugins installed: app, browser, camera, geolocation, push-notifications, splash-screen, status-bar
- npm scripts: `npm run cap:sync`, `npm run cap:android`

What's left needs **Android Studio + the Android SDK** on your machine — do it once.

---

## 1. Install Android Studio

Download from developer.android.com/studio. During setup let it install the
Android SDK + an emulator image. Confirm `JAVA_HOME` points at a JDK 17.

## 2. Generate the native project

From the `detailing-marketplace` folder:

```bash
npm run build            # produces dist/
npx cap add android      # creates the android/ native project (one time)
npx cap sync             # copies the web build + plugins in
```

Commit the `android/` folder (build artifacts are gitignored).

## 3. Register the OAuth deep link

The app returns from Google via `shinepoint://auth/callback`. Tell every party about it.

**a) AndroidManifest** — `android/app/src/main/AndroidManifest.xml`, inside the main
`<activity>`, add an intent filter:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="shinepoint" android:host="auth" />
</intent-filter>
```

**b) Supabase** → Authentication → URL Configuration → **Redirect URLs**: add
`shinepoint://auth/callback`.

**c) Google Cloud Console** (the OAuth client Supabase uses) → Authorized redirect URIs
already point at Supabase's callback; no change needed there — Supabase relays to the scheme.

## 4. Permissions

Add to `AndroidManifest.xml` (camera + location are used by the job flow + map):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

The camera/geolocation Capacitor plugins prompt the user at runtime; the `<input capture>`
fields keep working in the webview as a fallback.

## 4b. Background location for en-route tracking

`@capacitor-community/background-geolocation` posts real GPS pings while a
detailer's job is `en_route` (`src/lib/tracking.js`), even with the phone
locked. `AndroidManifest.xml` already declares
`ACCESS_BACKGROUND_LOCATION`; the plugin's own manifest (merged
automatically by `cap sync`) brings the foreground-service permissions and
service declaration. Nothing further needed on Android beyond a real device
test — the emulator's simulated location doesn't exercise the "locked
screen" case that matters here.

See `docs/ios-capacitor.md`'s equivalent section for the Capacitor-8
compatibility caveat on this plugin (same plugin, same caveat, both
platforms) — it hasn't been build-tested in the environment this was
written in.

## 5. Push notifications (optional, do later)

1. Create a Firebase project, add an Android app with id `app.shinepoint`.
2. Download `google-services.json` into `android/app/` (gitignored — keep it local/CI secret).
3. Follow @capacitor/push-notifications setup; register the device token against your backend
   when you build the push-send side. In-app notifications already work without this.

## 6. Icons + splash

```bash
npm i -D @capacitor/assets
# put a 1024×1024 icon.png and splash.png (2732×2732) in ./resources
npx @capacitor/assets generate --android
```

## 7. Run it

```bash
npm run cap:sync
npm run cap:android      # opens Android Studio
```

Press Run to launch on an emulator or a USB device (enable USB debugging). After any web
change: `npm run cap:sync` again.

## 8. Release build → Play Store

1. Android Studio → Build → Generate Signed Bundle/APK → **Android App Bundle (.aab)**.
2. Create an upload keystore (keep the `.jks` safe + out of git — already gitignored).
3. Play Console → create app → upload the `.aab`.
4. Fill the listing: name, screenshots, description, **privacy policy URL** (point it at your
   deployed `/privacy` page), data-safety form, content rating.
5. Submit for review.

---

## Gotchas

- **Blank screen on device** = `webDir` mismatch or stale build. Re-run `npm run build && npx cap sync`.
- **OAuth doesn't return** = the intent filter scheme/host or the Supabase redirect URL doesn't
  exactly match `shinepoint://auth/callback`.
- Phone (SMS) sign-in still needs the Supabase provider turned on — see `docs/sms-auth-setup.md`.
