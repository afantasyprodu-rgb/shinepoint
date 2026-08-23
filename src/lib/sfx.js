// Lightweight sound effects via the Web Audio API — short synthesized
// chimes rather than bundled audio files, so there's nothing to license or
// fetch. Muted by default is NOT the goal (autoplay policies handle first-
// interaction gating on their own since these only ever fire in response to
// a click/tap), but a user mute preference persists across sessions.
//
// Usage: playSfx('success') from any click/action handler.

const MUTE_KEY = 'shinepoint:sfx-muted'

export function isSfxMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSfxMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Ignore — private browsing / storage disabled just means the
    // preference doesn't persist, not a reason to break the toggle.
  }
}

let ctx = null
function getContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  // Browsers suspend a freshly-created context until a user gesture; every
  // call site here already runs inside a click handler, so resuming is safe.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Each note: [frequency Hz, start offset sec, duration sec, peak gain].
const SEQUENCES = {
  // Booking confirmed / payment success — bright ascending triad.
  success: [
    [660, 0, 0.11, 0.16],
    [880, 0.09, 0.13, 0.16],
    [1320, 0.19, 0.22, 0.14],
  ],
  // New chat message — soft two-note blip.
  message: [
    [720, 0, 0.07, 0.11],
    [960, 0.06, 0.1, 0.1],
  ],
  // Detailer en route — single gentle ping.
  enroute: [[840, 0, 0.18, 0.13]],
  // Generic UI tap — very short, quiet click.
  tap: [[520, 0, 0.045, 0.06]],
}

function playTone(audioCtx, freq, startAt, duration, peakGain) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

export function playSfx(name) {
  if (isSfxMuted()) return
  const audioCtx = getContext()
  if (!audioCtx) return
  const notes = SEQUENCES[name]
  if (!notes) return
  const now = audioCtx.currentTime
  for (const [freq, offset, duration, peakGain] of notes) {
    playTone(audioCtx, freq, now + offset, duration, peakGain)
  }
}
