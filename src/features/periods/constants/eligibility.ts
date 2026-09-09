export const APPLICATION_IDENTITY_TYPES = [
  { code: 'low_income', label: '低收入戶' },
  { code: 'middle_low_income', label: '中低收入戶' },
  { code: 'disabled_student', label: '身心障礙學生' },
  { code: 'disabled_family', label: '身心障礙人士子女' },
  { code: 'special_circumstances_family', label: '特殊境遇家庭子女或孫子女' },
  { code: 'weak_aid', label: '大專校院弱勢助學金資格' },
  { code: 'indigenous', label: '原住民學生' },
  { code: 'family_emergency', label: '家庭突遭變故' },
  { code: 'pregnant', label: '懷孕學生' },
  { code: 'raising_child_under_three', label: '撫養未滿三歲子女' },
  { code: 'other_special', label: '其他特殊情況' },
] as const

export type ApplicationIdentityTypeCode =
  (typeof APPLICATION_IDENTITY_TYPES)[number]['code']

export function identityTypeLabel(code: string): string {
  return APPLICATION_IDENTITY_TYPES.find((item) => item.code === code)?.label ?? code
}

export function needsDisabilityLevel(codes: string[]): boolean {
  return codes.includes('disabled_student') || codes.includes('disabled_family')
}

export function needsWeakAidLevel(codes: string[]): boolean {
  return codes.includes('weak_aid')
}

export function needsQualificationNote(codes: string[]): boolean {
  return codes.includes('other_special')
}
