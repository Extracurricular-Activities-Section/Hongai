import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  completeFormSubmission,
  copyPreviousFormSubmission,
  fetchFormWorkspace,
  saveFormSubmission,
  type FormWorkspaceResponse,
} from '@/features/forms/api'
import { DynamicFormRenderer } from '@/features/forms/components/dynamic-form-renderer'
import {
  buildInitialValues,
  calculateComputedFields,
  evaluateRules,
  validateFormValues,
} from '@/features/forms/engine'
import type { FormFieldValue, FormIssue, FormValues } from '@/features/forms/types'
import { StudentPdfPanel } from '@/features/pdf/components/student-pdf-panel'
import { getSignatureUploadMode } from '@/features/pdf/utils/signature-upload-mode'
import { formatTaipeiDateTime } from '@/lib/utils'

type SaveState = 'idle' | 'pending' | 'saved' | 'error'

export function StudentCategoryFormPage() {
  const { categoryCode = '' } = useParams()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<FormWorkspaceResponse | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<FormIssue[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [completed, setCompleted] = useState(false)
  const [dirty, setDirty] = useState(false)
  const timerRef = useRef<number | null>(null)
  const valuesRef = useRef<FormValues>({})

  const load = useCallback(async () => {
    setError(null)
    const data = await fetchFormWorkspace(categoryCode)
    const initial = buildInitialValues(data.schema, data.answers)
    setWorkspace(data)
    setValues(initial)
    valuesRef.current = initial
    setCompleted(data.submission.status === 'completed')
    setDirty(false)
  }, [categoryCode])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  const fieldState = useMemo(
    () => (workspace ? evaluateRules(workspace.schema, values) : {}),
    [workspace, values],
  )

  const sections = workspace?.schema.sections || []
  const isConfirmStep = workspace ? step >= sections.length : false

  const blocker = useBlocker(dirty && saveState === 'pending')

  useEffect(() => {
    if (blocker.state === 'blocked' && saveState !== 'pending') {
      blocker.proceed?.()
    }
  }, [blocker, saveState])

  async function persist(createSnapshot = false) {
    if (!workspace) return
    setSaveState('pending')
    try {
      const computed = calculateComputedFields(workspace.schema, valuesRef.current)
      const result = await saveFormSubmission({
        submission_id: workspace.submission.id,
        answers: computed,
        create_snapshot: createSnapshot,
      })
      setValues(result.answers)
      valuesRef.current = result.answers
      setIssues(result.issues || [])
      setSaveState('saved')
      setDirty(false)
      setCompleted(false)
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              submission: {
                ...prev.submission,
                status: result.status as 'draft' | 'completed',
                last_saved_at: result.last_saved_at,
              },
              answers: result.answers,
            }
          : prev,
      )
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : '儲存失敗')
    }
  }

  function updateField(code: string, value: FormFieldValue) {
    if (!workspace) return
    setDirty(true)
    setSaveState('pending')
    setValues((prev) => {
      const next = calculateComputedFields(workspace.schema, { ...prev, [code]: value })
      valuesRef.current = next
      return next
    })
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void persist(false)
    }, 1000)
  }

  async function handleComplete() {
    if (!workspace) return
    const computed = calculateComputedFields(workspace.schema, values)
    const localIssues = validateFormValues(workspace.schema, computed, 'complete')
    const errors = localIssues.filter((issue) => issue.severity === 'error')
    setIssues(localIssues)
    if (errors.length) {
      setError('尚有必填或缺漏項目，請返回修改')
      return
    }
    try {
      await completeFormSubmission({
        submission_id: workspace.submission.id,
        answers: computed,
      })
      setCompleted(true)
      setDirty(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '完成填寫失敗')
    }
  }

  if (error && !workspace) return <p className="text-sm text-red-700">{error}</p>
  if (!workspace) return <p className="text-sm text-muted-foreground">載入中…</p>

  const applicantName = String(workspace.applicant.name || '')
  const studentNo = String(workspace.applicant.student_no || '')
  const department = String(workspace.applicant.department_name || '')

  if (completed) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>申請內容已完成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>下一步為：產生並列印正式 PDF 申請表，完成紙本簽核後再辦理後續送件。</p>
            <Button asChild variant="outline">
              <Link to="/student/current">返回申請項目</Link>
            </Button>
          </CardContent>
        </Card>
        <StudentPdfPanel
          submissionId={workspace.submission.id}
          completed={completed}
          categoryCode={workspace.category.code}
          signatureUploadMode={getSignatureUploadMode(workspace.category.code)}
          onReedit={() => {
            setCompleted(false)
            setStep(0)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.category.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{workspace.period.name}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {saveState === 'pending'
            ? '儲存中…'
            : saveState === 'saved'
              ? '✓ 已儲存'
              : saveState === 'error'
                ? '儲存失敗，請重試'
                : workspace.submission.last_saved_at
                  ? `最後儲存：${formatTaipeiDateTime(workspace.submission.last_saved_at)}`
                  : '尚未儲存'}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請人摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{applicantName}</p>
          <p>{studentNo}</p>
          <p>{department}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/student/profile">查看共用資料</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {sections.map((section, index) => (
          <Button
            key={section.id}
            type="button"
            size="sm"
            variant={step === index ? 'default' : 'outline'}
            onClick={() => setStep(index)}
          >
            {index + 1}. {section.title}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={isConfirmStep ? 'default' : 'outline'}
          onClick={() => setStep(sections.length)}
        >
          {sections.length + 1}. 確認
        </Button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {issues
        .filter((issue) => issue.severity === 'warning')
        .map((issue) => (
          <p key={`${issue.code}-${issue.field_code}`} className="text-sm text-amber-700">
            {issue.message}
          </p>
        ))}

      {!isConfirmStep ? (
        <DynamicFormRenderer
          schema={{
            ...workspace.schema,
            sections: [sections[step]].filter(Boolean),
          }}
          values={values}
          fieldState={fieldState}
          mode="edit"
          onChange={updateField}
          submissionId={workspace.submission.id}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">確認申請內容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm">
              <p className="font-medium">共用資料摘要</p>
              <p>
                {applicantName}／{studentNo}／{department}
              </p>
            </div>
            <DynamicFormRenderer
              schema={workspace.schema}
              values={values}
              fieldState={fieldState}
              mode="readonly"
              submissionId={workspace.submission.id}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((prev) => prev - 1)}>
            上一步
          </Button>
        ) : null}
        {!isConfirmStep ? (
          <Button type="button" onClick={() => setStep((prev) => prev + 1)}>
            下一步
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              返回修改
            </Button>
            <Button type="button" onClick={() => void handleComplete()}>
              完成填寫
            </Button>
          </>
        )}
        <Button type="button" variant="outline" onClick={() => void persist(true)}>
          儲存
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void (async () => {
              try {
                const result = await copyPreviousFormSubmission(categoryCode)
                setValues(result.answers)
                valuesRef.current = result.answers
                setIssues([])
                setError(null)
              } catch (err) {
                setError(err instanceof Error ? err.message : '套用失敗')
              }
            })()
          }}
        >
          套用上一期資料
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/student/current"
            onClick={(event) => {
              if (saveState === 'pending') {
                event.preventDefault()
                void persist(false).then(() => navigate('/student/current'))
              }
            }}
          >
            返回
          </Link>
        </Button>
      </div>
    </div>
  )
}
