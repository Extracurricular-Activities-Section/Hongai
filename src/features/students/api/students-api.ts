import { HAD_COLLECTIONS, escapeFilterValue, studentPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { Student, StudentProfile } from '@/types'

/**
 * Prefer trusted endpoints (/api/had/student/*) for auth flows.
 * These reads rely on ownership API rules and may be unavailable until schema is deployed.
 */
export async function getStudentById(id: string): Promise<Student | null> {
  try {
    return await studentPb.collection(HAD_COLLECTIONS.students).getOne<Student>(id)
  } catch (error) {
    sanitizeApiError(error)
    return null
  }
}

export async function getStudentProfileByStudentId(
  studentId: string,
): Promise<StudentProfile | null> {
  try {
    const safeId = escapeFilterValue(studentId)
    return await studentPb
      .collection(HAD_COLLECTIONS.studentProfiles)
      .getFirstListItem<StudentProfile>(`student="${safeId}"`)
  } catch (error) {
    sanitizeApiError(error)
    return null
  }
}
