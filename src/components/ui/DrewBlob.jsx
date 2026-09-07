/**
 * Drew's live face — no PNG, no flat background. Reuses the exact
 * .nx-tab-drop / .nx-tab-drop-idle / .nx-tab-drop-float recipe the bottom
 * nav's WaterDroplet already uses (src/components/ui/BottomTabBar.jsx,
 * src/index.css) so Drew reads as the same floating, shape-morphing blob
 * everywhere he appears, just with eyes instead of a nav icon riding inside.
 * `size` scales the whole thing via the --drew-size custom property that
 * .drew-eyes/.drew-eye read off of.
 */
export default function DrewBlob({ size = 44, className = '' }) {
  return (
    <div
      className={`nx-tab-drop-float ${className}`}
      style={{ width: size, height: size, '--drew-size': `${size}px` }}
      aria-hidden="true"
    >
      <div className="nx-tab-drop nx-tab-drop-idle relative h-full w-full -rotate-45">
        <div className="drew-eyes">
          <span className="drew-eye-look">
            <span className="drew-eye" />
          </span>
          <span className="drew-eye-look">
            <span className="drew-eye" />
          </span>
        </div>
      </div>
    </div>
  )
}
