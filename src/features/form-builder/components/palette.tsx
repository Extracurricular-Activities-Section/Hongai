import { useDraggable } from '@dnd-kit/core'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FieldType } from '@/features/forms/types'
import { PALETTE_ITEMS } from '../utils/field-defaults'
import { cn } from '@/lib/utils'

function PaletteDraggable({
  fieldType,
  label,
  description,
}: {
  fieldType: FieldType
  label: string
  description: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${fieldType}`,
    data: { source: 'palette', fieldType },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-left transition hover:bg-muted/50',
        isDragging && 'opacity-50',
      )}
      {...listeners}
      {...attributes}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  )
}

export function FormBuilderPalette({
  onAddField,
}: {
  onAddField: (fieldType: FieldType) => void
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="text-base">欄位元件</CardTitle>
        <p className="text-xs text-muted-foreground">拖曳到畫布，或點擊新增到目前區塊</p>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pb-4">
        {PALETTE_ITEMS.map((item) => (
          <div key={item.field_type} className="space-y-1">
            <PaletteDraggable
              fieldType={item.field_type}
              label={item.label}
              description={item.description}
            />
            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onAddField(item.field_type)}
            >
              新增「{item.label}」
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
