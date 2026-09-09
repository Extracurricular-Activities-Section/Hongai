import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FormFieldSchema, FormSectionSchema } from '@/features/forms/types'
import { cn } from '@/lib/utils'
import type { BuilderDocument, BuilderSelection } from '../types'
import { fieldTypeLabel } from '../utils/field-defaults'

function SortableFieldCard({
  sectionId,
  field,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  sectionId: string
  field: FormFieldSchema
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field:${field.id}`,
    data: { type: 'field', sectionId, fieldId: field.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-md border border-border bg-background p-3',
        selected && 'ring-2 ring-ring',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <p className="truncate text-sm font-medium">{field.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fieldTypeLabel(field.field_type)} · {field.code}
            {field.required ? ' · 必填' : ''}
          </p>
        </button>
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" {...attributes} {...listeners}>
            拖曳
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onMoveUp}>
            上移
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onMoveDown}>
            下移
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
            複製
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDelete}>
            刪除
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortableSection({
  section,
  selected,
  selectedFieldId,
  onSelectSection,
  onSelectField,
  onDuplicateField,
  onDeleteField,
  onDeleteSection,
  onMoveField,
  onMoveSection,
}: {
  section: FormSectionSchema
  selected: boolean
  selectedFieldId?: string
  onSelectSection: () => void
  onSelectField: (fieldId: string) => void
  onDuplicateField: (fieldId: string) => void
  onDeleteField: (fieldId: string) => void
  onDeleteSection: () => void
  onMoveField: (fieldId: string, direction: -1 | 1) => void
  onMoveSection: (direction: -1 | 1) => void
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section-drop:${section.id}`,
    data: { type: 'section-drop', sectionId: section.id },
  })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section:${section.id}`,
    data: { type: 'section', sectionId: section.id },
  })

  const fieldIds = section.fields.map((field) => `field:${field.id}`)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-lg border border-border bg-muted/20 p-3',
        selected && 'ring-2 ring-ring',
        isDragging && 'opacity-60',
        isOver && 'bg-muted/40',
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelectSection}>
          <p className="text-sm font-semibold">{section.title}</p>
          <p className="text-xs text-muted-foreground">{section.code}</p>
        </button>
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" {...attributes} {...listeners}>
            拖曳區塊
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onMoveSection(-1)}>
            區塊上移
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onMoveSection(1)}>
            區塊下移
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDeleteSection}>
            刪除區塊
          </Button>
        </div>
      </div>

      <div ref={setDropRef} className="min-h-16 space-y-2">
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {section.fields.map((field) => (
            <SortableFieldCard
              key={field.id}
              sectionId={section.id}
              field={field}
              selected={selectedFieldId === field.id}
              onSelect={() => onSelectField(field.id)}
              onDuplicate={() => onDuplicateField(field.id)}
              onDelete={() => onDeleteField(field.id)}
              onMoveUp={() => onMoveField(field.id, -1)}
              onMoveDown={() => onMoveField(field.id, 1)}
            />
          ))}
        </SortableContext>
        {section.fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            將欄位拖曳到此區塊
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function FormBuilderCanvas({
  document,
  selection,
  onSelect,
  onAddSection,
  onDeleteSection,
  onDuplicateField,
  onDeleteField,
  onMoveFieldInSection,
  onMoveSection,
}: {
  document: BuilderDocument
  selection: BuilderSelection
  onSelect: (selection: BuilderSelection) => void
  onAddSection: () => void
  onDeleteSection: (sectionId: string) => void
  onDuplicateField: (fieldId: string) => void
  onDeleteField: (fieldId: string) => void
  onMoveFieldInSection: (sectionId: string, fieldId: string, direction: -1 | 1) => void
  onMoveSection: (sectionId: string, direction: -1 | 1) => void
}) {
  const sectionIds = document.sections.map((section) => `section:${section.id}`)

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <div>
          <CardTitle className="text-base">畫布</CardTitle>
          <p className="text-xs text-muted-foreground">調整區塊與欄位順序</p>
        </div>
        <Button type="button" size="sm" onClick={onAddSection}>
          新增區塊
        </Button>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-12rem)] space-y-3 overflow-y-auto pb-4">
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {document.sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              selected={selection?.type === 'section' && selection.sectionId === section.id}
              selectedFieldId={
                selection?.type === 'field' && selection.sectionId === section.id
                  ? selection.fieldId
                  : undefined
              }
              onSelectSection={() => onSelect({ type: 'section', sectionId: section.id })}
              onSelectField={(fieldId) => onSelect({ type: 'field', sectionId: section.id, fieldId })}
              onDuplicateField={onDuplicateField}
              onDeleteField={onDeleteField}
              onDeleteSection={() => onDeleteSection(section.id)}
              onMoveField={(fieldId, direction) => onMoveFieldInSection(section.id, fieldId, direction)}
              onMoveSection={(direction) => onMoveSection(section.id, direction)}
            />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  )
}

export function reorderById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] {
  const oldIndex = items.findIndex((item) => item.id === activeId)
  const newIndex = items.findIndex((item) => item.id === overId)
  if (oldIndex < 0 || newIndex < 0) return items
  return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
    ...item,
    sort_order: index + 1,
  }))
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  return arrayMove(items, index, target)
}
