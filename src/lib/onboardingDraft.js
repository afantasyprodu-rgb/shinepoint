// Draft of the detailer onboarding "services" step, persisted in localStorage.
// The wizard has no save button until the final submit, so a detailer who
// picks a flyer/template/manual pricing path and then backs out or closes
// the tab mid-setup shouldn't lose that work — restored on their next visit
// and cleared once onboarding is actually submitted.
//
// Keyed per userId so a draft never bleeds across accounts on the same browser.

const keyFor = (userId) => `shinepoint:onboarding-services-draft:${userId}`

export function readServicesDraft(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeServicesDraft(userId, draft) {
  if (!userId) return
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(draft))
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function clearServicesDraft(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(keyFor(userId))
  } catch {
    /* ignore */
  }
}
