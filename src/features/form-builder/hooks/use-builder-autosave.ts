import { useEffect, useRef, useState } from 'react'

import { adminSaveFormSchema } from '../api'
import type { AutosaveStatus, BuilderDocument, FormBuilderMeta } from '../types'

export function useBuilderAutosave(options: {
  enabled: boolean
  meta: FormBuilderMeta | null
  document: BuilderDocument | null
  revision: number
  debounceMs?: number
  onSaved?: (sessionDocument: BuilderDocument, meta: FormBuilderMeta) => void
}) {
  const { enabled, meta, document, revision, debounceMs = 1200, onSaved } = options
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const skipRevisionRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const pendingRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    if (!enabled || !meta || !document) return
    if (meta.status !== 'draft') return
    if (skipRevisionRef.current === revision) return

    setStatus('dirty')
    setError(null)
    const timer = window.setTimeout(() => {
      void (async () => {
        if (savingRef.current) {
          pendingRef.current = true
          return
        }
        savingRef.current = true
        setStatus('saving')
        const revisionAtSave = revision
        try {
          const saved = await adminSaveFormSchema(meta.formId, meta.versionId, document)
          skipRevisionRef.current = revisionAtSave
          setLastSavedAt(new Date().toISOString())
          setStatus('saved')
          setError(null)
          onSavedRef.current?.(saved.document, saved.meta)
        } catch (err) {
          setStatus('error')
          setError(err instanceof Error ? err.message : '儲存失敗')
        } finally {
          savingRef.current = false
          if (pendingRef.current) {
            pendingRef.current = false
            setStatus('dirty')
          }
        }
      })()
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [enabled, meta, document, revision, debounceMs])

  function markSynced(revisionValue: number) {
    skipRevisionRef.current = revisionValue
    setStatus('saved')
    setError(null)
  }

  return { status, error, lastSavedAt, markSynced, setStatus, setError }
}
