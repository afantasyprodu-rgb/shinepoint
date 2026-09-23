// Pre-paint theme init — mirrors ThemeContext.initialTheme() so dark-mode
// users don't get a full-screen light flash before React hydrates and its
// effect toggles .dark. External file (not inline) so the build-time CSP
// (script-src 'self') allows it. Runs synchronously in <head>, before CSS
// paint. Keep the storage keys + fallback order in sync with
// src/context/ThemeContext.jsx.
(function () {
  try {
    var saved = localStorage.getItem('shinepoint-theme')
    // Stored choice wins; otherwise follow the OS — dark is NOT opt-in
    // only, it follows initialTheme()'s stored-or-system order exactly.
    var mode =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    if (mode === 'dark') document.documentElement.classList.add('dark')
    var paint = localStorage.getItem('shinepoint-paint')
    if (paint) document.documentElement.style.setProperty('--accent', paint)
    // Seed the mode's rotated brand hue too (ThemeContext.jsx owns
    // rotating it on each toggle) so a reload never flashes back to
    // the default purple before React mounts.
    var hue = Number(localStorage.getItem('shinepoint-hue-' + mode))
    if (hue) {
      document.documentElement.style.setProperty('--brand-h', hue)
      document.documentElement.style.setProperty('--cta-h', ((hue - 120 + 360) % 360))
    }
    // Design skin before paint for the same reason (ThemeContext mirrors).
    var skin = null
    try { skin = localStorage.getItem('shinepoint-design-theme') } catch (e2) {}
    if (skin) document.documentElement.setAttribute('data-theme', skin)
  } catch (e) {}
})()
