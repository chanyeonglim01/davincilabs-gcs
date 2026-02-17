import { useState, useRef, useCallback } from 'react'

interface Position {
  x: number
  y: number
}

export function useDraggable(initialPos: Position) {
  const [pos, setPos] = useState<Position>(initialPos)
  const dragRef = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(
    null
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag on the header/handle, not content
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panelX: pos.x,
        panelY: pos.y
      }

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        setPos({
          x: dragRef.current.panelX + (ev.clientX - dragRef.current.mouseX),
          y: dragRef.current.panelY + (ev.clientY - dragRef.current.mouseY)
        })
      }

      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [pos.x, pos.y]
  )

  return { pos, onMouseDown }
}
