import { Download, Eye, FileText, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  canPreviewExtension,
  downloadAttachmentBlob,
  formatFileSize,
  softDeleteAttachment,
  uploadAttachment,
} from '../api'
import type { Attachment, AttachmentContext } from '../types'

export interface SecureFileUploadProps {
  allowedExtensions: string[]
  maxSizeMb: number
  maxFiles: number
  context: AttachmentContext
  submissionId?: string
  applicationId?: string
  fieldCode?: string
  supplementRequestId?: string
  followUpTaskId?: string
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  required?: boolean
  helpText?: string
  label?: string
  asStaff?: boolean
  /** Optional known metadata (e.g. from task detail) to avoid re-fetch */
  knownAttachments?: Array<Pick<Attachment, 'id' | 'original_filename' | 'size_bytes' | 'extension' | 'mime_type'>>
}

interface FileMeta {
  id: string
  original_filename: string
  size_bytes: number
  extension: string
  mime_type?: string
}

function normalizeExt(name: string): string {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

export function SecureFileUpload({
  allowedExtensions,
  maxSizeMb,
  maxFiles,
  context,
  submissionId,
  applicationId,
  fieldCode,
  supplementRequestId,
  followUpTaskId,
  value,
  onChange,
  disabled = false,
  required = false,
  helpText,
  label,
  asStaff = false,
  knownAttachments,
}: SecureFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [metaById, setMetaById] = useState<Record<string, FileMeta>>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)

  const allowed = useMemo(
    () => allowedExtensions.map((ext) => ext.replace(/^\./, '').toLowerCase()),
    [allowedExtensions],
  )

  useEffect(() => {
    if (!knownAttachments?.length) return
    setMetaById((prev) => {
      const next = { ...prev }
      for (const item of knownAttachments) {
        next[item.id] = {
          id: item.id,
          original_filename: item.original_filename,
          size_bytes: item.size_bytes,
          extension: item.extension,
          mime_type: item.mime_type,
        }
      }
      return next
    })
  }, [knownAttachments])

  useEffect(() => {
    let cancelled = false
    const missing = value.filter((id) => !metaById[id])
    if (!missing.length) return

    void (async () => {
      for (const id of missing) {
        try {
          const result = await downloadAttachmentBlob(id, 'inline')
          if (cancelled) {
            URL.revokeObjectURL(URL.createObjectURL(result.blob))
            continue
          }
          const filename = result.filename || `附件-${id.slice(0, 6)}`
          const ext = normalizeExt(filename)
          setMetaById((prev) => ({
            ...prev,
            [id]: {
              id,
              original_filename: filename,
              size_bytes: result.blob.size,
              extension: ext,
              mime_type: result.mimeType || undefined,
            },
          }))
          // discard blob bytes; only metadata needed
        } catch {
          if (!cancelled) {
            setMetaById((prev) => ({
              ...prev,
              [id]: {
                id,
                original_filename: `附件（${id.slice(0, 8)}）`,
                size_bytes: 0,
                extension: '',
              },
            }))
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // intentionally omit metaById to avoid loops; missing computed from current map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join('|')])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || disabled || uploading) return
    setError(null)

    const remaining = maxFiles - value.length
    if (remaining <= 0) {
      setError(`最多可上傳 ${maxFiles} 個檔案`)
      return
    }

    const files = Array.from(fileList).slice(0, remaining)
    setUploading(true)
    const nextIds = [...value]

    try {
      for (const file of files) {
        const ext = normalizeExt(file.name)
        if (allowed.length && !allowed.includes(ext)) {
          throw new Error(`不支援的副檔名：.${ext || '（無）'}（允許：${allowed.join(', ')}）`)
        }
        const maxBytes = maxSizeMb * 1024 * 1024
        if (file.size > maxBytes) {
          throw new Error(`檔案「${file.name}」超過 ${maxSizeMb} MB 上限`)
        }

        const result = await uploadAttachment({
          file,
          context,
          submissionId,
          applicationId,
          fieldCode,
          supplementRequestId,
          followUpTaskId,
          asStaff,
        })
        const att = result.attachment
        nextIds.push(att.id)
        setMetaById((prev) => ({
          ...prev,
          [att.id]: {
            id: att.id,
            original_filename: att.original_filename,
            size_bytes: att.size_bytes,
            extension: att.extension,
            mime_type: att.mime_type,
          },
        }))
      }
      onChange(nextIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove(id: string) {
    if (disabled || uploading) return
    setError(null)
    try {
      await softDeleteAttachment(id, asStaff)
      onChange(value.filter((item) => item !== id))
      setMetaById((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  async function handlePreview(id: string) {
    setError(null)
    try {
      const result = await downloadAttachmentBlob(id, 'inline')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(result.blob))
      setPreviewName(result.filename || metaById[id]?.original_filename || id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '預覽失敗')
    }
  }

  async function handleDownload(id: string) {
    setError(null)
    try {
      const result = await downloadAttachmentBlob(id, 'attachment')
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename || metaById[id]?.original_filename || 'download'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '下載失敗')
    }
  }

  const accept = allowed.map((ext) => `.${ext}`).join(',')

  const atLimit = value.length >= maxFiles

  return (
    <div className="space-y-3">
      {label ? (
        <div>
          <Label>
            {label}
            {required ? <span className="ml-0.5 text-danger">*</span> : null}
          </Label>
          {helpText ? <p className="mt-1 text-meta text-muted-foreground">{helpText}</p> : null}
        </div>
      ) : null}

      {!disabled ? (
        <div className="rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-5 text-center">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={accept || undefined}
            multiple={maxFiles > 1}
            disabled={uploading || atLimit}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Upload className="mx-auto size-5 text-muted-foreground" aria-hidden />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={uploading || atLimit}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? '上傳中…' : atLimit ? '已達檔案數上限' : '選擇檔案'}
          </Button>
          <p className="mt-2.5 text-meta text-muted-foreground">
            {allowed.length ? allowed.join('、') : '不限格式'} · 單檔上限 {maxSizeMb} MB · 最多{' '}
            {maxFiles} 個
          </p>
        </div>
      ) : null}

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{disabled ? '尚無附件' : '尚未上傳檔案'}</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((id) => {
            const meta = metaById[id]
            const name = meta?.original_filename || '載入檔名中…'
            const size = meta ? formatFileSize(meta.size_bytes) : '—'
            const previewable = meta ? canPreviewExtension(meta.extension) : false
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  <p className="text-meta text-muted-foreground tabular">{size}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {previewable ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`預覽 ${name}`}
                      onClick={() => void handlePreview(id)}
                    >
                      <Eye />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`下載 ${name}`}
                    onClick={() => void handleDownload(id)}
                  >
                    <Download />
                  </Button>
                  {!disabled ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`刪除 ${name}`}
                      className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                      onClick={() => void handleRemove(id)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {previewUrl ? (
        <div className="rounded-md border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">預覽：{previewName}</p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="關閉預覽"
              onClick={() => {
                URL.revokeObjectURL(previewUrl)
                setPreviewUrl(null)
                setPreviewName(null)
              }}
            >
              <X />
            </Button>
          </div>
          {(previewName || '').toLowerCase().match(/\.pdf($|\?)/) ? (
            <iframe title="附件預覽" src={previewUrl} className="h-96 w-full rounded-b-md" />
          ) : (
            <img
              src={previewUrl}
              alt={previewName || '附件預覽'}
              className="mx-auto max-h-96 w-auto rounded-b-md"
            />
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  )
}
