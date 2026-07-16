# Enabling phone (SMS) sign-in

The app already supports phone signup/login — [AuthCard.jsx](../src/components/AuthCard.jsx)
calls `signInWithOtp({ phone })` and verifies the code. It’s disabled until you connect an
SMS provider in Supabase. Until then the UI shows:
“Phone sign-in isn’t enabled yet — set up an SMS provider in Supabase first.”

## Steps

1. **Pick an SMS provider.** Supabase supports Twilio, MessageBird, Vonage, or Twilio Verify.
   Twilio is the common choice.

2. **Get credentials** from the provider:
   - Twilio: Account SID, Auth Token, and a Messaging Service SID (or a sending phone number).

3. **Supabase Dashboard → Authentication → Providers → Phone:**
   - Toggle **Enable phone sign-ups** on.
   - Select your provider and paste the credentials.
   - Save.

4. **(Recommended) Enable CAPTCHA** under Authentication → Settings to stop OTP abuse —
   phone OTPs cost money per send.

5. **Test:** open the app → New account → Phone tab → enter a number → you should receive a
   real SMS code.

## Costs & notes

- Each OTP send costs money (provider rates). Rate-limit + CAPTCHA strongly recommended before
  launch.
- For production, register a proper sender (Twilio Messaging Service / A2P 10DLC in the US) or
  delivery will be throttled or blocked.
- No code changes needed — once the provider is on, the existing phone flow just works.
