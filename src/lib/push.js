import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

// Detailer-only, native-only (mirrors tracking.js's pattern) — customers and
// admins never register a token, which is what keeps send-push's skip path
// scoped correctly without the edge function having to check role.
let registered = false

export async function registerDetailerPush(userId) {
  if (!Capacitor.isNativePlatform() || registered) return
  registered = true

  const current = await PushNotifications.checkPermissions()
  let status = current.receive
  if (status !== 'granted') {
    status = (await PushNotifications.requestPermissions()).receive
  }
  if (status !== 'granted') {
    registered = false
    return
  }

  PushNotifications.addListener('registration', (token) => {
    supabase
      .from('detailer_profiles')
      .update({ fcm_token: token.value })
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error('registerDetailerPush: failed to save token:', error.message)
      })
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('push registration failed:', err)
  })

  // Deep-link a tapped notification. pushState + a synthetic popstate is the
  // standard way to hand BrowserRouter a new location without a full reload
  // (which would drop in-memory app state, e.g. an unsent chat draft).
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const path = action.notification?.data?.path
    if (path) {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  })

  await PushNotifications.register()
}
