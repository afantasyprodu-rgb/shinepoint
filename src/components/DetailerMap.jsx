import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import DemoMap from './DemoMap'
import { useTheme } from '../context/ThemeContext'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Pin colors per Blueprint screen 2.1:
// green = available, yellow = busy but accepting, grey = offline.
const PIN_COLORS = {
  available: '#16a34a',
  busy: '#f59e0b',
  offline: '#94a3b8',
}

const LA_CENTER = [-118.33, 34.05]

export function isMapboxConfigured() {
  return Boolean(MAPBOX_TOKEN)
}

export default function DetailerMap({ detailers, focus, onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const { theme } = useTheme()
  // Kept in a ref so the marker-rebuild effect below doesn't need onSelect in
  // its dependency array — the caller passes a new inline function every
  // render, and rebuilding every marker on every render would be wasteful.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:
        theme === 'dark'
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/streets-v12',
      center: LA_CENTER,
      zoom: 10.3,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current = map

    const markers = detailers
      .filter((d) => d.pin)
      .map((d) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.setAttribute('aria-label', `${d.name} — ${d.status}`)
        el.style.cssText = `
          width: 22px; height: 22px; border-radius: 9999px; cursor: pointer;
          background: ${PIN_COLORS[d.status] ?? PIN_COLORS.offline};
          border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        `
        el.addEventListener('click', () => onSelectRef.current?.(d.id))

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-family: 'Source Sans 3', sans-serif; min-width: 160px;">
            <strong style="font-size: 14px;">${d.name}</strong>
            <div style="font-size: 13px; color: #475569;">
              ★ ${d.rating.toFixed(1)} (${d.reviews}) · ${d.area}
            </div>
            <div style="font-size: 12px; margin-top: 2px; color: ${PIN_COLORS[d.status]};">
              ${
                d.status === 'available'
                  ? 'Available now'
                  : d.status === 'busy' && d.acceptsWhenBusy
                    ? 'Busy — accepting bookings'
                    : d.status === 'busy'
                      ? 'Busy'
                      : 'Offline'
              }
            </div>
          </div>
        `)

        return new mapboxgl.Marker({ element: el })
          .setLngLat([d.pin.lng, d.pin.lat])
          .setPopup(popup)
          .addTo(map)
      })

    return () => {
      markers.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [detailers, theme])

  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 13, duration: 1200 })
    }
  }, [focus])

  // No token: fall back to the stylized demo map so the app still demos well.
  if (!MAPBOX_TOKEN) {
    return <DemoMap detailers={detailers} focus={focus} onSelect={onSelect} />
  }

  return <div ref={containerRef} className="h-full w-full" />
}
