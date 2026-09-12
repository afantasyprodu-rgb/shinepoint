/**
 * Bo's face — public-site soap-bubble concierge (Landing). Eyes ride inside
 * the sphere (.nx-bo-bubble). No tuxedo / costume — just the droplet bubble.
 * `muted`: past chat message — hide eyes, desaturate via CSS.
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
          <div className="bo-eyes">
            <span className="bo-eye-look"><span className="bo-eye" /></span>
            <span className="bo-eye-look"><span className="bo-eye" /></span>
          </div>
        )}
      </div>
    </div>
  )
}