import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import type { FieldType, FormFieldSchema, FormRule, FormSectionSchema } from '@/features/forms/types'
import {
  adminLoadOrCreateDraft,
  adminPublishFormVersion,
  adminSaveFormSchema,
} from '@/features/form-builder/api'
import { FormBuilderCanvas, moveItem, reorderById } from '@/features/form-builder/components/canvas'
import { FormBuilderPalette } from '@/features/form-builder/components/palette'
import { FormBuilderPreviewModal } from '@/features/form-builder/components/preview-modal'
import { FormBuilderSettingsPanel } from '@/features/form-builder/components/settings-panel'
import { useBuilderAutosave } from '@/features/form-builder/hooks/use-builder-autosave'
import { useBuilderHistory } from '@/features/form-builder/hooks/use-builder-history'
import type { BuilderSelection, FormBuilderMeta } from '@/features/form-builder/types'
import { findField } from '@/features/form-builder/types'
import {
  createDefaultField,
  createDefaultSection,
  duplicateField,
  fieldTypeLabel,
} from '@/features/form-builder/utils/field-defaults'
import { hasBlockingIssues, validateBuilderDocument } from '@/features/form-builder/utils/validate-client'

function saveStatusLabel(status: string, error: string | null): string {
  if (status === 'saving') return '儲存中…'
  if (status === 'saved') return '已儲存'
  if (status === 'error') return error ? `失敗：${error}` : '儲存失敗'
  if (status === 'dirty') return '尚未儲存'
  return '—'
}

export function AdminFormBuilderPage() {
  const { formId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const fromVersionId = searchParams.get('from') || undefined
  const { isAdmin } = useBackofficeAuth()

  const [meta, setMeta] = useState<FormBuilderMeta | null>(null)
  const [selection, setSelection] = useState<BuilderSelection>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  )

  const emptyDoc = useMemo(() => ({ sections: [], rules: [] }), [])
  const history = useBuilderHistory(emptyDoc)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const markSyncedRef = useRef<(revision: number) => void>(() => {})

  const autosave = useBuilderAutosave({
    enabled: Boolean(meta && meta.status === 'draft'),
    meta,
    document: meta ? history.document : null,
    revision: history.revision,
    onSaved: (document, nextMeta) => {
      setMeta(nextMeta)
      history.replaceWithoutHistory(document)
    },
  })
  markSyncedRef.current = autosave.markSynced

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isAdmin || !formId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void adminLoadOrCreateDraft(formId, fromVersionId)
      .then((session) => {
        if (cancelled) return
        setMeta(session.meta)
        history.reset(session.document)
        markSyncedRef.current(0)
        setSelection(
          session.document.sections[0]
            ? { type: 'section', sectionId: session.document.sections[0].id }
            : null,
        )
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // intentionally load once per formId/fromVersionId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, formId, fromVersionId])

  function targetSectionId(): string | null {
    if (selection?.type === 'section' || selection?.type === 'field') return selection.sectionId
    return history.document.sections[0]?.id || null
  }

  function addFieldToTarget(fieldType: FieldType) {
    const sid = targetSectionId()
    history.commit((doc) => {
      let sectionId = sid
      let sections = doc.sections
      if (!sectionId) {
        const section = createDefaultSection(doc)
        sections = [...doc.sections, section]
        sectionId = section.id
      }
      const working = { ...doc, sections }
      const field = createDefaultField(fieldType, working)
      sections = sections.map((section) => {
        if (section.id !== sectionId) return section
        const fields = [...section.fields, { ...field, sort_order: section.fields.length + 1 }]
        return { ...section, fields }
      })
      queueMicrotask(() => setSelection({ type: 'field', sectionId: sectionId!, fieldId: field.id }))
      return { ...doc, sections }
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.source === 'palette') {
      setActiveDragLabel(fieldTypeLabel(data.fieldType as FieldType))
      return
    }
    if (data?.type === 'field') {
      const found = findField(history.document, String(data.fieldId))
      setActiveDragLabel(found?.field.label || '欄位')
      return
    }
    if (data?.type === 'section') {
      const section = history.document.sections.find((item) => item.id === data.sectionId)
      setActiveDragLabel(section?.title || '區塊')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null)
    const { active, over } = event
    if (!over) return
    const activeData = active.data.current
    const overData = over.data.current
    const overId = String(over.id)

    if (activeData?.source === 'palette') {
      const fieldType = activeData.fieldType as FieldType
      let sectionId: string | undefined
      let overFieldId: string | undefined
      if (overData?.type === 'section-drop' || overData?.type === 'section') {
        sectionId = String(overData.sectionId)
      } else if (overData?.type === 'field') {
        sectionId = String(overData.sectionId)
        overFieldId = String(overData.fieldId)
      } else if (overId.startsWith('section-drop:')) sectionId = overId.replace('section-drop:', '')
      else if (overId.startsWith('section:')) sectionId = overId.replace('section:', '')
      else if (overId.startsWith('field:')) {
        overFieldId = overId.replace('field:', '')
        sectionId = findField(history.document, overFieldId)?.section.id
      }
      if (!sectionId) return
      history.commit((doc) => {
        const field = createDefaultField(fieldType, doc)
        return {
          ...doc,
          sections: doc.sections.map((section) => {
            if (section.id !== sectionId) return section
            const fields = [...section.fields]
            if (overFieldId) {
              const index = fields.findIndex((item) => item.id === overFieldId)
              fields.splice(index >= 0 ? index : fields.length, 0, field)
            } else fields.push(field)
            return {
              ...section,
              fields: fields.map((item, index) => ({ ...item, sort_order: index + 1 })),
            }
          }),
        }
      })
      return
    }

    if (activeData?.type === 'section' && overId.startsWith('section:')) {
      const activeSectionId = String(activeData.sectionId)
      const overSectionId = overId.replace('section:', '')
      if (activeSectionId === overSectionId) return
      history.commit((doc) => ({
        ...doc,
        sections: reorderById(doc.sections, activeSectionId, overSectionId),
      }))
      return
    }

    if (activeData?.type === 'field') {
      const fromSectionId = String(activeData.sectionId)
      const fieldId = String(activeData.fieldId)

      if (overData?.type === 'field') {
        const toSectionId = String(overData.sectionId)
        const overFieldId = String(overData.fieldId)
        history.commit((doc) => {
          if (fromSectionId === toSectionId) {
            return {
              ...doc,
              sections: doc.sections.map((section) =>
                section.id === fromSectionId
                  ? { ...section, fields: reorderById(section.fields, fieldId, overFieldId) }
                  : section,
              ),
            }
          }
          const located = findField(doc, fieldId)
          if (!located) return doc
          const moving = located.field
          return {
            ...doc,
            sections: doc.sections.map((section) => {
              if (section.id === fromSectionId) {
                return {
                  ...section,
                  fields: section.fields
                    .filter((item) => item.id !== fieldId)
                    .map((item, index) => ({ ...item, sort_order: index + 1 })),
                }
              }
              if (section.id === toSectionId) {
                const fields = section.fields.filter((item) => item.id !== fieldId)
                const index = fields.findIndex((item) => item.id === overFieldId)
                fields.splice(index >= 0 ? index : fields.length, 0, moving)
                return {
                  ...section,
                  fields: fields.map((item, i) => ({ ...item, sort_order: i + 1 })),
                }
              }
              return section
            }),
          }
        })
        return
      }

      const toSectionId = String(
        overData?.sectionId || overId.replace('section-drop:', '').replace('section:', ''),
      )
      if (toSectionId && toSectionId !== fromSectionId) {
        history.commit((doc) => {
          const located = findField(doc, fieldId)
          if (!located) return doc
          return {
            ...doc,
            sections: doc.sections.map((section) => {
              if (section.id === fromSectionId) {
                return {
                  ...section,
                  fields: section.fields
                    .filter((item) => item.id !== fieldId)
                    .map((item, index) => ({ ...item, sort_order: index + 1 })),
                }
              }
              if (section.id === toSectionId) {
                return {
                  ...section,
                  fields: [...section.fields, located.field].map((item, index) => ({
                    ...item,
                    sort_order: index + 1,
                  })),
                }
              }
              return section
            }),
          }
        })
      }
    }
  }

  async function handlePublish() {
    if (!meta) return
    const issues = validateBuilderDocument(history.document)
    if (hasBlockingIssues(issues)) {
      setError(issues.find((item) => item.severity === 'error')?.message || '結構驗證失敗')
      setPublishOpen(false)
      return
    }
    setPublishing(true)
    setError(null)
    try {
      const saved = await adminSaveFormSchema(meta.formId, meta.versionId, history.document)
      const published = await adminPublishFormVersion(saved.meta.formId, saved.meta.versionId)
      setMeta(published.meta)
      history.reset(published.document)
      setPublishOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '發布失敗')
    } finally {
      setPublishing(false)
    }
  }

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">僅管理員可使用 Form Builder。</p>
  }
  if (loading) return <p className="text-sm text-muted-foreground">載入表單草稿…</p>
  if (error && !meta) return <p className="text-sm text-red-700">{error}</p>
  if (!meta) return <p className="text-sm text-muted-foreground">找不到表單。</p>

  const codeEditable = meta.status === 'draft'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{meta.formName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Builder · V{meta.versionNumber} · {meta.status === 'draft' ? '草稿' : meta.status}
            {' · '}
            {saveStatusLabel(autosave.status, autosave.error)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/admin/forms">返回列表</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
          >
            復原
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!history.canRedo}
            onClick={() => history.redo()}
          >
            重做
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          {meta.status === 'draft' ? (
            <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>
              發布
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!isDesktop ? (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <p>建議使用桌面版進行表單設計</p>
          <Button type="button" className="mt-3" size="sm" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
            <FormBuilderPalette onAddField={addFieldToTarget} />
            <FormBuilderCanvas
              document={history.document}
              selection={selection}
              onSelect={setSelection}
              onAddSection={() => {
                history.commit((doc) => {
                  const section = createDefaultSection(doc)
                  queueMicrotask(() => setSelection({ type: 'section', sectionId: section.id }))
                  return { ...doc, sections: [...doc.sections, section] }
                })
              }}
              onDeleteSection={(sectionId) => {
                history.commit((doc) => ({
                  ...doc,
                  sections: doc.sections
                    .filter((section) => section.id !== sectionId)
                    .map((section, index) => ({ ...section, sort_order: index + 1 })),
                  rules: doc.rules.filter((rule) => {
                    const codes = new Set(
                      doc.sections
                        .filter((section) => section.id !== sectionId)
                        .flatMap((section) => section.fields.map((field) => field.code)),
                    )
                    return codes.has(rule.field_code)
                  }),
                }))
                setSelection(null)
              }}
              onDuplicateField={(fieldId) => {
                history.commit((doc) => {
                  const located = findField(doc, fieldId)
                  if (!located) return doc
                  const copy = duplicateField(located.field, doc)
                  return {
                    ...doc,
                    sections: doc.sections.map((section) => {
                      if (section.id !== located.section.id) return section
                      const fields = [...section.fields]
                      fields.splice(located.fieldIndex + 1, 0, copy)
                      return {
                        ...section,
                        fields: fields.map((item, index) => ({ ...item, sort_order: index + 1 })),
                      }
                    }),
                  }
                })
              }}
              onDeleteField={(fieldId) => {
                const located = findField(history.document, fieldId)
                history.commit((doc) => ({
                  ...doc,
                  sections: doc.sections.map((section) => ({
                    ...section,
                    fields: section.fields
                      .filter((field) => field.id !== fieldId)
                      .map((field, index) => ({ ...field, sort_order: index + 1 })),
                  })),
                  rules: doc.rules.filter(
                    (rule) => rule.field_id !== fieldId && rule.field_code !== located?.field.code,
                  ),
                }))
                setSelection(null)
              }}
              onMoveFieldInSection={(sectionId, fieldId, direction) => {
                history.commit((doc) => ({
                  ...doc,
                  sections: doc.sections.map((section) => {
                    if (section.id !== sectionId) return section
                    const index = section.fields.findIndex((field) => field.id === fieldId)
                    if (index < 0) return section
                    return {
                      ...section,
                      fields: moveItem(section.fields, index, direction).map((field, i) => ({
                        ...field,
                        sort_order: i + 1,
                      })),
                    }
                  }),
                }))
              }}
              onMoveSection={(sectionId, direction) => {
                history.commit((doc) => {
                  const index = doc.sections.findIndex((section) => section.id === sectionId)
                  if (index < 0) return doc
                  return {
                    ...doc,
                    sections: moveItem(doc.sections, index, direction).map((section, i) => ({
                      ...section,
                      sort_order: i + 1,
                    })),
                  }
                })
              }}
            />
            <FormBuilderSettingsPanel
              document={history.document}
              selection={selection}
              codeEditable={codeEditable}
              onUpdateSection={(sectionId, patch: Partial<FormSectionSchema>) => {
                history.commit((doc) => ({
                  ...doc,
                  sections: doc.sections.map((section) =>
                    section.id === sectionId ? { ...section, ...patch } : section,
                  ),
                }))
              }}
              onUpdateField={(fieldId, patch: Partial<FormFieldSchema>) => {
                history.commit((doc) => {
                  const located = findField(doc, fieldId)
                  const nextCode = patch.code
                  return {
                    ...doc,
                    sections: doc.sections.map((section) => ({
                      ...section,
                      fields: section.fields.map((field) =>
                        field.id === fieldId ? { ...field, ...patch } : field,
                      ),
                    })),
                    rules:
                      nextCode && located
                        ? doc.rules.map((rule) =>
                            rule.field_id === fieldId || rule.field_code === located.field.code
                              ? { ...rule, field_code: nextCode, field_id: fieldId }
                              : rule.source_field_code === located.field.code
                                ? { ...rule, source_field_code: nextCode }
                                : rule,
                          )
                        : doc.rules,
                  }
                })
              }}
              onUpdateRules={(rules: FormRule[]) => {
                history.commit((doc) => ({ ...doc, rules }))
              }}
            />
          </div>
          <DragOverlay>
            {activeDragLabel ? (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-md">
                {activeDragLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <FormBuilderPreviewModal
        open={previewOpen}
        meta={meta}
        document={history.document}
        onClose={() => setPreviewOpen(false)}
      />

      <ConfirmDialog
        open={publishOpen}
        title="發布此草稿？"
        description="發布後此版本將成為目前正式表單，且不可再直接修改結構。學生新送件會鎖定此版本。"
        confirmLabel="確認發布"
        busy={publishing}
        onCancel={() => setPublishOpen(false)}
        onConfirm={() => void handlePublish()}
      />
    </div>
  )
}
