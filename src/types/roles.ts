/**
 * Role model (Phase 1 — documented only, not implemented).
 *
 * - Student
 * - Staff (承辦)
 * - Admin (管理員)
 *
 * Staff and Admin are not mutually exclusive.
 * A backend account may have both is_staff and is_admin set to true.
 *
 * Do not introduce a complex RBAC tables design unless a later phase requires it.
 */
export type ActorRole = 'student' | 'staff' | 'admin'
