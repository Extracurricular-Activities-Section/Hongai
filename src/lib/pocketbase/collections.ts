export const HK_BASE_COLLECTIONS = {
  students: 'hk_students',
  staffUsers: 'hk_staff_users',
  forms: 'hk_forms',
  applications: 'hk_applications',
  settings: 'hk_settings',
  events: 'hk_events',
} as const

/**
 * Transitional aliases for code paths that still expose the old API response
 * shape. The backing PocketBase schema is the six-collection data layer above.
 */
export const HK_COLLECTION_ALIASES = {
  departments: HK_BASE_COLLECTIONS.staffUsers,
  staffDepartments: HK_BASE_COLLECTIONS.staffUsers,
  studentProfiles: HK_BASE_COLLECTIONS.students,
  applicationPeriods: HK_BASE_COLLECTIONS.settings,
  identityResetRequests: HK_BASE_COLLECTIONS.events,
  auditLogs: HK_BASE_COLLECTIONS.events,
  periodStudentProfiles: HK_BASE_COLLECTIONS.applications,
  applicationCategories: HK_BASE_COLLECTIONS.settings,
  studentCategoryEntries: HK_BASE_COLLECTIONS.applications,
  formVersions: HK_BASE_COLLECTIONS.forms,
  formSections: HK_BASE_COLLECTIONS.forms,
  formFields: HK_BASE_COLLECTIONS.forms,
  formFieldOptions: HK_BASE_COLLECTIONS.forms,
  formRules: HK_BASE_COLLECTIONS.forms,
  formSubmissions: HK_BASE_COLLECTIONS.applications,
  formSubmissionVersions: HK_BASE_COLLECTIONS.applications,
  formAnswers: HK_BASE_COLLECTIONS.applications,
  pdfDocuments: HK_BASE_COLLECTIONS.applications,
  applicationStatusHistory: HK_BASE_COLLECTIONS.applications,
  applicationReviews: HK_BASE_COLLECTIONS.applications,
  applicationStaffAssignments: HK_BASE_COLLECTIONS.applications,
  categoryDepartmentAssignments: HK_BASE_COLLECTIONS.settings,
  supplementRequests: HK_BASE_COLLECTIONS.applications,
  fundingDecisions: HK_BASE_COLLECTIONS.applications,
  fundingDecisionItems: HK_BASE_COLLECTIONS.applications,
  fundingRules: HK_BASE_COLLECTIONS.settings,
  attachments: HK_BASE_COLLECTIONS.applications,
  signedDocuments: HK_BASE_COLLECTIONS.applications,
  supplementSubmissions: HK_BASE_COLLECTIONS.applications,
  followUpTaskTemplates: HK_BASE_COLLECTIONS.forms,
  categoryFollowUpTemplates: HK_BASE_COLLECTIONS.settings,
  followUpTasks: HK_BASE_COLLECTIONS.applications,
  followUpSubmissions: HK_BASE_COLLECTIONS.applications,
  followUpReviews: HK_BASE_COLLECTIONS.applications,
  notificationTemplates: HK_BASE_COLLECTIONS.settings,
  notifications: HK_BASE_COLLECTIONS.events,
  notificationDeliveries: HK_BASE_COLLECTIONS.events,
  notificationPreferences: HK_BASE_COLLECTIONS.students,
  reminderRules: HK_BASE_COLLECTIONS.settings,
  scheduledNotifications: HK_BASE_COLLECTIONS.events,
  serviceAccounts: HK_BASE_COLLECTIONS.staffUsers,
  categoryRules: HK_BASE_COLLECTIONS.settings,
  livingAllowanceRules: HK_BASE_COLLECTIONS.settings,
  rewardRules: HK_BASE_COLLECTIONS.settings,
  rewards: HK_BASE_COLLECTIONS.applications,
  disbursementPlans: HK_BASE_COLLECTIONS.applications,
  disbursementMilestones: HK_BASE_COLLECTIONS.applications,
  disbursements: HK_BASE_COLLECTIONS.applications,
  counselors: HK_BASE_COLLECTIONS.settings,
  departmentCounselors: HK_BASE_COLLECTIONS.settings,
  faqArticles: HK_BASE_COLLECTIONS.settings,
  academicYearPolicies: HK_BASE_COLLECTIONS.settings,
} as const

export const HK_COLLECTIONS = {
  ...HK_BASE_COLLECTIONS,
  ...HK_COLLECTION_ALIASES,
} as const

export const COLLECTIONS = HK_COLLECTIONS

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]
