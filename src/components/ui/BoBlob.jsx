/**
 * Bo's face — public-site soap-bubble concierge (Landing). Eyes + tuxedo ride
 * inside the sphere (.nx-bo-bubble). Tuxedo is a bottom-quarter wrap only —
 * still a circle, not a human body: soft black jacket mass at the south pole,
 * rounded shirt V, brand bow. `muted`: past chat message — hide eyes/suit,
 * desaturate via CSS.
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
              <span className="bo-eye-look"><span className="bo-eye" /></span>
              <span className="bo-eye-look"><span className="bo-eye" /></span>
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