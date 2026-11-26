/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './client/context/AuthContext.tsx';
import { ThemeProvider } from './client/context/ThemeContext.tsx';
import { ToastProvider } from './client/context/ToastContext.tsx';
import { AcademicYearsPage } from './client/features/academic-years/AcademicYearsPage.tsx';
import { AuditLogsPage } from './client/features/audit/AuditLogsPage.tsx';
import { LoginPage } from './client/features/auth/LoginPage.tsx';
import { ClassesPage } from './client/features/classes/ClassesPage.tsx';
import { DashboardPage } from './client/features/dashboard/DashboardPage.tsx';
import { GradesPage } from './client/features/grades/GradesPage.tsx';
import { GuardiansPage } from './client/features/guardians/GuardiansPage.tsx';
import { ProfilePage } from './client/features/profile/ProfilePage.tsx';
import { ReportCardsPage } from './client/features/report-cards/ReportCardsPage.tsx';
import { RolesPage } from './client/features/roles/RolesPage.tsx';
import { SettingsPage } from './client/features/settings/SettingsPage.tsx';
import { StudentsPage } from './client/features/students/StudentsPage.tsx';
import { SubjectsPage } from './client/features/subjects/SubjectsPage.tsx';
import { TeachersPage } from './client/features/teachers/TeachersPage.tsx';
import { UsersPage } from './client/features/users/UsersPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { profile, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-600 dark:text-slate-300">
        Chargement de votre espace scolaire...
      </div>
    );
  }

  if (!profile) {
    return <LoginPage />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/academic-years"
        element={
          <ProtectedRoute permission="academic_years:read">
            <AcademicYearsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <ProtectedRoute permission="classes:read">
            <ClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute permission="students:read">
            <StudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teachers"
        element={
          <ProtectedRoute permission="teachers:read">
            <TeachersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardians"
        element={
          <ProtectedRoute permission="guardians:read">
            <GuardiansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects"
        element={
          <ProtectedRoute permission="subjects:read">
            <SubjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grades"
        element={
          <ProtectedRoute permission="grades:read">
            <GradesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report-cards"
        element={
          <ProtectedRoute permission="report_cards:read">
            <ReportCardsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute permission="users:read">
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute permission="roles:read">
            <RolesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute permission="audit:read">
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute permission="settings:read">
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
