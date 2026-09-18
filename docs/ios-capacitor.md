# Shipping ShinePoint as an iOS app (Capacitor)

Companion to `docs/android-capacitor.md` — same web app, same Capacitor wrapper, different
native shell. The `ios/` project is already generated and committed:

- `capacitor.config.ts` — appId `app.shinepoint`, `webDir: dist` (shared with Android)
- `src/lib/native.js` — `isNative` + OAuth redirect switch (shared)
- `src/components/NativeBridge.jsx` — hides splash, themes status bar, catches the
  `shinepoint://auth/callback` deep link (shared)
- `ios/App/App/Info.plist` — `CFBundleURLTypes` for the `shinepoint://` scheme, plus the
  camera/photo-library/location usage-description strings Apple requires
- `ios/App/App/PrivacyInfo.xcprivacy` — the app-target privacy manifest Apple has required
  since May 2024 (rejects submissions without one); declares the UserDefaults "required reason"
  API most WKWebView apps trigger. **This file exists on disk but still needs to be added to
  the Xcode project** — right-click the `App` group in Xcode → Add Files to "App"→ select it
  (make sure "Copy items if needed" is off and it's added to the App target). Can't be done
  from outside Xcode without hand-editing project.pbxproj, which is too easy to corrupt blind.
- Plugins installed: app, browser, push-notifications, splash-screen, status-bar, and
  `@capacitor-community/background-geolocation` (en-route tracking). Camera and precise
  location do NOT go through a native Capacitor plugin — they're a plain
  `<input type="file" capture="environment">` and `navigator.geolocation` in the WKWebView
  (see `src/components/CarPhotoUpload.jsx`, `src/components/DetailerMap.jsx`). The Info.plist
  usage-description strings below still apply; there's just no `@capacitor/camera` or
  `@capacitor/geolocation` package to know about.
- npm scripts: `npm run cap:sync`, `npm run cap:ios`
- **Windows-generated `Package.swift` gotcha:** every `cap sync` rewrites
  `ios/App/CapApp-SPM/Package.swift` using the host OS's path separator. On Windows that means
  literal backslashes inside Swift string literals (`path: "..\..\..\node_modules\@capacitor\app"`)
  — Swift treats `\` as an escape character, so `\n` there becomes a newline and `\@` isn't a
  valid escape at all, and the file fails to parse the moment Xcode/SwiftPM opens it on a Mac.
  `npm run cap:sync` now runs `scripts/fix-ios-swift-paths.mjs` right after `cap sync` to
  normalize those back to forward slashes — safe to re-run, no-op once already fixed. If you
  ever run a bare `npx cap sync ios` (skipping the npm script), run
  `node scripts/fix-ios-swift-paths.mjs` afterward, or just use `npm run cap:sync` instead.

**Unlike Android, there is no Linux/Windows path here.** Xcode only runs on macOS, and there's
no headless iOS emulator equivalent — you need an actual Mac to do any of this.

---

## Readiness checklist (updated 2026-09-18)

Everything that can be done from Windows without Xcode or a paid account is done. What's left
splits into two groups:

**Needs a Mac + Xcode, but NOT the paid Developer Program ($99/yr) — do these first, on any
Mac, once you have one, even before the account arrives:**
- [ ] Add `PrivacyInfo.xcprivacy` to the Xcode project target (§2 note below) — it exists on
      disk but Xcode won't ship it until it's added via Add Files to "App".
- [ ] Enable the **Background Modes → Location updates** capability (§7b) — the Info.plist key
      alone doesn't turn this on; only Xcode's Signing & Capabilities tab does.
- [ ] Build and run on the Simulator with the free personal team, click through every screen,
      confirm no blank/crash (§5).
- [ ] Confirm the `background-geolocation` plugin actually builds — its own compatibility table
      only lists through Capacitor v7 and this project is on v8 (§7b note); this is the one
      genuinely unverified piece.

**Needs the paid Apple Developer Program account specifically:**
- [ ] Signing with a real Team (not personal) — required for a physical device, TestFlight, or
      any App Store build (§4).
- [ ] Register the `app.shinepoint` App ID in the Developer portal and enable **Push
      Notifications** as a capability on it, if you want native push (§6) — in-app notifications
      already work without this.
- [ ] Create the App Store Connect app record, App Privacy questionnaire, age rating, privacy
      policy URL, screenshots (§8) — same information already worked out for Google Play's Data
      Safety form, just re-entered on Apple's side.
- [ ] Archive → Distribute App → upload → submit for review.

**Already done, nothing to check:**
- `Info.plist` has every usage-description string Apple requires (camera, photo library,
  location, background location) plus `WKAppBoundDomains`, `ITSAppUsesNonExemptEncryption`,
  and the `shinepoint://` URL scheme for OAuth.
- The 1024×1024 App Icon and 2732×2732 splash image are in `Assets.xcassets` at the right
  resolutions (no `@capacitor/assets` regen needed unless the artwork changes).
- `ios/App/App/public` is synced to the current web build.
- The Supabase OAuth redirect URL (`shinepoint://auth/callback`) is shared with Android — one
  entry already covers both platforms; nothing iOS-specific to add there.
- The Windows `Package.swift` backslash-path bug (below) is now self-healing via `cap:sync`.

---

## 1. Install Xcode

From the Mac App Store. Launch it once so it finishes installing components, and accept the
license (`sudo xcodebuild -license accept` if it asks from the terminal). Also install the
command-line tools: `xcode-select --install`.

## 2. Open the project

From the `detailing-marketplace` folder:

```bash
npm install
npm run build            # produces dist/
npx cap sync ios         # copies the web build + plugins into ios/
npm run cap:ios           # opens ios/App/App.xcodeproj in Xcode
```

Capacitor 8 uses Swift Package Manager for plugins (no CocoaPods/`pod install` step, no
`Podfile` — if you've done Capacitor iOS before and expect one, that's why it's missing). Xcode
resolves the Swift packages automatically on first open; give it a minute.

## 3. Register the OAuth deep link (already done in code, verify on Supabase's side)

`ios/App/App/Info.plist` already declares the `shinepoint` URL scheme. The only thing left:

**Supabase** → Authentication → URL Configuration → **Redirect URLs** → add
`shinepoint://auth/callback` if it isn't already there (same entry Android uses — one URL
covers both platforms).

## 4. Signing

Xcode → select the `App` target → **Signing & Capabilities** → pick your Apple ID / team under
**Team**. For just running on the Simulator you don't need a paid Apple Developer account; a
free personal team works. A physical device or TestFlight/App Store release does need the paid
Apple Developer Program ($99/yr).

## 5. Run it

In Xcode, pick a Simulator device from the scheme dropdown at the top (e.g. "iPhone 16") and
press **Run ▶** (or `Cmd+R`). First build takes a while (Swift package resolution + compile);
subsequent runs are fast.

After any web change:

```bash
npm run cap:sync   # rebuilds dist/ and re-copies it into both ios/ and android/
```

then re-run from Xcode (no need to reopen the project).

## 6. Push notifications (optional, do later)

1. Apple Developer portal → Certificates, Identifiers & Profiles → enable **Push Notifications**
   capability for the `app.shinepoint` App ID.
2. In Xcode, add the **Push Notifications** and **Background Modes → Remote notifications**
   capabilities under Signing & Capabilities.
3. Follow `@capacitor/push-notifications`' iOS setup (APNs auth key, upload to whatever backend
   sends the pushes). In-app notifications already work without this.

## 7. Icons + splash

Same asset pipeline as Android:

```bash
npm i -D @capacitor/assets
# put a 1024×1024 icon.png and splash.png (2732×2732) in ./resources
npx @capacitor/assets generate --ios
npx cap sync ios
```

## 7b. Background location for en-route tracking

`@capacitor-community/background-geolocation` posts real GPS pings while a
detailer's job is `en_route` (`src/lib/tracking.js`), even with the phone
locked. `Info.plist` already has the required
`NSLocationAlwaysAndWhenInUseUsageDescription` string + `UIBackgroundModes:
location` array — one more step only Xcode itself can do:

1. Select the `App` target → **Signing & Capabilities** → **+ Capability** →
   add **Background Modes** → check **Location updates** (this is what
   actually makes the `UIBackgroundModes` entry effective; the Info.plist
   key alone doesn't enable it).

**Compatibility note:** this plugin's own README compatibility table only
lists support through Capacitor v7 — this project is on Capacitor 8. The
peer dependency (`@capacitor/core >=3.0.0`) doesn't block installing it and
it was republished recently (Jan 2026), so it may well work, but that's
unverified — there's no Xcode/Android SDK available to actually build and
test this in the environment this was written in. Confirm it builds and a
real background fix arrives on a locked device before shipping; if it
doesn't, `@transistorsoft/capacitor-background-geolocation` is the paid
alternative discussed when this was planned.

## 8. Release build → App Store

1. Xcode → **Product → Archive** (only works with a Release scheme + a real signing team, not
   just the free personal team above).
2. Window → Organizer → select the archive → **Distribute App** → App Store Connect → upload.
3. App Store Connect (appstoreconnect.apple.com) → create the app record → fill in the listing:
   screenshots, description, **privacy policy URL** (point it at your deployed `/privacy` page),
   App Privacy questionnaire (camera/location/photos usage — matches the Info.plist strings
   above), age rating.
4. Submit for review. Apple's review is stricter and slower than Google's — budget more time,
   and expect at least one round of feedback on a first submission.

---

## Gotchas

- **Blank screen in the simulator** = stale build. Re-run `npm run build && npx cap sync ios`.
- **OAuth doesn't return** = the `shinepoint` scheme in Info.plist or the Supabase redirect URL
  doesn't exactly match `shinepoint://auth/callback`.
- **"No such module" / Swift package errors on first open** — File → Packages → Reset Package
  Caches in Xcode, then reopen.
- Phone (SMS) sign-in still needs the Supabase provider turned on — see `docs/sms-auth-setup.md`.
