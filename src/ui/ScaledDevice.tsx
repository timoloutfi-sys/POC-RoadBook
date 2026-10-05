import { useEffect, useRef, useState } from 'react'
import { Device } from './Device'

type Props = React.ComponentProps<typeof Device>

/**
 * Montre un écran de course tel qu'il sera sur le téléphone en paysage (844 px de large),
 * réduit pour tenir dans la largeur disponible : textes et proportions restent fidèles.
 */
export function ScaledDevice(props: Props) {
  const portrait = !!props.grid && props.grid.cols < props.grid.rows
  const W = portrait ? 390 : 844, H = portrait ? 780 : 422
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W))
    ro.observe(el)
    setScale(el.clientWidth / W)
    return () => ro.disconnect()
  }, [W])
  return (
    <div ref={box} style={{ width: '100%', height: H * scale, overflow: 'hidden', borderRadius: 10 }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Device {...props} className={`${props.className ?? ''} full`} />
      </div>
    </div>
  )
}
