/**
 * @typedef {Object} PdfApprovalBlock
 * @property {string} code
 * @property {string} title
 * @property {string[]} checkboxes
 * @property {boolean} show_opinion
 * @property {boolean} show_signature
 * @property {boolean} [optional]
 */

/**
 * @typedef {Object} PdfCategoryConfig
 * @property {string} title
 * @property {string} student_confirmation_text
 * @property {'disabled'|'optional'|'required'} signature_upload_mode
 * @property {PdfApprovalBlock[]} approval_blocks
 */

export {}
