/**
 * Category short codes + PDF approval / confirmation config.
 * Used by Node PDF engine and PocketBase hooks (mirrored constants).
 */

export const CATEGORY_SHORT_CODES = {
  academic_learning: 'ACAD',
  common_competency: 'COMM',
  language_certification: 'LANG',
  professional_certification: 'CERT',
  career_enhancement: 'CAREER',
  external_competition: 'COMP',
  overseas_study: 'OVERSEA',
  cross_domain_learning: 'CROSS',
  other: 'OTHER',
}

/** @type {Record<string, import('./types.js').PdfCategoryConfig>} */
export const PDF_CATEGORY_CONFIGS = {
  language_certification: {
    title: '弘愛築夢助學金申請表（外語檢定）',
    student_confirmation_text:
      '本人確認上述資料正確，並了解獲補助後須依規定繳交學習報告；未如期繳交可能需繳回補助。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: [
          '已檢視學生規劃確實可行',
          '學生規劃執行期間填寫正確',
          '學生各項補助金額加總正確',
        ],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  common_competency: {
    title: '弘愛築夢助學金申請表（共通職能）',
    student_confirmation_text:
      '本人確認上述資料正確。請列印後交系輔導老師確認並完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: [
          '已檢視學生規劃確實可行',
          '學生規劃執行期間填寫正確',
          '學生各項補助金額加總正確',
        ],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  other: {
    title: '弘愛築夢助學金申請表（其他）',
    student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: ['已檢視學生規劃確實可行', '學生各項補助金額加總正確'],
        show_opinion: true,
        show_signature: true,
      },
      {
        code: 'advisor',
        title: '指導老師（若無則免）',
        checkboxes: [],
        show_opinion: true,
        show_signature: true,
        optional: true,
      },
    ],
  },
  external_competition: {
    title: '弘愛築夢助學金申請表（校外競賽）',
    student_confirmation_text: '本人確認上述資料正確，並了解須檢附競賽報名或活動資訊。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: ['已檢視學生規劃確實可行', '學生各項補助金額加總正確'],
        show_opinion: true,
        show_signature: true,
      },
      {
        code: 'advisor',
        title: '指導老師（若無則免）',
        checkboxes: [],
        show_opinion: true,
        show_signature: true,
        optional: true,
      },
    ],
  },
  overseas_study: {
    title: '弘愛築夢助學金申請表（海外研修）',
    student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: ['已檢視學生規劃確實可行', '學生各項補助金額加總正確'],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  professional_certification: {
    title: '弘愛築夢助學金申請表（專業證照）',
    student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_assistant',
        title: '系所助理確認／簽章',
        checkboxes: [],
        show_opinion: false,
        show_signature: true,
      },
      {
        code: 'advisor',
        title: '指導老師確認',
        checkboxes: [],
        show_opinion: true,
        show_signature: true,
      },
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: [],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  career_enhancement: {
    title: '弘愛築夢助學金申請表（就業增能）',
    student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: ['已檢視學生規劃確實可行'],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  cross_domain_learning: {
    title: '弘愛築夢助學金申請表（跨域學習）',
    student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: [
          '已檢視學生規劃確實可行',
          '學生規劃執行期間填寫正確',
          '學生各項補助金額加總正確',
        ],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
  academic_learning: {
    title: '弘愛築夢助學金申請表（課業學習）',
    student_confirmation_text:
      '本人確認上述資料正確，並了解學習總時數原則應達 24 小時。請列印後完成紙本簽核。',
    signature_upload_mode: 'optional',
    approval_blocks: [
      {
        code: 'department_counselor',
        title: '系輔導老師確認',
        checkboxes: ['已檢視學生規劃確實可行', '學生各項補助金額加總正確'],
        show_opinion: true,
        show_signature: true,
      },
    ],
  },
}

export function getCategoryShortCode(categoryCode) {
  return CATEGORY_SHORT_CODES[categoryCode] || 'OTH'
}

export function getPdfCategoryConfig(categoryCode) {
  return (
    PDF_CATEGORY_CONFIGS[categoryCode] || {
      title: '弘愛築夢助學金申請表',
      student_confirmation_text: '本人確認上述資料正確。請列印後完成紙本簽核。',
      signature_upload_mode: 'optional',
      approval_blocks: [
        {
          code: 'department_counselor',
          title: '系輔導老師確認',
          checkboxes: [],
          show_opinion: true,
          show_signature: true,
        },
      ],
    }
  )
}
