/**
 * Bo's face — the public-site concierge mascot, replacing Driplee
 * (DrewBlob.jsx) on the marketing widget. Same "live blob + eyes riding
 * inside it" recipe as DrewBlob, just a soap-bubble sphere (.nx-bo-bubble
 * in src/index.css, built from HeroBubbles.jsx's own background-bubble
 * gradient) instead of a teardrop, with rounded-rectangle eyes instead of
 * ovals and a flat cartoon bow tie + collar (.bo-suit) wrapped around the
 * bottom of the sphere -- not a rendered suit, just enough of a silhouette
 * to read as "dressed up." `size` scales the whole thing via --bo-size,
 * same pattern as DrewBlob's --drew-size.
 *
 * `muted`: for a past chat message once a newer reply exists -- drops the
 * eyes and bow tie and desaturates to slate, so only the latest reply reads
 * as "the" active mascot instead of a long conversation turning into a wall
 * of identical bubbles.
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
              <span className="bo-collar bo-collar-left" />
              <span className="bo-collar bo-collar-right" />
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
