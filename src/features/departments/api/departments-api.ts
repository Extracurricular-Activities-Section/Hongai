import { HK_COLLECTIONS, escapeFilterValue, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { Department, StaffDepartment } from '@/types'

export async function listActiveDepartments(): Promise<Department[]> {
  try {
    const result = await staffPb.collection(HK_COLLECTIONS.departments).getList<Department>(1, 100, {
      filter: 'active = true',
      sort: 'sort_order,name',
    })
    return result.items
  } catch (error) {
    sanitizeApiError(error)
    return []
  }
}

export async function listStaffDepartmentsByStaffId(
  staffId: string,
): Promise<StaffDepartment[]> {
  try {
    const safeId = escapeFilterValue(staffId)
    const result = await staffPb
      .collection(HK_COLLECTIONS.staffDepartments)
      .getList<StaffDepartment>(1, 100, {
        filter: `staff = "${safeId}" && active = true`,
      })
    return result.items
  } catch (error) {
    sanitizeApiError(error)
    return []
  }
}
