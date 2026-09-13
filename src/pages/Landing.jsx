import { Capacitor } from '@capacitor/core'
import { useMediaQuery } from '../hooks/useMediaQuery'
import Welcome from './Welcome'
import DesktopLanding from './DesktopLanding'
import ConciergeChat from '../components/ConciergeChat'

// Desktop (lg+) gets the video-montage + inline-login composition; smaller
// screens keep the full marketing scroll. Native always goes through Welcome
// so ColdStart (not DesktopLanding) is the post-splash first paint.
// Bo stays off the native first paint so the face does not sit on the buttons.
export default function Landing() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const native = Capacitor.isNativePlatform()
  return (
    <>
      {native || !isDesktop ? <Welcome /> : <DesktopLanding />}
      {!native && <ConciergeChat />}
    </>
  )
}
