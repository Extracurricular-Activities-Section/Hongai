import { Monitor, RotateCcw, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DynamicFormRenderer } from '@/features/forms/components/dynamic-form-renderer'
import { buildInitialValues, calculateComputedFields, evaluateRules } from '@/features/forms/engine'
import type { FormFieldValue, FormSchema, FormValues } from '@/features/forms/types'
import { cn } from '@/lib/utils'
import type { BuilderDocument, FormBuilderMeta } from '../types'
import { documentToSchema } from '../types'

export function FormBuilderPreviewModal({
  open,
  meta,
  document,
  onClose,
}: {
  open: boolean
  meta: FormBuilderMeta
  document: BuilderDocument
  onClose: () => void
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const schema: FormSchema = useMemo(() => documentToSchema(meta, document), [meta, document])
  const [values, setValues] = useState<FormValues>({})

  useEffect(() => {
    if (!open) return
    setValues(buildInitialValues(schema))
  }, [open, schema])

  const liveValues = useMemo(() => calculateComputedFields(schema, values), [schema, values])
  const fieldState = useMemo(() => evaluateRules(schema, liveValues), [schema, liveValues])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col p-0">
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <DialogTitle>預覽：{meta.formName}</DialogTitle>
            <DialogDescription>僅供預覽，不會送出或儲存填寫內容。</DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="預覽寬度" className="flex gap-1">
              <Button
                type="button"
                size="icon-sm"
                aria-label="桌面寬度"
                aria-pressed={viewport === 'desktop'}
                variant={viewport === 'desktop' ? 'default' : 'ghost'}
                onClick={() => setViewport('desktop')}
              >
                <Monitor />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                aria-label="手機寬度"
                aria-pressed={viewport === 'mobile'}
                variant={viewport === 'mobile' ? 'default' : 'ghost'}
                onClick={() => setViewport('mobile')}
              >
                <Smartphone />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setValues(buildInitialValues(schema))}
            >
              <RotateCcw />
              重設
            </Button>
          </div>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto bg-background p-5">
          <div
            className={cn(
              'mx-auto rounded-lg border border-border bg-surface p-6',
              viewport === 'mobile' ? 'max-w-sm' : 'max-w-2xl',
            )}
          >
            <DynamicFormRenderer
              schema={schema}
              values={liveValues}
              fieldState={fieldState}
              mode="edit"
              onChange={(code: string, value: FormFieldValue) => {
                setValues((current) =>
                  calculateComputedFields(schema, { ...current, [code]: value }),
                )
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
