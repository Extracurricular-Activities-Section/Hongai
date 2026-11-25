import { Eraser } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SignaturePadHandle {
  /** Wipe the canvas. */
  clear: () => void
  /** PNG data URL, or null when nothing has been drawn. */
  toDataURL: () => string | null
  isEmpty: () => boolean
}

const CANVAS_WIDTH = 720
const CANVAS_HEIGHT = 240
const STROKE_WIDTH = 3.2
const STROKE_COLOR = '#111827'

/**
 * Hand-written signature on a native canvas (no dependency).
 * The bitmap has a fixed internal size and scales with CSS, so exports are consistent across devices.
 * `onChange` fires when a stroke ends (PNG data URL) and on clear (null).
 */
export function SignaturePad({
  onChange,
  disabled = false,
  label = '簽名區',
  className,
  ref,
}: {
  onChange?: (dataUrl: string | null) => void
  disabled?: boolean
  label?: string
  className?: string
  ref?: Ref<SignaturePadHandle>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  const paintBackground = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => {
    paintBackground()
  }, [paintBackground])

  const clear = useCallback(() => {
    paintBackground()
    setEmpty(true)
    onChange?.(null)
  }, [onChange, paintBackground])

  useImperativeHandle(
    ref,
    () => ({
      clear,
      toDataURL: () => (empty ? null : (canvasRef.current?.toDataURL('image/png') ?? null)),
      isEmpty: () => empty,
    }),
    [clear, empty],
  )

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function strokeSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.strokeStyle = STROKE_COLOR
    context.lineWidth = STROKE_WIDTH
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const point = pointFromEvent(event)
    lastPointRef.current = point
    // A tap leaves a dot.
    strokeSegment(point, { x: point.x + 0.01, y: point.y + 0.01 })
    setEmpty(false)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current) return
    const point = pointFromEvent(event)
    strokeSegment(lastPointRef.current, point)
    lastPointRef.current = point
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onChange?.(canvasRef.current?.toDataURL('image/png') ?? null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-md border border-border-strong bg-white',
          disabled && 'opacity-60',
        )}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          role="img"
          aria-label={`${label}：${empty ? '尚未簽名' : '已簽名'}。請以滑鼠、觸控筆或手指書寫。`}
          className={cn(
            'block aspect-[3/1] w-full touch-none',
            disabled ? 'cursor-not-allowed' : 'cursor-crosshair',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-muted-foreground">
          {empty ? '請在框內簽名（滑鼠、觸控筆或手指皆可）' : '已簽名，如需重寫請按「清除」'}
        </p>
        <Button type="button" size="sm" variant="outline" disabled={disabled || empty} onClick={clear}>
          <Eraser />
          清除
        </Button>
      </div>
    </div>
  )
}
