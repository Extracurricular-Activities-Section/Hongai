import { Pencil, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ProcessStepper, type ProcessStep } from '@/components/common/process-stepper'
import { Button } from '@/components/ui/button'
import { StudentSubmitPanel } from '@/features/applications/components/student-submit-panel'

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
    { id: 'submit', label: '送交承辦', state: submitted ? 'complete' : 'current' },
    { id: 'print', label: '列印或截圖', state: submitted ? 'current' : 'upcoming' },
    { id: 'sign', label: '老師簽名後送課指組', state: 'upcoming' },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-card font-semibold text-foreground">紙本申請表</h2>
          <p className="mt-1 text-sm text-subtle">
            線上送交後，請開啟申請表畫面列印或截圖，交由系輔導老師確認簽名，再送至課指組（H101）才算完成申請。系統不另外產生 PDF 檔。
          </p>
        </header>

        <div className="border-b border-border px-5 py-4">
          <ProcessStepper steps={steps} ariaLabel="申請流程" />
        </div>

        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Button asChild variant={submitted ? 'brand' : 'outline'}>
            <Link to={`/student/current/category/${categoryCode}/print`}>
              <Printer />
              {submitted ? '列印／截圖申請表' : '預覽申請表'}
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

      <StudentSubmitPanel
        submissionId={submissionId}
        completed
        categoryCode={categoryCode}
        onSubmitted={onSubmitted}
      />
    </div>
  )
}
