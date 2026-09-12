/**
 * Bo's face — the public-site concierge mascot, replacing Driplee
 * (DrewBlob.jsx) on the marketing widget. Same "live blob + eyes riding
 * inside it" recipe as DrewBlob, just a soap-bubble sphere (.nx-bo-bubble
 * in src/index.css) instead of a teardrop.
 *
 * Tuxedo: NOT a human body. A bubbly wrap around the LOWER HALF of the
 * sphere — soft black jacket mass, rounded white shirt V, brand bow —
 * so the silhouette stays a circle with formal costume painted on it.
 *
 * `muted`: for a past chat message once a newer reply exists -- drops the
 * eyes and tuxedo and desaturates to slate.
 */
export default function BoBlob({ size = 44, muted = false, className = '' }) {
  return (
    <div
      className={`nx-bo-float ${className}`}
      style={{ width: size, height: size, '--bo-size': `${size}px` }}
      aria-hidden="true"
    >
      <div className={`nx-bo-bubble nx-bo-idle relative h-full w-full ${muted ? 'nx-bo-bubble-muted' : ''}`}>
        {!muted && (
          <>
            <div className="bo-eyes">
              <span className="bo-eye-look">
                <span className="bo-eye" />
              </span>
              <span className="bo-eye-look">
                <span className="bo-eye" />
              </span>
            </div>
            <div className="bo-suit">
              <span className="bo-tux-body" />
              <span className="bo-tux-lapel bo-tux-lapel-left" />
              <span className="bo-tux-lapel bo-tux-lapel-right" />
              <span className="bo-tux-shirt" />
              <span className="bo-bowtie">
                <span className="bo-bowtie-wing bo-bowtie-wing-left" />
                <span className="bo-bowtie-knot" />
                <span className="bo-bowtie-wing bo-bowtie-wing-right" />
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
