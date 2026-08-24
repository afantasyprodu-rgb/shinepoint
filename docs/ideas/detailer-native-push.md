# Detailer Native Push Notifications

## Problem Statement
How might we give detailers reliable real-time job/message alerts on Android, without touching the customer or admin experience?

## Recommended Direction
Native push notifications for the detailer role only, via Capacitor's push-notifications plugin + Firebase Cloud Messaging (FCM), triggered from a Supabase edge function on new-job and new-message events. Background location tracking is already built (`src/lib/tracking.js`, `@capacitor-community/background-geolocation`) and survives app-background/screen-lock by design — this closes the other half of "detailer needs to know things happen without staring at the app."

Confirmed greenfield: chat/job alerts today are in-app only (toast/badge while the app is open) — a detailer with the phone in their pocket gets nothing. No existing push infra to conflict with.

## Key Assumptions to Validate
- [x] Detailers have no way to know about a new job/message except having the app open — confirmed by user
- [x] FCM is available and unclaimed — confirmed, user owns the Firebase project already
- [ ] A Supabase edge function can call FCM's HTTP v1 send API directly using a Firebase service-account key stored as a secret — standard pattern, low risk, verify during build

## MVP Scope
**In:**
- `@capacitor/push-notifications` plugin wired into the Android build only
- Firebase project config (`google-services.json` in `android/app/`)
- Device-token column on `detailer_profiles` (register/refresh token on login, native platform only)
- One edge function (`send-push`) that calls FCM, triggered from new-booking-assigned and new-chat-message events
- Notification tap deep-links into the relevant booking/chat screen

**Out:**
- Customer/admin push — different use case (not a mobile-worker role)
- iOS push (APNs is separate cert/infra) — later pass if wanted
- Rich notification actions (accept/decline from the tray) — v2 if this proves out

## Not Doing (and Why)
- Full native Compose rewrite — no driving pain justified months of solo part-time work; rejected during refinement in favor of this surgical approach
- Customer/admin native plugins — they don't have the mobile-worker use case detailers do
- iOS push in this pass — different cert/infra (APNs), scope creep on an Android-focused ask

## Open Questions
- None outstanding — ready to scope implementation.
