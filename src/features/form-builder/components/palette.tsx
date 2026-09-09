import { useDraggable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { FieldType } from '@/features/forms/types'
import { PALETTE_ITEMS } from '../utils/field-defaults'

function PaletteItem({
  fieldType,
  label,
  description,
  onAdd,
}: {
  fieldType: FieldType
  label: string
  description: string
  onAdd: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${fieldType}`,
    data: { source: 'palette', fieldType },
  })

  return (
    <div
      className={cn(
        'group/item flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 transition-colors hover:border-border-strong',
        isDragging && 'opacity-50',
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        aria-label={`拖曳新增 ${label}`}
        className="min-w-0 flex-1 cursor-grab rounded-sm text-left active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-meta text-muted-foreground">{description}</span>
      </button>

      <button
        type="button"
        aria-label={`新增 ${label} 到目前區塊`}
        onClick={onAdd}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-surface-sunken hover:text-foreground focus-visible:opacity-100 group-hover/item:opacity-100"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function FormBuilderPalette({
  onAddField,
}: {
  onAddField: (fieldType: FieldType) => void
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">欄位元件</h2>
        <p className="mt-0.5 text-meta text-muted-foreground">拖曳到畫布，或按 + 加入目前區塊</p>
      </header>

      <div className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto p-3">
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem
            key={item.field_type}
            fieldType={item.field_type}
            label={item.label}
            description={item.description}
            onAdd={() => onAddField(item.field_type)}
          />
        ))}
      </div>
    </div>
  )
}
