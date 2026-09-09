import { HK_COLLECTIONS, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { StaffUser } from '@/types'

export async function getStaffUserById(id: string): Promise<StaffUser | null> {
  try {
    return await staffPb.collection(HK_COLLECTIONS.staffUsers).getOne<StaffUser>(id)
  } catch (error) {
    sanitizeApiError(error)
    return null
  }
}
