import { AlertTriangle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[had] app error', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-pill bg-danger-soft text-danger">
            <AlertTriangle className="size-5" />
          </span>
          <h1 className="mt-5 text-section font-semibold text-foreground">系統暫時發生問題</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-subtle">
            請稍後再試。若持續發生，請聯絡承辦單位協助處理。
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => window.location.reload()}>
              重新載入
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign('/')}>
              返回首頁
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
