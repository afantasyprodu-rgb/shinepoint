import { useMediaQuery } from '../hooks/useMediaQuery'
import Welcome from './Welcome'
import DesktopLanding from './DesktopLanding'

// Desktop (lg+) gets the video-montage + inline-login composition; smaller
// screens keep the full marketing scroll. Same route, two layouts.
export default function Landing() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  return isDesktop ? <DesktopLanding /> : <Welcome />
}
