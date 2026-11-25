import { Pencil, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ProcessStepper, type ProcessStep } from '@/components/common/process-stepper'
import { Button } from '@/components/ui/button'
import { StudentSubmitPanel } from '@/features/applications/components/student-submit-panel'
import { StudentSignaturePanel } from './student-signature-panel'

export function StudentPaperPanel({
  submissionId,
  categoryCode,
  submitted,
  onReedit,
  onSubmitted,
}: {
  submissionId: string
  categoryCode: string
  submitted: boolean
  onReedit: () => void
  onSubmitted: () => void
}) {
  const steps: ProcessStep[] = [
    { id: 'complete', label: '完成填寫', state: 'complete' },
    { id: 'esign', label: '電子簽名', state: submitted ? 'complete' : 'current' },
    { id: 'submit', label: '送交承辦', state: submitted ? 'complete' : 'current' },
    { id: 'print', label: '列印（選用）', state: 'upcoming' },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-card font-semibold text-foreground">正式申請表</h2>
          <p className="mt-1 text-sm text-subtle">
            請於下方完成電子簽名後線上送交承辦，即完成申請。列印／截圖僅供備援，不必再送課指組。
          </p>
        </header>

        <div className="border-b border-border px-5 py-4">
          <ProcessStepper steps={steps} ariaLabel="申請流程" />
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Button asChild variant="outline">
            <Link
              to={`/student/current/category/${encodeURIComponent(categoryCode)}/print?application=${encodeURIComponent(submissionId)}`}
            >
              <Printer />
              {submitted ? '列印申請表（選用）' : '預覽申請表'}
            </Link>
          </Button>
          {!submitted ? (
            <Button type="button" variant="ghost" onClick={onReedit}>
              <Pencil />
              重新編輯
            </Button>
          ) : null}
        </div>
      </section>

      <StudentSignaturePanel applicationId={submissionId} submitted={submitted} />

      <StudentSubmitPanel
        submissionId={submissionId}
        completed
        categoryCode={categoryCode}
        onSubmitted={onSubmitted}
      />
    </div>
  )
}
