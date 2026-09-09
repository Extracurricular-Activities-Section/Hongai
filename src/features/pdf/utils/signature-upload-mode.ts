import type { SignatureUploadMode } from '@/features/pdf/types'

/** Mirrors pb_hooks/hk_funding_config.js SIGNATURE_UPLOAD_MODES */
const SIGNATURE_UPLOAD_MODES: Record<string, SignatureUploadMode> = {
  language_certification: 'optional',
  academic_learning: 'optional',
  common_competency: 'optional',
  professional_certification: 'optional',
  career_enhancement: 'optional',
  external_competition: 'optional',
  overseas_study: 'optional',
  cross_domain_learning: 'optional',
  other: 'optional',
}

export function getSignatureUploadMode(categoryCode?: string | null): SignatureUploadMode {
  if (!categoryCode) return 'optional'
  return SIGNATURE_UPLOAD_MODES[categoryCode] || 'optional'
}
