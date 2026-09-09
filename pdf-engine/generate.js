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
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\//g, '/')
}

function formatDateTimeTaipei(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return dash(value)
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function resolveFontPath() {
  if (process.env.PDF_FONT_PATH && existsSync(process.env.PDF_FONT_PATH)) {
    return process.env.PDF_FONT_PATH
  }
  // Prefer TTF/OTF — many .ttc system fonts are not fully supported by fontkit+pdf-lib.
  const candidates = [
    'C:/Windows/Fonts/kaiu.ttf',
    'C:/Windows/Fonts/simkai.ttf',
    'C:/Windows/Fonts/STKAITI.TTF',
    'C:/Windows/Fonts/msyh.ttf',
    'C:/Windows/Fonts/simhei.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKtc-Regular.otf',
    '/System/Library/Fonts/Supplemental/Songti.ttc',
  ]
  return candidates.find((path) => existsSync(path)) || null
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
 * @param {string} [input.fontPath]
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

  const fontPath = input.fontPath || resolveFontPath()
  let font
  let fontBold
  if (fontPath) {
    const bytes = readFileSync(fontPath)
    // TTC/some system fonts do not support subsetting via fontkit.
    const useSubset = !fontPath.toLowerCase().endsWith('.ttc')
    try {
      font = await pdfDoc.embedFont(bytes, { subset: useSubset })
    } catch {
      font = await pdfDoc.embedFont(bytes, { subset: false })
    }
    fontBold = font
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  }

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
    currentPage.drawText(`${input.documentNumber}  |  PDF V${input.documentVersion}  |  第 ${pageIndex} / ${pageCount} 頁`, {
      x: MARGIN,
      y: 24,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
  }

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN + 36) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      y = PAGE_HEIGHT - MARGIN
    }
  }

  const drawWrapped = (text, size = 10, bold = false) => {
    const useFont = bold ? fontBold : font
    const maxWidth = CONTENT_WIDTH
    const content = String(text || '')
    const chars = [...content]
    let line = ''
    for (const ch of chars) {
      const test = line + ch
      const width = useFont.widthOfTextAtSize(test, size)
      if (width > maxWidth && line) {
        ensureSpace(size + 4)
        page.drawText(line, { x: MARGIN, y: y - size, size, font: useFont, color: rgb(0.1, 0.1, 0.1) })
        y -= size + 4
        line = ch
      } else {
        line = test
      }
    }
    if (line) {
      ensureSpace(size + 4)
      page.drawText(line, { x: MARGIN, y: y - size, size, font: useFont, color: rgb(0.1, 0.1, 0.1) })
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
  }
}
