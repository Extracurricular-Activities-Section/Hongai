/**
 * Minimal CSV helpers (RFC 4180 style) — no third-party dependency.
 * Output is UTF-8 with BOM so Excel opens Traditional Chinese correctly.
 */

export const CSV_BOM = '\uFEFF'

/** Parse CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

/** Parse CSV with a header row into lowercase-keyed records. */
export function parseCsvRecords(text: string): { headers: string[]; records: Array<Record<string, string>> } {
  const rows = parseCsv(text)
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) record[header] = (cells[index] ?? '').trim()
    })
    return record
  })
  return { headers, records }
}

/**
 * Escape one cell. Text starting with = + - @ (or tab/CR) is prefixed with an apostrophe
 * so spreadsheet apps do not evaluate it as a formula (CSV injection).
 */
export function csvCell(value: unknown, opts: { numeric?: boolean } = {}): string {
  if (value == null) return ''
  let text = String(value)
  if (!opts.numeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(
  headers: string[],
  rows: Array<Array<unknown | { numeric: number }>>,
): string {
  const lines = [headers.map((header) => csvCell(header)).join(',')]
  for (const row of rows) {
    lines.push(
      row
        .map((value) =>
          value && typeof value === 'object' && 'numeric' in (value as object)
            ? csvCell((value as { numeric: number }).numeric, { numeric: true })
            : csvCell(value),
        )
        .join(','),
    )
  }
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`
}

/** Mark a cell as a number (skips the formula-injection prefix so negatives stay numeric). */
export const numericCell = (value: unknown): { numeric: number } => ({
  numeric: Number.isFinite(Number(value)) ? Number(value) : 0,
})
