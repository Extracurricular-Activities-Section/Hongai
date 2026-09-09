import { ArrowLeft, ArrowRight, Check, CopyPlus, Save, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'

import { type ProcessStep, StepRail } from '@/components/common/process-stepper'
import { SaveIndicator, type SaveState as IndicatorState } from '@/components/common/save-indicator'
import { ErrorState, InlineNotice } from '@/components/common/states'
import { StickyActionBar } from '@/components/common/sticky-action-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

const INDICATOR_STATE: Record<SaveState, IndicatorState> = {
  idle: 'idle',
  pending: 'saving',
  saved: 'saved',
  error: 'error',
}

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
  const contentRef = useRef<HTMLDivElement>(null)

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

  function goToStep(next: number) {
    setStep(next)
    contentRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  if (error && !workspace) {
    return (
      <div className="space-y-4">
        <ErrorState message={error} />
        <Button asChild variant="outline">
          <Link to="/student/current">返回申請項目</Link>
        </Button>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <Skeleton className="hidden h-64 lg:block" />
          <Skeleton className="h-[26rem]" />
        </div>
      </div>
    )
  }

  const applicantName = String(workspace.applicant.name || '')
  const studentNo = String(workspace.applicant.student_no || '')
  const department = String(workspace.applicant.department_name || '')
  const errorIssues = issues.filter((issue) => issue.severity === 'error')
  const warningIssues = issues.filter((issue) => issue.severity === 'warning')

  if (completed) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-success-border bg-success-soft p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-pill bg-success text-white">
            <Check className="size-5" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-section font-semibold text-foreground">申請內容已完成</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-subtle">
            下一步請產生並列印正式 PDF 申請表，完成紙本簽核後再依承辦說明辦理送件。
          </p>
        </div>

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

        <Button asChild variant="outline">
          <Link to="/student/current">
            <ArrowLeft />
            返回申請項目
          </Link>
        </Button>
      </div>
    )
  }

  const steps: ProcessStep[] = [
    ...sections.map((section, index) => ({
      id: String(index),
      label: section.title,
      state: (index < step ? 'complete' : index === step ? 'current' : 'upcoming') as ProcessStep['state'],
    })),
    {
      id: String(sections.length),
      label: '確認送出',
      state: (isConfirmStep ? 'current' : 'upcoming') as ProcessStep['state'],
    },
  ]

  const activeSection = sections[step]

  return (
    <div className="space-y-6">
      {/* Workspace top bar: identity of the task plus the way out. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-meta text-muted-foreground">{workspace.period.name}</p>
          <h1 className="mt-0.5 text-page font-semibold text-foreground">
            {workspace.category.name}
          </h1>
          <p className="mt-1.5 text-meta text-muted-foreground">
            {applicantName} · {studentNo} · {department}
            <Link
              to="/student/profile"
              className="ml-2 rounded-sm underline underline-offset-4 hover:text-foreground"
            >
              查看共用資料
            </Link>
          </p>
        </div>

        <Button
          asChild
          variant="ghost"
          size="sm"
        >
          <Link
            to="/student/current"
            onClick={(event) => {
              if (saveState === 'pending') {
                event.preventDefault()
                void persist(false).then(() => navigate('/student/current'))
              }
            }}
          >
            <X />
            離開並保留草稿
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <StepRail
            steps={steps}
            activeId={String(step)}
            onSelect={(id) => goToStep(Number(id))}
            ariaLabel="申請表區段"
          />
        </div>

        <div ref={contentRef} className="min-w-0 max-w-[46rem]">
          {error ? (
            <ErrorState title="無法繼續" message={error} className="mb-5" />
          ) : null}

          {errorIssues.length > 0 ? (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-danger-border bg-danger-soft px-4 py-3"
            >
              <p className="text-sm font-medium text-danger">
                有 {errorIssues.length} 個項目需要修正
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-meta text-danger/90">
                {errorIssues.slice(0, 5).map((issue) => (
                  <li key={`${issue.code}-${issue.field_code}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {warningIssues.map((issue) => (
            <InlineNotice
              key={`${issue.code}-${issue.field_code}`}
              tone="attention"
              className="mb-3"
            >
              {issue.message}
            </InlineNotice>
          ))}

          {!isConfirmStep && activeSection ? (
            <>
              <div className="mb-6 border-b border-border pb-4">
                <p className="text-meta text-muted-foreground tabular">
                  第 {step + 1} 段 / 共 {sections.length + 1} 段
                </p>
                <h2 className="mt-1 text-section font-semibold text-foreground">
                  {activeSection.title}
                </h2>
                {activeSection.description ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-subtle">
                    {activeSection.description}
                  </p>
                ) : null}
              </div>

              <DynamicFormRenderer
                schema={{ ...workspace.schema, sections: [activeSection] }}
                values={values}
                fieldState={fieldState}
                mode="edit"
                hideSectionHeadings
                onChange={updateField}
                submissionId={workspace.submission.id}
              />
            </>
          ) : (
            <>
              <div className="mb-6 border-b border-border pb-4">
                <p className="text-meta text-muted-foreground tabular">
                  第 {sections.length + 1} 段 / 共 {sections.length + 1} 段
                </p>
                <h2 className="mt-1 text-section font-semibold text-foreground">確認申請內容</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-subtle">
                  請確認以下內容無誤。完成填寫後仍可返回修改，直到送出紙本前都會保留。
                </p>
              </div>

              <div className="mb-8 rounded-lg border border-border bg-surface-muted px-4 py-3.5">
                <p className="text-meta font-medium text-muted-foreground">共用資料</p>
                <p className="mt-1 text-sm text-foreground">
                  {applicantName} · {studentNo} · {department}
                </p>
              </div>

              <DynamicFormRenderer
                schema={workspace.schema}
                values={values}
                fieldState={fieldState}
                mode="readonly"
                submissionId={workspace.submission.id}
              />
            </>
          )}

          <StickyActionBar
            status={
              <SaveIndicator
                state={INDICATOR_STATE[saveState]}
                savedAtLabel={
                  workspace.submission.last_saved_at
                    ? formatTaipeiDateTime(workspace.submission.last_saved_at)
                    : null
                }
              />
            }
            start={
              step > 0 ? (
                <Button type="button" variant="outline" onClick={() => goToStep(step - 1)}>
                  <ArrowLeft />
                  上一步
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
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
                  <CopyPlus />
                  套用上一期
                </Button>
              )
            }
            end={
              <>
                <Button type="button" variant="outline" onClick={() => void persist(true)}>
                  <Save />
                  儲存
                </Button>
                {!isConfirmStep ? (
                  <Button type="button" onClick={() => goToStep(step + 1)}>
                    下一步
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button type="button" variant="brand" onClick={() => void handleComplete()}>
                    <Check />
                    完成填寫
                  </Button>
                )}
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}
