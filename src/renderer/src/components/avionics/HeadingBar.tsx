import { useRef, useLayoutEffect } from 'react'
import { useTelemetryStore } from '@renderer/store/telemetryStore'

const PX_PER_DEG = 2
const TAPE_PX = 360 * PX_PER_DEG // 720px (한 세트)
const BASE_MARKS = Array.from({ length: 12 }, (_, i) => i * 30) // 0,30,...,330

export function HeadingBar(): React.ReactElement {
  const heading = useTelemetryStore((state) => state.telemetry?.heading ?? 0)

  // Round to nearest degree
  const headingRounded = Math.round(heading)

  // 3배 복제 테이프 — 중앙 세트를 기준으로 양쪽 여유를 두어
  // 경계 넘을 때 transition 없이 seamless 재배치 가능
  const headingMarks3x = [...BASE_MARKS, ...BASE_MARKS, ...BASE_MARKS]

  // Direct DOM manipulation on the tape div.
  // accPxRef: 누적 픽셀 오프셋 (delta 방식 — 절대값 변환 없음)
  // 항상 [TAPE_PX, 2*TAPE_PX) 범위를 유지하여 중앙 세트를 참조
  const tapeDivRef = useRef<HTMLDivElement | null>(null)
  const prevHRef = useRef<number | null>(null)
  const accPxRef = useRef(0)

  useLayoutEffect(() => {
    const div = tapeDivRef.current
    if (!div) return

    if (prevHRef.current === null) {
      prevHRef.current = headingRounded
      // 초기 offset: 중앙 세트(+TAPE_PX) 기준
      accPxRef.current = headingRounded * PX_PER_DEG + TAPE_PX
      div.style.transition = 'none'
      div.style.left = `calc(50% - ${accPxRef.current}px)`
      requestAnimationFrame(() => { div.style.transition = 'left 0.12s linear' })
      return
    }

    // 최단 경로 delta (−180 ~ +179)
    const delta = ((headingRounded - prevHRef.current + 540) % 360) - 180
    prevHRef.current = headingRounded
    accPxRef.current += delta * PX_PER_DEG

    // 범위 초과 시 seamless 재배치 (시각적으로 동일한 위치, transition 없이)
    if (accPxRef.current >= TAPE_PX * 2) {
      accPxRef.current -= TAPE_PX
      div.style.transition = 'none'
      div.style.left = `calc(50% - ${accPxRef.current}px)`
      requestAnimationFrame(() => {
        if (tapeDivRef.current) tapeDivRef.current.style.transition = 'left 0.12s linear'
      })
    } else if (accPxRef.current < TAPE_PX) {
      accPxRef.current += TAPE_PX
      div.style.transition = 'none'
      div.style.left = `calc(50% - ${accPxRef.current}px)`
      requestAnimationFrame(() => {
        if (tapeDivRef.current) tapeDivRef.current.style.transition = 'left 0.12s linear'
      })
    } else {
      div.style.left = `calc(50% - ${accPxRef.current}px)`
    }
  }, [headingRounded])

  // Cardinal directions
  const getCardinal = (deg: number): string => {
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round((deg % 360) / 45) % 8
    return cardinals[index]
  }

  return (
    <div className="relative h-14 w-full bg-surface-elevated/80 rounded-lg border border-border overflow-hidden">
      {/* Heading tape */}
      <div className="absolute top-0 left-0 right-0 h-10 overflow-hidden">
        <div
          ref={tapeDivRef}
          className="absolute top-2 flex items-center"
          style={{ transform: 'translateX(-50%)' }}
        >
          {headingMarks3x.map((deg, idx) => (
            <div key={idx} className="flex flex-col items-center" style={{ width: '60px' }}>
              {/* Tick mark */}
              <div className="h-2 w-px bg-border" />

              {/* Cardinal/degree label */}
              <span className="text-[10px] font-mono text-text-tertiary mt-1">
                {deg % 90 === 0 ? getCardinal(deg) : deg}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Center indicator triangle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
      </div>

      {/* Current heading display */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-primary/20 border border-primary rounded px-3 py-0.5">
        <span className="text-lg font-mono font-bold text-primary">
          {headingRounded.toString().padStart(3, '0')}°
        </span>
      </div>

      {/* Label */}
      <div className="absolute bottom-1 left-2">
        <span className="text-[10px] font-semibold text-text-secondary tracking-wider">HDG</span>
      </div>
    </div>
  )
}
