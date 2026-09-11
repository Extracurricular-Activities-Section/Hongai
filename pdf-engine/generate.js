import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'

import { getCategoryShortCode, getPdfCategoryConfig } from './config.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function dash(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

function formatCurrency(value) {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num.toLocaleString('zh-TW')} 元`
}

function formatDateTaipei(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const raw = String(value)
    return raw.length >= 10 ? raw.slice(0, 10).replace(/-/g, '/') : dash(value)
  }
  return pdfSafeText(
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date),
  )
}

function formatDateTimeTaipei(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return dash(value)
  return pdfSafeText(
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  )
}

function firstExisting(paths) {
  return paths.find((p) => p && existsSync(p)) || null
}

/**
 * 中文：標楷體（kaiu / DFKai-SB）。
 * Linux 容器預設用開源楷體近似（AR PL KaitiM）；正式可掛 PDF_FONT_CJK_PATH=kaiu.ttf。
 */
function resolveCjkFontPath(explicit) {
  return firstExisting([
    explicit,
    process.env.PDF_FONT_CJK_PATH,
    process.env.PDF_FONT_PATH,
    '/app/fonts/kaiu.ttf',
    '/app/fonts/kaiu.ttc',
    'C:/Windows/Fonts/kaiu.ttf',
    'C:/Windows/Fonts/kaiu.ttc',
    'C:/Windows/Fonts/DFKAI-SB.TTF',
    'C:/Windows/Fonts/STKAITI.TTF',
    'C:/Windows/Fonts/simkai.ttf',
    '/usr/share/fonts/truetype/arphic/bkai00mp.ttf',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
  ])
}

/**
 * 英文／數字：Times New Roman。
 * Linux 預設 Liberation Serif（Times 計量相容）；正式可掛 PDF_FONT_LATIN_PATH=times.ttf。
 */
function resolveLatinFontPath(explicit) {
  return firstExisting([
    explicit,
    process.env.PDF_FONT_LATIN_PATH,
    '/app/fonts/times.ttf',
    '/app/fonts/Times New Roman.ttf',
    'C:/Windows/Fonts/times.ttf',
    'C:/Windows/Fonts/Times.ttf',
    'C:/Windows/Fonts/Times New Roman.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf',
  ])
}

function resolveLatinBoldFontPath() {
  return firstExisting([
    process.env.PDF_FONT_LATIN_BOLD_PATH,
    '/app/fonts/timesbd.ttf',
    'C:/Windows/Fonts/timesbd.ttf',
    'C:/Windows/Fonts/Timesbd.ttf',
    'C:/Windows/Fonts/Times New Roman Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf',
  ])
}

/** ASCII 英數與半形標點 → Latin；其餘（含中文）→ CJK。 */
function isLatinRunChar(ch) {
  const code = ch.codePointAt(0) ?? 0
  if (code >= 0x30 && code <= 0x39) return true // 0-9
  if (code >= 0x41 && code <= 0x5a) return true // A-Z
  if (code >= 0x61 && code <= 0x7a) return true // a-z
  // 半形空白與常見半形標點跟英數一起用 Times，版面較穩
  if (code < 0x80 && /[\s.,;:!? '"`()\[\]{}\-_/=+*&^%$#@\\|<>~]/.test(ch)) return true
  return false
}

/**
 * @param {string} text
 * @param {import('pdf-lib').PDFFont} latinFont
 * @param {import('pdf-lib').PDFFont} cjkFont
 */
function splitFontRuns(text, latinFont, cjkFont) {
  /** @type {Array<{ font: import('pdf-lib').PDFFont, text: string }>} */
  const runs = []
  for (const ch of text) {
    const font = isLatinRunChar(ch) ? latinFont : cjkFont
    const last = runs[runs.length - 1]
    if (last && last.font === font) last.text += ch
    else runs.push({ font, text: ch })
  }
  return runs
}

function widthOfMixed(text, size, latinFont, cjkFont) {
  return splitFontRuns(text, latinFont, cjkFont).reduce(
    (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size),
    0,
  )
}

function drawMixedLine(page, text, x, y, size, latinFont, cjkFont, color) {
  let cursor = x
  for (const run of splitFontRuns(text, latinFont, cjkFont)) {
    if (!run.text) continue
    page.drawText(run.text, { x: cursor, y, size, font: run.font, color })
    cursor += run.font.widthOfTextAtSize(run.text, size)
  }
}

async function embedFontBytes(pdfDoc, filePath) {
  const bytes = readFileSync(filePath)
  try {
    return await pdfDoc.embedFont(bytes, { subset: false })
  } catch {
    return await pdfDoc.embedFont(bytes, { subset: true })
  }
}

/** Normalize strings for pdf-lib (thin/nbsp separators break some viewers). */
function pdfSafeText(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function createVerificationToken() {
  return randomBytes(24).toString('base64url')
}

export function buildDocumentNumber({ academicYear, semester, categoryCode, serial }) {
  const short = getCategoryShortCode(categoryCode)
  const year = String(academicYear || 0)
  const sem = String(semester || '1')
  const seq = String(serial).padStart(6, '0')
  return `HAD-${year}${sem}-${short}-${seq}`
}

function fieldDisplayValue(field, answers) {
  const value = answers?.[field.code]
  switch (field.field_type) {
    case 'currency':
      return formatCurrency(value)
    case 'checkbox':
      return value ? '是' : '否'
    case 'radio':
    case 'select': {
      const opt = (field.options || []).find((item) => String(item.value) === String(value))
      return opt ? opt.label : dash(value)
    }
    case 'multiselect': {
      if (!Array.isArray(value)) return dash(value)
      return (
        value
          .map((item) => {
            const opt = (field.options || []).find((o) => String(o.value) === String(item))
            return opt ? opt.label : String(item)
          })
          .join('、') || '—'
      )
    }
    case 'date':
      return formatDateTaipei(value)
    case 'url':
    case 'email':
    case 'text':
    case 'textarea':
    case 'number':
    case 'computed':
      return dash(value)
    case 'file':
      return '（附件將於後續階段上傳）'
    case 'display':
      return field.help_text || field.label
    default:
      return '此欄位格式暫不支援'
  }
}

/**
 * @param {object} input
 * @param {object} input.snapshot
 * @param {object} input.schema
 * @param {string} input.documentNumber
 * @param {number} input.documentVersion
 * @param {string} input.verificationUrl
 * @param {string} [input.fontPath] CJK font override（標楷體）
 * @param {string} [input.latinFontPath] Latin font override（Times New Roman）
 */
export async function generateHadApplicationPdf(input) {
  const snapshot = input.snapshot
  if (!snapshot?.studentProfileSnapshot || !snapshot?.periodProfileSnapshot || !snapshot?.answers) {
    throw new Error('INCOMPLETE_SNAPSHOT')
  }

  const schema = input.schema || snapshot.schema
  if (!schema?.sections) throw new Error('MISSING_SCHEMA')

  const categoryCode = snapshot.category?.code || 'other'
  const config = getPdfCategoryConfig(categoryCode)
  const period = snapshot.period || {}
  const student = snapshot.studentProfileSnapshot
  const periodProfile = snapshot.periodProfileSnapshot
  const answers = snapshot.computed || snapshot.answers || {}

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const cjkFontPath = resolveCjkFontPath(input.fontPath)
  const latinFontPath = resolveLatinFontPath(input.latinFontPath)
  const latinBoldPath = resolveLatinBoldFontPath()

  /** @type {import('pdf-lib').PDFFont} */
  let cjkFont
  /** @type {import('pdf-lib').PDFFont} */
  let latinFont
  /** @type {import('pdf-lib').PDFFont} */
  let latinBold

  if (cjkFontPath) {
    cjkFont = await embedFontBytes(pdfDoc, cjkFontPath)
  } else {
    // 無中文字型時僅能顯示拉丁字；正式環境必須提供標楷體路徑
    cjkFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  }

  if (latinFontPath) {
    latinFont = await embedFontBytes(pdfDoc, latinFontPath)
  } else {
    latinFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  }

  if (latinBoldPath) {
    latinBold = await embedFontBytes(pdfDoc, latinBoldPath)
  } else {
    try {
      latinBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    } catch {
      latinBold = latinFont
    }
  }

  const cjkBold = cjkFont
  const fontPath = cjkFontPath

  const qrPng = await QRCode.toBuffer(input.verificationUrl, {
    type: 'png',
    margin: 1,
    width: 128,
    errorCorrectionLevel: 'M',
  })
  const qrImage = await pdfDoc.embedPng(qrPng)

  /** @type {Array<{type:string, text?:string, rows?:string[][], size?:number}>} */
  const blocks = []

  blocks.push({ type: 'title', text: '弘光科技大學' })
  blocks.push({ type: 'title', text: config.title || '弘愛築夢助學金申請表' })
  blocks.push({
    type: 'meta',
    rows: [
      ['學年度／學期', `${period.academic_year || '—'}學年度 第${period.semester || '—'}學期`],
      ['申請項目', snapshot.category?.name || '—'],
      ['申請編號', input.documentNumber],
      ['PDF 版本', `V${input.documentVersion}`],
      ['產生時間', formatDateTimeTaipei(new Date().toISOString())],
    ],
  })

  blocks.push({ type: 'heading', text: '一、文件基本資訊' })
  blocks.push({
    type: 'kv',
    rows: [
      ['梯次名稱', period.name || '—'],
      ['完成時間', formatDateTimeTaipei(snapshot.timestamps?.completed_at)],
      ['表單版本', `Form V${snapshot.formVersion?.version_number || '—'}`],
    ],
  })

  blocks.push({ type: 'heading', text: '二、申請資格' })
  const identityTypes = Array.isArray(periodProfile.application_identity_types)
    ? periodProfile.application_identity_types.join('、')
    : '—'
  blocks.push({
    type: 'kv',
    rows: [
      ['申請身分', identityTypes || '—'],
      ['身心障礙級距', dash(periodProfile.disability_level)],
      ['弱勢助學金級距', dash(periodProfile.weak_aid_level)],
      ['曾經申請弘愛築夢', periodProfile.has_applied_before ? '是' : '否'],
      ['銀行／郵局帳號已建置', periodProfile.bank_account_registered ? '是' : '否'],
      ['銀行說明', dash(periodProfile.bank_account_note)],
      ['資格說明', dash(periodProfile.qualification_note)],
    ],
  })

  blocks.push({ type: 'heading', text: '三、學生基本資料' })
  blocks.push({
    type: 'kv',
    rows: [
      ['姓名', dash(student.name)],
      ['學號', dash(student.student_no)],
      ['身分證字號', dash(student.identity_number || student.identity_number_masked)],
      ['性別', dash(student.gender)],
      ['部別', dash(student.division)],
      ['制別', dash(student.program_type)],
      ['年級', dash(periodProfile.grade || student.grade)],
      ['科系', dash(student.department_name)],
      ['聯絡電話', dash(student.phone)],
      ['LINE ID', dash(student.line_id)],
      ['Email', dash(student.email)],
    ],
  })

  blocks.push({ type: 'heading', text: '四、申請項目專屬內容' })
  for (const section of schema.sections) {
    if (section.pdf_visible === false || section.visible === false) continue
    blocks.push({ type: 'subheading', text: section.title })
    for (const field of section.fields || []) {
      if (!field.active || field.pdf_visible === false) continue
      if (field.field_type === 'repeat_group') {
        const rows = Array.isArray(answers[field.code]) ? answers[field.code] : []
        const columns = field.config?.columns || [
          { code: 'item_name', label: '項目' },
          { code: 'amount', label: '金額' },
        ]
        blocks.push({ type: 'label', text: field.label })
        blocks.push({
          type: 'table',
          rows: [
            columns.map((col) => col.label),
            ...rows.map((row) =>
              columns.map((col) =>
                col.field_type === 'currency' ? formatCurrency(row[col.code]) : dash(row[col.code]),
              ),
            ),
          ],
        })
        continue
      }
      if (field.field_type === 'monthly_plan') {
        const months = field.config?.months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        const plan = answers[field.code] && typeof answers[field.code] === 'object' ? answers[field.code] : {}
        blocks.push({ type: 'label', text: field.label })
        blocks.push({
          type: 'table',
          rows: [
            ['月份', '規劃內容'],
            ...months.map((month) => [`${month} 月`, dash(plan[String(month)])]),
          ],
        })
        continue
      }
      blocks.push({
        type: 'kv',
        rows: [[field.label, fieldDisplayValue(field, answers)]],
      })
    }
  }

  blocks.push({ type: 'heading', text: '五、學生確認／紙本簽名區' })
  blocks.push({ type: 'paragraph', text: config.student_confirmation_text })
  blocks.push({ type: 'paragraph', text: '□ 本人確認上述資料正確' })
  blocks.push({ type: 'paragraph', text: '學生簽名：____________________________' })
  blocks.push({ type: 'paragraph', text: '日期：________年____月____日' })

  blocks.push({ type: 'heading', text: '六、老師／承辦紙本簽核區' })
  for (const block of config.approval_blocks || []) {
    blocks.push({
      type: 'subheading',
      text: block.optional ? `${block.title}` : block.title,
    })
    for (const box of block.checkboxes || []) {
      blocks.push({ type: 'paragraph', text: `□ ${box}` })
    }
    if (block.show_opinion) {
      blocks.push({ type: 'paragraph', text: '意見：______________________________________________' })
      blocks.push({ type: 'paragraph', text: '________________________________________________' })
    }
    if (block.show_signature) {
      blocks.push({ type: 'paragraph', text: '簽名／簽章：____________________________' })
      blocks.push({ type: 'paragraph', text: '日期：________年____月____日' })
    }
  }

  blocks.push({ type: 'heading', text: '七、文件版本資訊' })
  blocks.push({
    type: 'kv',
    rows: [
      ['申請編號', input.documentNumber],
      ['PDF 版本', `V${input.documentVersion}`],
      ['驗證碼用途', '請掃描 QR Code 驗證是否為有效版本（不顯示個資）'],
      ['下一步', '1. 下載並列印  2. 完成紙本簽核  3. 依規定辦理後續送件'],
    ],
  })

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN
  const pages = [page]

  const drawFooter = (currentPage, pageIndex, pageCount) => {
    drawMixedLine(
      currentPage,
      `${input.documentNumber}  |  PDF V${input.documentVersion}  |  第 ${pageIndex} / ${pageCount} 頁`,
      MARGIN,
      24,
      8,
      latinFont,
      cjkFont,
      rgb(0.35, 0.35, 0.35),
    )
  }

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN + 36) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      y = PAGE_HEIGHT - MARGIN
    }
  }

  const drawWrapped = (text, size = 10, bold = false) => {
    const useLatin = bold ? latinBold : latinFont
    const useCjk = bold ? cjkBold : cjkFont
    const maxWidth = CONTENT_WIDTH
    const content = pdfSafeText(text || '')
    const chars = [...content]
    let line = ''
    for (const ch of chars) {
      const test = line + ch
      const width = widthOfMixed(test, size, useLatin, useCjk)
      if (width > maxWidth && line) {
        ensureSpace(size + 4)
        drawMixedLine(page, line, MARGIN, y - size, size, useLatin, useCjk, rgb(0.1, 0.1, 0.1))
        y -= size + 4
        line = ch
      } else {
        line = test
      }
    }
    if (line) {
      ensureSpace(size + 4)
      drawMixedLine(page, line, MARGIN, y - size, size, useLatin, useCjk, rgb(0.1, 0.1, 0.1))
      y -= size + 4
    }
  }

  // QR on first page top-right
  page.drawImage(qrImage, {
    x: PAGE_WIDTH - MARGIN - 72,
    y: PAGE_HEIGHT - MARGIN - 72,
    width: 72,
    height: 72,
  })

  for (const block of blocks) {
    if (block.type === 'title') {
      ensureSpace(22)
      drawWrapped(block.text, 14, true)
      y -= 4
    } else if (block.type === 'heading') {
      y -= 8
      ensureSpace(20)
      drawWrapped(block.text, 12, true)
      y -= 2
    } else if (block.type === 'subheading') {
      y -= 4
      ensureSpace(16)
      drawWrapped(block.text, 11, true)
    } else if (block.type === 'label') {
      ensureSpace(14)
      drawWrapped(block.text, 10, true)
    } else if (block.type === 'paragraph') {
      ensureSpace(14)
      drawWrapped(block.text, 10, false)
      y -= 2
    } else if (block.type === 'kv' || block.type === 'meta') {
      for (const [label, value] of block.rows || []) {
        ensureSpace(28)
        drawWrapped(`${label}：${value}`, 10, false)
      }
    } else if (block.type === 'table') {
      const rows = block.rows || []
      for (const row of rows) {
        ensureSpace(18)
        drawWrapped(row.map((cell) => dash(cell)).join('  |  '), 9, false)
      }
      y -= 4
    }
  }

  const pageCount = pages.length
  pages.forEach((p, index) => drawFooter(p, index + 1, pageCount))

  const bytes = await pdfDoc.save()
  return {
    bytes: Buffer.from(bytes),
    sha256: sha256Hex(Buffer.from(bytes)),
    pageCount,
    fontPath: fontPath || null,
    cjkFontPath: cjkFontPath || null,
    latinFontPath: latinFontPath || 'StandardFonts.TimesRoman',
  }
}
