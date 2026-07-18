import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

// Ask permission, subscribe the browser, and save the subscription
// for this donor (verified by phone + PIN).
export async function enablePushForDonor(phone, pin) {
  if (!pushSupported()) throw new Error('Notifications are not supported on this browser.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const { error } = await supabase.rpc('save_push_subscription', {
    p_phone: phone.trim(),
    p_pin: pin.trim(),
    p_subscription: subscription.toJSON(),
  })
  if (error) throw error
  return true
}

// Fire-and-forget: tell the Edge Function to notify the donor of a new request.
export function notifyDonor(requestId) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return
  fetch(`${url}/functions/v1/notify-donor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ request_id: requestId }),
  }).catch(() => {})
}
