/**
 * Bobly's face — the public-site concierge mascot, replacing Driplee
 * (DrewBlob.jsx) on the marketing widget. Same "live blob + eyes riding
 * inside it" recipe as DrewBlob, just a soap-bubble sphere (.nx-bobly-bubble
 * in src/index.css, built from HeroBubbles.jsx's own background-bubble
 * gradient) instead of a teardrop, with rounded-rectangle eyes instead of
 * ovals. `size` scales the whole thing via --bobly-size, same pattern as
 * DrewBlob's --drew-size.
 *
 * `muted`: for a past chat message once a newer reply exists -- drops the
 * eyes and desaturates to slate, so only the latest reply reads as "the"
 * active mascot instead of a long conversation turning into a wall of
 * identical bubbles.
 */
export default function BoblyBlob({ size = 44, muted = false, className = '' }) {
  return (
    <div
      className={`nx-bobly-float ${className}`}
      style={{ width: size, height: size, '--bobly-size': `${size}px` }}
      aria-hidden="true"
    >
      <div className={`nx-bobly-bubble nx-bobly-idle relative h-full w-full ${muted ? 'nx-bobly-bubble-muted' : ''}`}>
        {!muted && (
          <div className="bobly-eyes">
            <span className="bobly-eye-look">
              <span className="bobly-eye" />
            </span>
            <span className="bobly-eye-look">
              <span className="bobly-eye" />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
