import { useCallback, useState } from 'react'

import type { BuilderDocument, BuilderHistoryEntry } from '../types'
import { cloneDocument } from '../types'

const MAX_HISTORY = 40

export function useBuilderHistory(initial: BuilderDocument) {
  const [document, setDocument] = useState<BuilderDocument>(initial)
  const [past, setPast] = useState<BuilderHistoryEntry[]>([])
  const [future, setFuture] = useState<BuilderHistoryEntry[]>([])
  const [revision, setRevision] = useState(0)

  const bump = useCallback(() => setRevision((value) => value + 1), [])

  const reset = useCallback((next: BuilderDocument) => {
    setPast([])
    setFuture([])
    setDocument(cloneDocument(next))
    setRevision(0)
  }, [])

  const commit = useCallback(
    (updater: (current: BuilderDocument) => BuilderDocument) => {
      setDocument((current) => {
        const snapshot = cloneDocument(current)
        const next = updater(cloneDocument(current))
        setPast((items) => [...items, snapshot].slice(-MAX_HISTORY))
        setFuture([])
        bump()
        return next
      })
    },
    [bump],
  )

  const replaceWithoutHistory = useCallback((next: BuilderDocument) => {
    // Keep revision stable so autosave does not loop after server round-trip.
    setDocument(cloneDocument(next))
  }, [])

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items
      const previous = items[items.length - 1]
      setDocument((current) => {
        setFuture((nextFuture) => [cloneDocument(current), ...nextFuture].slice(0, MAX_HISTORY))
        bump()
        return cloneDocument(previous)
      })
      return items.slice(0, -1)
    })
  }, [bump])

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items
      const next = items[0]
      setDocument((current) => {
        setPast((prev) => [...prev, cloneDocument(current)].slice(-MAX_HISTORY))
        bump()
        return cloneDocument(next)
      })
      return items.slice(1)
    })
  }, [bump])

  return {
    document,
    revision,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    commit,
    reset,
    replaceWithoutHistory,
    undo,
    redo,
  }
}
