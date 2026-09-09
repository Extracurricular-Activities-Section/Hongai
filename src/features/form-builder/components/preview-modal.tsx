import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden shadow-lg">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <CardTitle className="text-base">預覽：{meta.formName}</CardTitle>
            <p className="text-xs text-muted-foreground">僅預覽，不會送出或儲存填寫內容</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={viewport === 'desktop' ? 'default' : 'outline'}
              onClick={() => setViewport('desktop')}
            >
              桌面
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewport === 'mobile' ? 'default' : 'outline'}
              onClick={() => setViewport('mobile')}
            >
              手機
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setValues(buildInitialValues(schema))}
            >
              重設預覽資料
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              關閉
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <div
            className={cn(
              'mx-auto rounded-md border border-border bg-background p-4',
              viewport === 'mobile' ? 'max-w-sm' : 'max-w-3xl',
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
        </CardContent>
      </Card>
    </div>
  )
}
