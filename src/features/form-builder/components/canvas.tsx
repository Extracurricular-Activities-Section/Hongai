import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FormFieldSchema, FormSectionSchema } from '@/features/forms/types'
import { cn } from '@/lib/utils'
import type { BuilderDocument, BuilderSelection } from '../types'
import { fieldTypeLabel } from '../utils/field-defaults'

const iconButtonClass =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground'

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
        'group/field flex items-center gap-2 rounded-md border bg-surface px-2 py-2 transition-colors',
        selected
          ? 'border-accent-strong bg-accent-soft/50'
          : 'border-border hover:border-border-strong',
        isDragging && 'opacity-60 shadow-md',
      )}
    >
      <button
        type="button"
        aria-label={`拖曳 ${field.label}`}
        className={cn(iconButtonClass, 'cursor-grab active:cursor-grabbing')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <button type="button" className="min-w-0 flex-1 rounded-sm text-left" onClick={onSelect}>
        <span className="block truncate text-sm font-medium text-foreground">{field.label}</span>
        <span className="block truncate text-meta text-muted-foreground">
          {fieldTypeLabel(field.field_type)} · {field.code}
          {field.required ? ' · 必填' : ''}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/field:opacity-100">
        <button type="button" aria-label="上移欄位" className={iconButtonClass} onClick={onMoveUp}>
          <ChevronUp className="size-4" />
        </button>
        <button type="button" aria-label="下移欄位" className={iconButtonClass} onClick={onMoveDown}>
          <ChevronDown className="size-4" />
        </button>
        <button type="button" aria-label="複製欄位" className={iconButtonClass} onClick={onDuplicate}>
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          aria-label="刪除欄位"
          className={cn(iconButtonClass, 'hover:bg-danger-soft hover:text-danger')}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </button>
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
        'group/section rounded-lg border bg-surface-muted/60 p-3 transition-colors',
        selected ? 'border-accent-strong' : 'border-border',
        isDragging && 'opacity-60 shadow-md',
        isOver && 'border-accent-strong bg-accent-soft/40',
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          aria-label={`拖曳區塊 ${section.title}`}
          className={cn(iconButtonClass, 'cursor-grab active:cursor-grabbing')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <button type="button" className="min-w-0 flex-1 rounded-sm text-left" onClick={onSelectSection}>
          <span className="block truncate text-sm font-semibold text-foreground">
            {section.title}
          </span>
          <span className="block truncate text-meta text-muted-foreground">
            {section.code} · {section.fields.length} 個欄位
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/section:opacity-100">
          <button
            type="button"
            aria-label="區塊上移"
            className={iconButtonClass}
            onClick={() => onMoveSection(-1)}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="區塊下移"
            className={iconButtonClass}
            onClick={() => onMoveSection(1)}
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label="刪除區塊"
            className={cn(iconButtonClass, 'hover:bg-danger-soft hover:text-danger')}
            onClick={onDeleteSection}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div ref={setDropRef} className="min-h-16 space-y-1.5">
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
          <p className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-meta text-muted-foreground">
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
    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">表單結構</h2>
        <Button type="button" size="sm" variant="outline" onClick={onAddSection}>
          <Plus />
          新增區塊
        </Button>
      </header>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
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

        {document.sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">尚未建立任何區塊</p>
            <p className="mt-1 text-meta text-muted-foreground">
              先新增一個區塊，再從左側拖入欄位。
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onAddSection}>
              <Plus />
              新增區塊
            </Button>
          </div>
        ) : null}
      </div>
    </div>
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
