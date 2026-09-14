// Seed the theme before first paint so dark mode never flashes white.
// Default is light regardless of OS preference — dark is opt-in only.
// A separate file (not inline in index.html) so the CSP can be plain
// script-src 'self' with no hashes to keep in sync across line endings.
(function () {
  try {
    var saved = localStorage.getItem('shinepoint-theme')
    var mode = saved === 'dark' ? 'dark' : 'light'
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
  } catch (e) {}
})()
