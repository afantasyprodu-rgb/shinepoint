import { useEffect, useRef } from 'react'

const BUTTON_TEXTURE_URL = 'https://essykings.github.io/JavaScript/map.png'

// SVG filter defs for the "liquid glass" backdrop effect — ported from
// https://codepen.io/Cubiq/pen/yyYYRzP (Cubiq, MIT-style codepen license).
// Renders once, invisible (0×0), referenced by `.nx-liquid` via
// `backdrop-filter: url(#nx-liquid-glass)`. Scoped to the map's floating
// chrome only (search bar, filter pills, legend, locate button) per request
// — backdrop-filter re-samples whatever's behind the element on every
// repaint, so applying it to something that moves (the map tiles) every
// frame would be a performance trap; static overlay chrome repaints rarely.
//
// A second, lighter filter (#nx-map-btn-glass) is for the map's own button
// controls (locate + zoom) — it displaces the backdrop using an actual
// fetched image as the displacement map, not a procedural normal map, per
// the feImage snippet. Fetched as a blob (not a plain `href` to the remote
// URL) so it isn't blocked by the filter's implicit cross-origin taint
// check. `.nx-map-btn-glass` in index.css only wires this up in light mode.
export default function LiquidGlassDefs() {
  const textureRef = useRef(null)

  useEffect(() => {
    let objectUrl
    let cancelled = false
    fetch(BUTTON_TEXTURE_URL)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        const el = textureRef.current
        if (el) {
          el.setAttribute('href', objectUrl)
          el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', objectUrl)
        }
      })
      .catch(() => {}) // texture is decorative — silently skip if the fetch fails
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="nx-liquid-glass" x="-20%" y="-20%" width="140%" height="140%">
        <feComponentTransfer result="SourceBackground" in="SourceGraphic">
          <feFuncR type="discrete" tableValues="0.000 0.008 0.016 0.024 0.031 0.039 0.047 0.055 0.063 0.071 0.079 0.087 0.094 0.102 0.110 0.118 0.126 0.134 0.142 0.150 0.157 0.165 0.173 0.181 0.189 0.197 0.205 0.213 0.220 0.228 0.236 0.244 0.252 0.260 0.268 0.276 0.283 0.291 0.299 0.307 0.315 0.323 0.331 0.339 0.346 0.354 0.362 0.370 0.378 0.386 0.394 0.402 0.409 0.417 0.425 0.433 0.441 0.449 0.457 0.465 0.472 0.480 0.488 0.496 0.504 0.512 0.520 0.528 0.535 0.543 0.551 0.559 0.567 0.575 0.583 0.591 0.598 0.606 0.614 0.622 0.630 0.638 0.646 0.654 0.661 0.669 0.677 0.685 0.693 0.701 0.709 0.717 0.724 0.732 0.740 0.748 0.756 0.764 0.772 0.780 0.787 0.795 0.803 0.811 0.819 0.827 0.835 0.843 0.850 0.858 0.866 0.874 0.882 0.890 0.898 0.906 0.913 0.921 0.929 0.937 0.945 0.953 0.961 0.969 0.976 0.984 0.992 1.000" />
          <feFuncG type="discrete" tableValues="0.000 0.008 0.016 0.024 0.031 0.039 0.047 0.055 0.063 0.071 0.079 0.087 0.094 0.102 0.110 0.118 0.126 0.134 0.142 0.150 0.157 0.165 0.173 0.181 0.189 0.197 0.205 0.213 0.220 0.228 0.236 0.244 0.252 0.260 0.268 0.276 0.283 0.291 0.299 0.307 0.315 0.323 0.331 0.339 0.346 0.354 0.362 0.370 0.378 0.386 0.394 0.402 0.409 0.417 0.425 0.433 0.441 0.449 0.457 0.465 0.472 0.480 0.488 0.496 0.504 0.512 0.520 0.528 0.535 0.543 0.551 0.559 0.567 0.575 0.583 0.591 0.598 0.606 0.614 0.622 0.630 0.638 0.646 0.654 0.661 0.669 0.677 0.685 0.693 0.701 0.709 0.717 0.724 0.732 0.740 0.748 0.756 0.764 0.772 0.780 0.787 0.795 0.803 0.811 0.819 0.827 0.835 0.843 0.850 0.858 0.866 0.874 0.882 0.890 0.898 0.906 0.913 0.921 0.929 0.937 0.945 0.953 0.961 0.969 0.976 0.984 0.992 1.000" />
          <feFuncB type="discrete" tableValues="0.000 0.008 0.016 0.024 0.031 0.039 0.047 0.055 0.063 0.071 0.079 0.087 0.094 0.102 0.110 0.118 0.126 0.134 0.142 0.150 0.157 0.165 0.173 0.181 0.189 0.197 0.205 0.213 0.220 0.228 0.236 0.244 0.252 0.260 0.268 0.276 0.283 0.291 0.299 0.307 0.315 0.323 0.331 0.339 0.346 0.354 0.362 0.370 0.378 0.386 0.394 0.402 0.409 0.417 0.425 0.433 0.441 0.449 0.457 0.465 0.472 0.480 0.488 0.496 0.504 0.512 0.520 0.528 0.535 0.543 0.551 0.559 0.567 0.575 0.583 0.591 0.598 0.606 0.614 0.622 0.630 0.638 0.646 0.654 0.661 0.669 0.677 0.685 0.693 0.701 0.709 0.717 0.724 0.732 0.740 0.748 0.756 0.764 0.772 0.780 0.787 0.795 0.803 0.811 0.819 0.827 0.835 0.843 0.850 0.858 0.866 0.874 0.882 0.890 0.898 0.906 0.913 0.921 0.929 0.937 0.945 0.953 0.961 0.969 0.976 0.984 0.992 1.000" />
        </feComponentTransfer>

        <feComponentTransfer in="SourceGraphic">
          <feFuncR type="discrete" tableValues="0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1" />
          <feFuncG type="discrete" tableValues="0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1" />
          <feFuncB type="discrete" tableValues="0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1" />
        </feComponentTransfer>
        <feColorMatrix type="luminanceToAlpha" />
        <feGaussianBlur stdDeviation="2" />
        <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 8 -2" />
        <feComposite result="SourceMask" />

        <feDiffuseLighting in="SourceMask" diffuseConstant="1" surfaceScale="60">
          <feDistantLight azimuth="90" elevation="60" />
        </feDiffuseLighting>
        <feColorMatrix type="luminanceToAlpha" />
        <feColorMatrix result="side-red" values="0 0 0 0.0 1  0 0 0 0.0 0  0 0 0 0.0 0  0 0 0 255 0" />

        <feDiffuseLighting in="SourceMask" diffuseConstant="1" surfaceScale="60">
          <feDistantLight azimuth="0" elevation="60" />
        </feDiffuseLighting>
        <feColorMatrix type="luminanceToAlpha" />
        <feColorMatrix result="side-green" values="0 0 0 0.0 0  0 0 0 0.0 1  0 0 0 0.0 0  0 0 0 255 0" />

        <feBlend in="side-green" in2="side-red" mode="screen" />
        <feMorphology result="thickness" radius="2" operator="dilate" />
        <feGaussianBlur result="dispersion" stdDeviation="4" />

        <feColorMatrix in="SourceMask" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1 0" />
        <feComposite in="dispersion" operator="atop" />
        <feFlood floodColor="#808000" />
        <feComposite in2="dispersion" operator="over" result="NormalMap" />

        <feDisplacementMap in="SourceBackground" in2="NormalMap" scale="60" xChannelSelector="R" yChannelSelector="G" />
        <feGaussianBlur stdDeviation="0.6" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.95" intercept="0.04" />
          <feFuncG type="linear" slope="0.95" intercept="0.04" />
          <feFuncB type="linear" slope="0.95" intercept="0.04" />
        </feComponentTransfer>
        <feComposite in2="SourceMask" operator="in" />
      </filter>

      <filter id="nx-map-btn-glass" x="-30%" y="-30%" width="160%" height="160%">
        <feImage ref={textureRef} result="texture" preserveAspectRatio="xMidYMid slice" x="0" y="0" width="100%" height="100%" />
        <feColorMatrix in="texture" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="texture-alpha" />
        <feGaussianBlur in="texture-alpha" stdDeviation="1.4" result="texture-soft" />
        <feDisplacementMap in="SourceGraphic" in2="texture-soft" scale="16" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
