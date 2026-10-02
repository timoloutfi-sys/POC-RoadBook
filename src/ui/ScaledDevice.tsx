import { useEffect, useRef, useState } from 'react'
import { Device } from './Device'

type Props = React.ComponentProps<typeof Device>
const W = 844

/**
 * Montre un écran de course tel qu'il sera sur le téléphone en paysage (844 px de large),
 * réduit pour tenir dans la largeur disponible : textes et proportions restent fidèles.
 */
export function ScaledDevice(props: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W))
    ro.observe(el)
    setScale(el.clientWidth / W)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} style={{ width: '100%', height: (W / 2) * scale, overflow: 'hidden', borderRadius: 10 }}>
      <div style={{ width: W, height: W / 2, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Device {...props} className={`${props.className ?? ''} full`} />
      </div>
    </div>
  )
}
