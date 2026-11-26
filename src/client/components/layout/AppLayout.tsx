import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  BookUser,
  Building2,
  CalendarRange,
  Command,
  GraduationCap,
  HeartHandshake,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  ClassItem,
  PaginatedResponse,
  StudentItem,
  TeacherItem,
} from '../../types/api.ts';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Scolarité',
    items: [
      { to: '/academic-years', label: 'Années scolaires', icon: CalendarRange, permission: 'academic_years:read' },
      { to: '/classes', label: 'Classes & Niveaux', icon: Layers, permission: 'classes:read' },
      { to: '/students', label: 'Élèves', icon: GraduationCap, permission: 'students:read' },
      { to: '/teachers', label: 'Enseignants', icon: BookUser, permission: 'teachers:read' },
      { to: '/guardians', label: 'Parents & Tuteurs', icon: HeartHandshake, permission: 'guardians:read' },
    ],
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/subjects', label: 'Matières & Programmes', icon: BookOpen, permission: 'subjects:read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Utilisateurs', icon: Users, permission: 'users:read' },
      { to: '/roles', label: 'Rôles & Permissions', icon: ShieldCheck, permission: 'roles:read' },
      { to: '/audit', label: 'Journal d’audit', icon: ScrollText, permission: 'audit:read' },
      { to: '/settings', label: 'Établissement', icon: Building2, permission: 'settings:read' },
      { to: '/profile', label: 'Mon profil', icon: UserCircle },
    ],
  },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Tableau de bord',
  '/academic-years': 'Scolarité / Années scolaires & Périodes',
  '/classes': 'Scolarité / Niveaux, Salles & Classes',
  '/students': 'Scolarité / Élèves & Inscriptions',
  '/teachers': 'Scolarité / Corps enseignant',
  '/guardians': 'Scolarité / Parents & Responsables légaux',
  '/subjects': 'Pédagogie / Matières, Coefficients & Programmes',
  '/users': 'Administration / Utilisateurs',
  '/roles': 'Administration / Rôles & Permissions',
  '/audit': 'Sécurité / Journal d’audit',
  '/settings': 'Configuration / Établissement',
  '/profile': 'Compte / Mon profil',
};

export function AppLayout({
  children,
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  const { profile, signOut, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  const canReadYears = hasPermission('academic_years:read');
  const canReadStudents = hasPermission('students:read');
  const canReadTeachers = hasPermission('teachers:read');
  const canReadClasses = hasPermission('classes:read');

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
    enabled: canReadYears,
    staleTime: 60_000,
  });

  const activeYear = yearsQuery.data?.items.find((y) => y.status === 'ACTIVE');
  const currentTerm = activeYear?.terms.find((t) => t.isCurrent);

  // Quick search queries (only active when palette is open and query >= 2 chars)
  const trimmedQuery = paletteQuery.trim();
  const studentSearchQuery = useQuery({
    queryKey: ['palette-students', trimmedQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<StudentItem>>(
        `/students?search=${encodeURIComponent(trimmedQuery)}&limit=5`
      ),
    enabled: paletteOpen && canReadStudents && trimmedQuery.length >= 2,
  });

  const teacherSearchQuery = useQuery({
    queryKey: ['palette-teachers', trimmedQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<TeacherItem>>(
        `/teachers?search=${encodeURIComponent(trimmedQuery)}&limit=5`
      ),
    enabled: paletteOpen && canReadTeachers && trimmedQuery.length >= 2,
  });

  const classSearchQuery = useQuery({
    queryKey: ['palette-classes', trimmedQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<ClassItem>>(
        `/classes?search=${encodeURIComponent(trimmedQuery)}&limit=5`
      ),
    enabled: paletteOpen && canReadClasses && trimmedQuery.length >= 2,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((group) => group.items.length > 0);

  const flatVisibleItems = visibleGroups.flatMap((g) => g.items);
  const filteredRoutes = trimmedQuery
    ? flatVisibleItems.filter((item) =>
        item.label.toLowerCase().includes(trimmedQuery.toLowerCase())
      )
    : flatVisibleItems;

  const breadcrumb = BREADCRUMB_MAP[location.pathname] ?? 'Académia';
  const primaryRoleName = profile?.roles[0]?.name ?? 'Utilisateur';

  const openPalette = () => {
    setPaletteQuery('');
    setPaletteOpen(true);
  };

  const navigateAndClose = (path: string) => {
    setPaletteOpen(false);
    setPaletteQuery('');
    navigate(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Académia
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Fermer le menu"
          className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" aria-label="Navigation principale">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-semibold shrink-0">
              {profile?.firstName?.[0] ?? 'A'}
              {profile?.lastName?.[0] ?? 'C'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile?.firstName} {profile?.lastName}
            </p>
            <p className="text-xs text-slate-400 truncate">{primaryRoleName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          Se déconnecter
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-700 truncate">
              {breadcrumb}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canReadYears && activeYear && (
              <Link
                to="/academic-years"
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 pr-2 border-r border-slate-200 whitespace-nowrap"
              >
                <span className="font-mono font-medium text-slate-800 tabular-nums">
                  {activeYear.name}
                </span>
                {currentTerm && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{currentTerm.name}</span>
                  </>
                )}
              </Link>
            )}

            <button
              type="button"
              onClick={openPalette}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              aria-label="Recherche rapide"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Rechercher...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-500 pl-1.5 border-l border-slate-300">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            </button>

            {headerAction}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Palette de recherche globale (Ctrl+K / Cmd+K) */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-slate-950/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recherche rapide"
            className="w-full max-w-xl bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="search"
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Rechercher un élève (matricule, nom), un enseignant, une classe ou un module..."
                className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="text-xs font-mono text-slate-400 hover:text-slate-700 px-1.5 py-0.5 border border-slate-200 rounded cursor-pointer"
              >
                Échap
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {trimmedQuery.length >= 2 &&
                studentSearchQuery.data &&
                studentSearchQuery.data.items.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Élèves
                    </p>
                    {studentSearchQuery.data.items.map((st) => (
                      <button
                        key={`st-${st.id}`}
                        type="button"
                        onClick={() => navigateAndClose(`/students?studentId=${st.id}`)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900">
                            {st.lastName} {st.firstName}
                          </span>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {st.matricule}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">
                          {st.currentEnrollment?.className ?? 'Non inscrit'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

              {trimmedQuery.length >= 2 &&
                teacherSearchQuery.data &&
                teacherSearchQuery.data.items.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Enseignants
                    </p>
                    {teacherSearchQuery.data.items.map((t) => (
                      <button
                        key={`tc-${t.id}`}
                        type="button"
                        onClick={() => navigateAndClose(`/teachers?teacherId=${t.id}`)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900">
                            {t.lastName} {t.firstName}
                          </span>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {t.employeeCode}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{t.specialty}</span>
                      </button>
                    ))}
                  </div>
                )}

              {trimmedQuery.length >= 2 &&
                classSearchQuery.data &&
                classSearchQuery.data.items.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Classes
                    </p>
                    {classSearchQuery.data.items.map((c) => (
                      <button
                        key={`cl-${c.id}`}
                        type="button"
                        onClick={() => navigateAndClose('/classes')}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        <span className="font-medium text-slate-900">{c.name}</span>
                        <span className="text-xs text-slate-500">
                          {c.levelName} · {c.enrolledCount}/{c.capacity} élèves
                        </span>
                      </button>
                    ))}
                  </div>
                )}

              <div className="p-2">
                <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Navigation directe
                </p>
                {filteredRoutes.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-500 text-center">
                    Aucun module correspondant.
                  </p>
                ) : (
                  filteredRoutes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => navigateAndClose(item.to)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-slate-400" />
                          {item.label}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
