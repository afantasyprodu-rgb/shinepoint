# Store submission requirements you'll hit in 2026

Researched while setting up the Android/iOS wrappers — things that apply on top of the basic
Capacitor build steps in `docs/android-capacitor.md` / `docs/ios-capacitor.md`. Both stores
tightened rules in 2025-2026, partly in response to the flood of AI-assisted "vibe coded" apps.

## Does building this with AI need to be disclosed anywhere?

**No — checked both platforms, neither requires disclosing that an app's code was written with
AI coding tools.** What both stores *do* police, and what's easy to conflate with that:

- **AI-generated content shown to users** (chatbots, generated images/text/music inside the
  app) — must be visibly labeled as AI-generated. Doesn't apply here: ShinePoint has no
  user-facing AI content generation feature.
- **Sending user data to a third-party AI provider** (OpenAI, Anthropic, Gemini, etc. from
  inside the app) — needs an explicit consent screen naming the provider (Google, effective
  Nov 2025) / disclosure under App Review Guideline 5.1.2(i) (Apple, Nov 2025). Doesn't apply
  here either: nothing in this app calls an AI API with user data.
- Apple has separately rejected some *"vibe coding" apps whose party trick is executing
  AI-generated code at runtime* (Guideline 2.5.2 — apps can't download/run code that changes
  their own functionality post-review). Not relevant to a normal compiled/bundled app like this
  one — only matters if you ever add a "the app writes and runs its own code" feature.

So: nothing to disclose for *how the app was built*. Revisit this if a real AI feature (chat
support, AI-written reviews, etc.) gets added later — that would trigger the content-disclosure
rules above.

## Android (Google Play)

- **Target API level 36 (Android 16)** — required for all new app submissions starting
  Aug 31, 2026. Already satisfied: Capacitor 8's default `android/variables.gradle` sets
  `compileSdkVersion`/`targetSdkVersion` to 36.
- **Closed testing requirement for new developer accounts** — if your Play Console account was
  created after Nov 13, 2023 (true for basically anyone setting this up fresh now), Google
  requires a closed test with **12 testers, opted in, actively using the app, for 14
  continuous days** before you're allowed to publish to production. "Opted in" means they
  accepted the invite and installed it under the matching Google account — invited-but-not-installed
  doesn't count, and inactive installs risk rejection for "insufficient testing engagement."
  Budget at least 2-3 weeks for this before a real launch; recruit testers (friends, a
  subreddit, testing-exchange communities) well before you want to ship.
- **Data safety section** (Play Console → App content → Data safety) — must accurately
  disclose what's collected: name, email, address, zip, profile/vehicle photos, precise
  location (map + live tracking). Mismatches between this form and actual app behavior are a
  common rejection reason.
- AI-generated-content policy and third-party-AI data-sharing consent screen: not applicable,
  per above.

## iOS (Apple App Store)

- **Privacy manifest** — `ios/App/App/PrivacyInfo.xcprivacy` now exists in the repo (declares
  the UserDefaults "required reason" API), but **still needs to be added to the Xcode project**
  manually (right-click the `App` group → Add Files to "App"). Apple auto-rejects builds
  missing this file entirely.
- **Build with the current SDK** — Apple requires new/updated apps be built with the
  iOS/iPadOS 26 SDK starting April 2026. Just means: use whatever Xcode version the Mac App
  Store currently offers, don't reach for an old cached Xcode install.
- **Age rating questionnaire** — Apple added a new, more detailed questionnaire (13+/16+/18+
  tiers, questions on in-app controls and content themes); it's a mandatory step in the
  standard submission flow for any new app now, not an extra thing to seek out.
- **App Privacy "nutrition label"** (App Store Connect → App Privacy) — same disclosure content
  as Android's Data Safety form: name, email, address, photos, precise location.
- Social-media-specific questions (added Sept 2026) only apply if the app functions as a social
  network — doesn't apply here.
- AI-generated-content disclosure and third-party-AI data-sharing disclosure: not applicable,
  per above.

## Sources

- [Understanding Google Play's AI-Generated Content policy](https://support.google.com/googleplay/android-developer/answer/14094294?hl=en)
- [Google Play Store Policy Updates: Generative AI Apps, Health Apps & User Data Privacy](https://asoworld.com/blog/google-play-store-policy-updates-generative-ai-apps-health-apps-user-data-privacy/)
- [Apple's Guideline 5.1.2(i): The AI Data-Sharing Rule](https://dev.to/arshtechpro/apples-guideline-512i-the-ai-data-sharing-rule-that-will-impact-every-ios-developer-1b0p)
- [Apple clamps down on third-party AI data sharing in App Store review](https://www.techbuzz.ai/articles/apple-clamps-down-on-third-party-ai-data-sharing-in-app-store)
- [Google Play Target API Level requirement for Android apps in 2026](https://median.co/blog/google-plays-target-api-level-requirement-for-android-apps)
- [Meet Google Play's target API level requirement — Android Developers](https://developer.android.com/google/play/requirements/target-sdk)
- [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play Closed Testing Policy Changes in 2026 Explained](https://12testers14days.pro/blog/google-play-policy-changes-2026/)
- [Apple's Privacy Manifest Requirement](https://docs.purchasely.com/docs/apples-privacy-manifest-requirement)
- [Privacy Manifest for Capacitor Apps: Guide](https://capgo.app/blog/privacy-manifest-for-capacitor-apps-guide/)
- [App Store Privacy in 2026: Age Verification, SDK Rules & What Every iOS Developer Must Do Now](https://ravi6997.medium.com/app-store-privacy-in-2026-is-no-longer-optional-heres-what-every-ios-developer-must-know-a2fed302b684)
- [Important: iOS App Age Rating Updates Required by January 31, 2026](https://www.socastdigital.com/2025/12/15/important-ios-app-age-rating-updates-required-by-january-31-2026/)
- [Apple adds social media questions to App Store Connect age rating questionnaire](https://9to5mac.com/2026/07/09/apple-adds-social-media-questions-to-app-store-connect-age-rating-questionnaire/)
- [How to Upgrade Your Capacitor App to Capacitor 8 — Capawesome](https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/)
