import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/components/layout/admin-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import { StudentLayout } from '@/components/layout/student-layout'
import { BackofficeRouteGuard } from '@/features/auth/backoffice/guard'
import { StudentRouteGuard } from '@/features/auth/student/guard'
import { AdminApplicationDetailPage } from '@/pages/admin/application-detail-page'
import { AdminApplicationsPage } from '@/pages/admin/applications-page'
import { AdminDashboardPage } from '@/pages/admin/dashboard-page'
import { AdminDepartmentsPage } from '@/pages/admin/departments-page'
import { AdminDocumentsPage } from '@/pages/admin/documents-page'
import { AdminFollowUpTemplatesPage } from '@/pages/admin/follow-up-templates-page'
import { AdminFormsPage } from '@/pages/admin/forms-page'
import { AdminIdentityResetPage } from '@/pages/admin/identity-reset-page'
import { AdminNotificationTemplatesPage } from '@/pages/admin/notification-templates-page'
import { AdminNotificationsPage } from '@/pages/admin/notifications-page'
import { AdminPeriodsPage } from '@/pages/admin/periods-page'
import { AdminStudentsPage } from '@/pages/admin/students-page'
import { AdminTaskDetailPage } from '@/pages/admin/task-detail-page'
import { AdminTasksPage } from '@/pages/admin/tasks-page'
import { AdminUsersPage } from '@/pages/admin/users-page'
import { AdminLoginPage } from '@/pages/public/admin-login-page'
import { HelpPage } from '@/pages/public/help-page'
import { NotFoundPage } from '@/pages/public/not-found-page'
import { RegisterPage } from '@/pages/public/register-page'
import { StudentLoginPage } from '@/pages/public/student-login-page'
import { PublicVerifyPage } from '@/pages/public/verify-page'
import { StudentCategoryFormPage } from '@/pages/student/category-form-page'
import { StudentCurrentConfirmPage } from '@/pages/student/current-confirm-page'
import { StudentCurrentPage } from '@/pages/student/current-page'
import { StudentHistoryDetailPage } from '@/pages/student/history-detail-page'
import { StudentHistoryFormPage } from '@/pages/student/history-form-page'
import { StudentHistoryPage } from '@/pages/student/history-page'
import { StudentHomePage } from '@/pages/student/home-page'
import { StudentNotificationSettingsPage } from '@/pages/student/notification-settings-page'
import { StudentNotificationsPage } from '@/pages/student/notifications-page'
import { StudentProfilePage } from '@/pages/student/profile-page'
import { StudentTaskDetailPage } from '@/pages/student/task-detail-page'
import { StudentTasksPage } from '@/pages/student/tasks-page'

const AdminFormBuilderPage = lazy(() =>
  import('@/pages/admin/form-builder-page').then((mod) => ({ default: mod.AdminFormBuilderPage })),
)

export const router = createBrowserRouter([
  {
    path: '/verify/:token',
    element: <PublicVerifyPage />,
  },
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <StudentLoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/help', element: <HelpPage /> },
      { path: '/admin/login', element: <AdminLoginPage /> },
    ],
  },
  {
    path: '/student',
    element: <StudentRouteGuard />,
    children: [
      {
        element: <StudentLayout />,
        children: [
          { index: true, element: <StudentHomePage /> },
          { path: 'profile', element: <StudentProfilePage /> },
          { path: 'current', element: <StudentCurrentPage /> },
          { path: 'current/confirm', element: <StudentCurrentConfirmPage /> },
          {
            path: 'current/category/:categoryCode',
            element: <StudentCategoryFormPage />,
          },
          { path: 'tasks', element: <StudentTasksPage /> },
          { path: 'tasks/:taskId', element: <StudentTaskDetailPage /> },
          { path: 'notifications', element: <StudentNotificationsPage /> },
          { path: 'settings/notifications', element: <StudentNotificationSettingsPage /> },
          { path: 'history', element: <StudentHistoryPage /> },
          { path: 'history/:periodId', element: <StudentHistoryDetailPage /> },
          {
            path: 'history/:periodId/category/:categoryCode',
            element: <StudentHistoryFormPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <BackofficeRouteGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'applications', element: <AdminApplicationsPage /> },
          { path: 'applications/:applicationId', element: <AdminApplicationDetailPage /> },
          { path: 'tasks', element: <AdminTasksPage /> },
          { path: 'tasks/:taskId', element: <AdminTaskDetailPage /> },
          { path: 'follow-up-templates', element: <AdminFollowUpTemplatesPage /> },
          { path: 'notifications', element: <AdminNotificationsPage /> },
          { path: 'notifications/templates', element: <AdminNotificationTemplatesPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'departments', element: <AdminDepartmentsPage /> },
          { path: 'periods', element: <AdminPeriodsPage /> },
          { path: 'forms', element: <AdminFormsPage /> },
          {
            path: 'forms/:formId/builder',
            element: (
              <Suspense fallback={<p className="text-sm text-muted-foreground">載入 Form Builder…</p>}>
                <AdminFormBuilderPage />
              </Suspense>
            ),
          },
          { path: 'documents', element: <AdminDocumentsPage /> },
          { path: 'students', element: <AdminStudentsPage /> },
          { path: 'identity-reset', element: <AdminIdentityResetPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
