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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">系統暫時發生問題</h1>
          <p className="max-w-md text-sm text-muted-foreground">請稍後再試。若持續發生，請聯絡承辦單位。</p>
          <Button type="button" onClick={() => window.location.assign('/')}>
            返回首頁
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
