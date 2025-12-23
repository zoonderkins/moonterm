import { useCallback, useRef, useEffect } from 'react'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  onDoubleClick?: () => void
}

export function ResizeHandle({ direction, onResize, onDoubleClick }: ResizeHandleProps) {
  const isDragging = useRef(false)
  const startPos = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
    document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [direction])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return

      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPos.current
      startPos.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [direction, onResize])

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      title="Drag to resize, double-click to reset"
    />
  )
}
