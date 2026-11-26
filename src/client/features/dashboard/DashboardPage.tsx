import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookUser,
  CalendarRange,
  GraduationCap,
  HeartHandshake,
  Layers,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { ErrorBanner } from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  AuditLogItem,
  ClassItem,
  GuardianItem,
  PaginatedResponse,
  RoleWithPermissions,
  SchoolSettings,
  StudentItem,
  TeacherItem,
  UserProfile,
} from '../../types/api.ts';
import {
  buildClassEnrollmentChartData,
  buildTeacherDistributionData,
  computeCapacitySummary,
  type ClassEnrollmentChartPoint,
} from './dashboardMetrics.ts';
import { DailyAttendanceModule } from './DailyAttendanceModule.tsx';
import { UpcomingEventsModule } from './UpcomingEventsModule.tsx';

const ROADMAP_MODULES = [
  { phase: 'Phase 1 · Modules 1 à 6', title: 'Authentification, RBAC, Années, Classes, Élèves, Enseignants & Parents', status: 'Opérationnel' },
  { phase: 'Phase 2 · Module 7 & Vie scolaire', title: 'Matières, Coefficients, Affectations, Présences temps réel & Notifications', status: 'Opérationnel' },
  { phase: 'Phase 2 · Modules 8 à 10', title: 'Évaluations, Saisie des notes, Examens & Bulletins PDF', status: 'En cours' },
  { phase: 'Phase 3 · Modules 11 à 14', title: 'Frais de scolarité, Paiements, Emplois du temps & Communication', status: 'Planifié' },
];

export function DashboardPage() {
  const { profile, hasPermission } = useAuth();
  const canReadUsers = hasPermission('users:read');
  const canReadRoles = hasPermission('roles:read');
  const canReadAudit = hasPermission('audit:read');
  const canReadSettings = hasPermission('settings:read');
  const canReadYears = hasPermission('academic_years:read');
  const canReadClasses = hasPermission('classes:read');
  const canReadStudents = hasPermission('students:read');
  const canReadTeachers = hasPermission('teachers:read');
  const canReadGuardians = hasPermission('guardians:read');

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [teacherChartMode, setTeacherChartMode] = useState<'specialty' | 'contract'>('specialty');

  const usersQuery = useQuery({
    queryKey: ['dashboard-users-count'],
    queryFn: () => apiFetch<PaginatedResponse<UserProfile>>('/users?page=1&limit=1'),
    enabled: canReadUsers,
  });

  const studentsQuery = useQuery({
    queryKey: ['dashboard-students-count'],
    queryFn: () => apiFetch<PaginatedResponse<StudentItem>>('/students?page=1&limit=1'),
    enabled: canReadStudents,
  });

  const teachersQuery = useQuery({
    queryKey: ['dashboard-teachers-analytics'],
    queryFn: () => apiFetch<PaginatedResponse<TeacherItem>>('/teachers?page=1&limit=100'),
    enabled: canReadTeachers,
  });

  const guardiansQuery = useQuery({
    queryKey: ['dashboard-guardians-count'],
    queryFn: () => apiFetch<PaginatedResponse<GuardianItem>>('/guardians?page=1&limit=1'),
    enabled: canReadGuardians,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<{ items: RoleWithPermissions[] }>('/roles'),
    enabled: canReadRoles,
  });

  const auditQuery = useQuery({
    queryKey: ['dashboard-audit-recent'],
    queryFn: () => apiFetch<PaginatedResponse<AuditLogItem>>('/audit-logs?page=1&limit=5'),
    enabled: canReadAudit,
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SchoolSettings>('/settings'),
    enabled: canReadSettings,
  });

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
    enabled: canReadYears,
  });

  const classesQuery = useQuery({
    queryKey: ['dashboard-classes-analytics'],
    queryFn: () => apiFetch<PaginatedResponse<ClassItem>>('/classes?page=1&limit=100'),
    enabled: canReadClasses,
  });

  const activeYear = yearsQuery.data?.items.find((y) => y.status === 'ACTIVE');
  const currentTerm = activeYear?.terms.find((t) => t.isCurrent);

  // Default class chart filter to active academic year once loaded
  useEffect(() => {
    if (selectedYearId === null && activeYear) {
      setSelectedYearId(activeYear.id);
    }
  }, [activeYear, selectedYearId]);

  const effectiveYearId = selectedYearId === 0 ? null : selectedYearId;
  const classChartData = buildClassEnrollmentChartData(
    classesQuery.data?.items ?? [],
    effectiveYearId
  );
  const capacitySummary = computeCapacitySummary(classChartData);

  const allTeachers = teachersQuery.data?.items ?? [];
  const activeTeachersCount = allTeachers.filter((t) => t.isActive).length;
  const teacherDistribution = buildTeacherDistributionData(
    allTeachers,
    teacherChartMode,
    true
  );

  const roleChartData =
    rolesQuery.data?.items.map((r) => ({
      name: r.name,
      utilisateurs: r.userCount,
    })) ?? [];

  return (
    <AppLayout
      headerAction={
        canReadStudents ? (
          <Link
            to="/students"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Dossiers élèves
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {settingsQuery.data?.schoolName ?? 'Lycée Académia'} · Pilotage scolaire
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 [text-wrap:balance]">
              Bonjour, {profile?.firstName} {profile?.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Rôles actifs :{' '}
              <span className="font-medium text-slate-900">
                {profile?.roles.map((r) => r.name).join(' · ') || 'Aucun rôle'}
              </span>{' '}
              — <span className="font-mono tabular-nums">{profile?.permissions.length ?? 0}</span>{' '}
              permissions accordées.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canReadClasses && (
              <Link
                to="/classes"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
              >
                Classes & Salles
              </Link>
            )}
            {canReadTeachers && (
              <Link
                to="/teachers"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
              >
                Enseignants
              </Link>
            )}
            {canReadGuardians && (
              <Link
                to="/guardians"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
              >
                Parents & Tuteurs
              </Link>
            )}
          </div>
        </div>

        {(usersQuery.isError ||
          rolesQuery.isError ||
          auditQuery.isError ||
          classesQuery.isError ||
          teachersQuery.isError) && (
          <ErrorBanner message="Certaines statistiques n’ont pas pu être chargées." />
        )}

        {/* 4 KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to={canReadStudents ? '/students' : '/'}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors block"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Élèves actifs</span>
              <GraduationCap className="w-4 h-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {canReadStudents
                ? studentsQuery.isLoading
                  ? '—'
                  : studentsQuery.data?.pagination.total ?? 0
                : 'Restreint'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canReadGuardians
                ? `${guardiansQuery.data?.pagination.total ?? 0} responsable(s) légal(aux)`
                : 'Effectif scolarisé'}
            </p>
          </Link>

          <Link
            to={canReadClasses ? '/classes' : '/'}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors block"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Remplissage des classes</span>
              <Layers className="w-4 h-4 shrink-0 text-indigo-600" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {canReadClasses
                  ? classesQuery.isLoading
                    ? '—'
                    : `${capacitySummary.occupancyPct}%`
                  : 'Restreint'}
              </p>
              {canReadClasses && !classesQuery.isLoading && (
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {capacitySummary.totalEnrolled} / {capacitySummary.totalCapacity} pl.
                </span>
              )}
            </div>
            <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.min(100, capacitySummary.occupancyPct)}%` }}
              />
            </div>
          </Link>

          <Link
            to={canReadTeachers ? '/teachers' : '/'}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors block"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Corps enseignant</span>
              <BookUser className="w-4 h-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {canReadTeachers
                ? teachersQuery.isLoading
                  ? '—'
                  : activeTeachersCount
                : 'Restreint'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canReadTeachers
                ? `${teachersQuery.data?.pagination.total ?? 0} professeur(s) répertorié(s)`
                : 'Professeurs en exercice'}
            </p>
          </Link>

          <Link
            to={canReadYears ? '/academic-years' : '/'}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors block"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Année scolaire active</span>
              <CalendarRange className="w-4 h-4 shrink-0 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {canReadYears
                ? yearsQuery.isLoading
                  ? '—'
                  : activeYear?.name ?? 'Aucune'
                : 'Restreint'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {currentTerm ? currentTerm.name : 'Configurez une année active'} · Barème /
              {settingsQuery.data?.gradingScale ?? 20}
            </p>
          </Link>
        </div>

        {/* Module temps réel : Taux d'absentéisme & Liste des absents du jour */}
        <DailyAttendanceModule classes={classesQuery.data?.items ?? []} />

        {/* Module Notifications : Événements scolaires à venir (examens, réunions, vacances) */}
        <UpcomingEventsModule academicYears={yearsQuery.data?.items ?? []} />

        {/* Visualisations principales : Effectifs par classe & Répartition des enseignants */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Effectifs étudiants par classe
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  {capacitySummary.classCount} classe(s) · {capacitySummary.totalEnrolled} inscrit(s) sur{' '}
                  {capacitySummary.totalCapacity} places
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canReadYears && yearsQuery.data && yearsQuery.data.items.length > 0 && (
                  <select
                    aria-label="Filtrer les effectifs par année scolaire"
                    value={selectedYearId ?? 0}
                    onChange={(e) => setSelectedYearId(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
                  >
                    <option value={0}>Toutes les années</option>
                    {yearsQuery.data.items.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                )}
                {canReadClasses && (
                  <Link
                    to="/classes"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                  >
                    Gérer
                  </Link>
                )}
              </div>
            </div>

            {!canReadClasses ? (
              <div className="h-72 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-md">
                Vue réservée aux rôles disposant de l’accès classes:read.
              </div>
            ) : classesQuery.isLoading ? (
              <div className="h-72 bg-slate-50 rounded-md animate-pulse border border-slate-100" />
            ) : classChartData.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md px-6">
                <p className="text-sm font-medium text-slate-900">
                  Aucune classe ouverte sur cette période
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  Créez vos divisions pédagogiques et inscrivez des élèves pour suivre le taux d’occupation en temps réel.
                </p>
                <Link
                  to="/classes"
                  className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >
                  Configurer les classes
                </Link>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={classChartData}
                    margin={{ top: 8, right: 12, left: -16, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                      formatter={(value, name) => [
                        `${value} place(s)`,
                        name === 'inscrits' ? 'Élèves inscrits' : 'Places disponibles',
                      ]}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload as ClassEnrollmentChartPoint | undefined;
                        return row
                          ? `${label} (${row.levelName}) — ${row.occupancyPct}% occupé`
                          : String(label);
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="square"
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                    />
                    <Bar
                      dataKey="inscrits"
                      name="Élèves inscrits"
                      stackId="capacity"
                      fill="#4F46E5"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="placesLibres"
                      name="Places disponibles"
                      stackId="capacity"
                      fill="#E2E8F0"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Répartition des enseignants
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  {activeTeachersCount} professeur(s) actif(s)
                </p>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md shrink-0">
                <button
                  type="button"
                  onClick={() => setTeacherChartMode('specialty')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    teacherChartMode === 'specialty'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Spécialités
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherChartMode('contract')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    teacherChartMode === 'contract'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Contrats
                </button>
              </div>
            </div>

            {!canReadTeachers ? (
              <div className="flex-1 min-h-[260px] flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-md">
                Vue réservée aux rôles disposant de l’accès teachers:read.
              </div>
            ) : teachersQuery.isLoading ? (
              <div className="flex-1 min-h-[260px] bg-slate-50 rounded-md animate-pulse border border-slate-100" />
            ) : teacherDistribution.length === 0 ? (
              <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md px-6">
                <p className="text-sm font-medium text-slate-900">
                  Aucun enseignant actif enregistré
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ajoutez des enseignants pour visualiser la ventilation par discipline et statut de contrat.
                </p>
                <Link
                  to="/teachers"
                  className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >
                  Ajouter un enseignant
                </Link>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between gap-4">
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={teacherDistribution}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {teacherDistribution.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#FFFFFF',
                          fontSize: '12px',
                        }}
                        formatter={(value, _name, item) => [
                          `${value} enseignant(s) (${item.payload.percentage}%)`,
                          item.payload.label,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="divide-y divide-slate-100 text-xs">
                  {teacherDistribution.map((item) => (
                    <li
                      key={item.key}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-slate-800 truncate">{item.label}</span>
                      </div>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        {item.count} <span className="text-slate-400">({item.percentage}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Ligne secondaire : Comptes par rôle & Journal d'activité */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Répartition des comptes par rôle
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Utilisateurs rattachés aux 8 rôles de l’établissement
                </p>
              </div>
              {canReadRoles && (
                <Link
                  to="/roles"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0"
                >
                  Configurer la matrice
                </Link>
              )}
            </div>

            {canReadRoles && roleChartData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={roleChartData}
                    margin={{ top: 8, right: 12, left: -16, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="utilisateurs" fill="#0F172A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-md">
                {canReadRoles
                  ? 'Chargement de la répartition des rôles...'
                  : 'Vue réservée aux rôles disposant de l’accès roles:read.'}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Journal d’activité récent
              </h2>
              {canReadAudit && (
                <Link
                  to="/audit"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0"
                >
                  Voir tout
                </Link>
              )}
            </div>

            {canReadAudit ? (
              auditQuery.data && auditQuery.data.items.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {auditQuery.data.items.map((log) => (
                    <li key={log.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-medium text-slate-900 truncate">
                          {log.action}
                        </span>
                        <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {log.actorEmail ?? 'Système'} · {log.entityType}
                        {log.entityId ? ` #${log.entityId}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Aucun événement enregistré pour le moment.
                </p>
              )
            ) : (
              <div className="py-6 space-y-3 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <HeartHandshake className="w-4 h-4 text-indigo-600" />
                  <span>Raccourcis de votre espace</span>
                </div>
                <p>
                  Utilisez le menu latéral ou la recherche rapide (<kbd className="font-mono">⌘K</kbd>) pour naviguer directement dans les dossiers autorisés pour votre rôle.
                </p>
                {canReadUsers && (
                  <Link to="/users" className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    Consulter l’annuaire
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Progression modulaire du système
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Phase 1 entièrement opérationnelle — prête pour le déploiement de la Phase 2 (Pédagogie)
          </p>
          <div className="mt-4 divide-y divide-slate-100">
            {ROADMAP_MODULES.map((mod) => (
              <div
                key={mod.title}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs text-slate-500">{mod.phase}</p>
                  <p className="text-sm font-medium text-slate-900">{mod.title}</p>
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                    mod.status === 'Opérationnel'
                      ? 'text-emerald-700'
                      : mod.status === 'Prochaine étape'
                        ? 'text-indigo-700'
                        : 'text-slate-500'
                  }`}
                >
                  {mod.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
