import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  StatusIndicator,
  TableSkeleton,
} from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  ClassItem,
  ClassRosterStudent,
  ClassroomItem,
  LevelItem,
  PaginatedResponse,
  SeriesItem,
} from '../../types/api.ts';

const classFormSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis (ex: 6e A).').max(60),
  academicYearId: z.number().int().positive('Année scolaire requise.'),
  levelId: z.number().int().positive('Niveau requis.'),
  seriesId: z.number().int().positive().nullable().optional(),
  classroomId: z.number().int().positive().nullable().optional(),
  capacity: z.number().int().min(1, 'Capacité minimale 1').max(200),
});

const levelFormSchema = z.object({
  code: z.string().trim().min(1, 'Code requis.').max(20),
  name: z.string().trim().min(2, 'Nom requis.').max(80),
  cycle: z.enum(['COLLEGE', 'LYCEE']),
  orderIndex: z.number().int().min(1).max(50),
});

const seriesFormSchema = z.object({
  code: z.string().trim().min(1, 'Code requis.').max(20),
  name: z.string().trim().min(2, 'Nom requis.').max(80),
  description: z.string().trim().max(240),
});

const classroomFormSchema = z.object({
  code: z.string().trim().min(1, 'Code requis.').max(30),
  name: z.string().trim().min(2, 'Nom requis.').max(80),
  building: z.string().trim().min(1, 'Bâtiment requis.').max(80),
  capacity: z.number().int().min(1).max(500),
  roomType: z.enum(['CLASSROOM', 'LAB', 'IT_ROOM', 'EXAM_HALL']),
  isActive: z.boolean(),
});

const ROOM_TYPE_LABELS: Record<ClassroomItem['roomType'], string> = {
  CLASSROOM: 'Salle de cours',
  LAB: 'Laboratoire',
  IT_ROOM: 'Salle informatique',
  EXAM_HALL: 'Salle d’examen',
};

export function ClassesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('classes:manage');

  const [tab, setTab] = useState<'classes' | 'levels' | 'series' | 'classrooms'>('classes');
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClassItem | null>(null);
  const [rosterTarget, setRosterTarget] = useState<ClassItem | null>(null);

  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<LevelItem | null>(null);

  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesItem | null>(null);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ClassroomItem | null>(null);

  // Queries
  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
  });

  const levelsQuery = useQuery({
    queryKey: ['levels'],
    queryFn: () => apiFetch<{ items: LevelItem[] }>('/classes/levels'),
  });

  const seriesQuery = useQuery({
    queryKey: ['series'],
    queryFn: () => apiFetch<{ items: SeriesItem[] }>('/classes/series'),
  });

  const classroomsQuery = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => apiFetch<{ items: ClassroomItem[] }>('/classes/classrooms'),
  });

  const classParams = new URLSearchParams({
    page: String(page),
    limit: '15',
    includeArchived: String(includeArchived),
  });
  if (yearFilter) classParams.set('academicYearId', yearFilter);
  if (levelFilter) classParams.set('levelId', levelFilter);
  if (search.trim()) classParams.set('search', search.trim());

  const classesQuery = useQuery({
    queryKey: ['classes', page, yearFilter, levelFilter, search, includeArchived],
    queryFn: () => apiFetch<PaginatedResponse<ClassItem>>(`/classes?${classParams.toString()}`),
  });

  const rosterQuery = useQuery({
    queryKey: ['class-roster', rosterTarget?.id],
    queryFn: () =>
      apiFetch<{ classInfo: ClassItem; students: ClassRosterStudent[] }>(
        `/classes/${rosterTarget!.id}/students`
      ),
    enabled: Boolean(rosterTarget),
  });

  // Forms
  const classForm = useForm<z.infer<typeof classFormSchema>>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      academicYearId: 0,
      levelId: 0,
      seriesId: null,
      classroomId: null,
      capacity: 35,
    },
  });

  const levelForm = useForm<z.infer<typeof levelFormSchema>>({
    resolver: zodResolver(levelFormSchema),
    defaultValues: { code: '', name: '', cycle: 'COLLEGE', orderIndex: 1 },
  });

  const seriesForm = useForm<z.infer<typeof seriesFormSchema>>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: { code: '', name: '', description: '' },
  });

  const roomForm = useForm<z.infer<typeof classroomFormSchema>>({
    resolver: zodResolver(classroomFormSchema),
    defaultValues: {
      code: '',
      name: '',
      building: 'Bâtiment principal',
      capacity: 35,
      roomType: 'CLASSROOM',
      isActive: true,
    },
  });

  // Mutations
  const seedLevelsMutation = useMutation({
    mutationFn: () => apiFetch<{ items: LevelItem[] }>('/classes/levels/seed-defaults', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      setFeedback({ type: 'success', text: 'Les niveaux standards (6e à Terminale) ont été initialisés.' });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur d’initialisation.',
      }),
  });

  const seedSeriesMutation = useMutation({
    mutationFn: () => apiFetch<{ items: SeriesItem[] }>('/classes/series/seed-defaults', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setFeedback({ type: 'success', text: 'Les séries standards (Générale, L, ES, S) ont été initialisées.' });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur d’initialisation.',
      }),
  });

  const saveClassMutation = useMutation({
    mutationFn: (vals: z.infer<typeof classFormSchema>) => {
      if (editingClass) {
        return apiFetch<ClassItem>(`/classes/${editingClass.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: vals.name,
            levelId: vals.levelId,
            seriesId: vals.seriesId || null,
            classroomId: vals.classroomId || null,
            capacity: vals.capacity,
          }),
        });
      }
      return apiFetch<ClassItem>('/classes', {
        method: 'POST',
        body: JSON.stringify({
          ...vals,
          seriesId: vals.seriesId || null,
          classroomId: vals.classroomId || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassModalOpen(false);
      setFeedback({
        type: 'success',
        text: editingClass ? 'Classe mise à jour.' : 'Classe créée.',
      });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      }),
  });

  const archiveClassMutation = useMutation({
    mutationFn: (cls: ClassItem) =>
      apiFetch<ClassItem>(`/classes/${cls.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !cls.isArchived }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setArchiveTarget(null);
      setFeedback({
        type: 'success',
        text: updated.isArchived ? `Classe « ${updated.name} » archivée.` : `Classe « ${updated.name} » restaurée.`,
      });
    },
    onError: (err) => {
      setArchiveTarget(null);
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Action refusée.',
      });
    },
  });

  const saveLevelMutation = useMutation({
    mutationFn: (vals: z.infer<typeof levelFormSchema>) =>
      editingLevel
        ? apiFetch(`/classes/levels/${editingLevel.id}`, { method: 'PATCH', body: JSON.stringify(vals) })
        : apiFetch('/classes/levels', { method: 'POST', body: JSON.stringify(vals) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      setLevelModalOpen(false);
      setFeedback({ type: 'success', text: editingLevel ? 'Niveau mis à jour.' : 'Niveau créé.' });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      }),
  });

  const saveSeriesMutation = useMutation({
    mutationFn: (vals: z.infer<typeof seriesFormSchema>) =>
      editingSeries
        ? apiFetch(`/classes/series/${editingSeries.id}`, { method: 'PATCH', body: JSON.stringify(vals) })
        : apiFetch('/classes/series', { method: 'POST', body: JSON.stringify(vals) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSeriesModalOpen(false);
      setFeedback({ type: 'success', text: editingSeries ? 'Série mise à jour.' : 'Série créée.' });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      }),
  });

  const saveRoomMutation = useMutation({
    mutationFn: (vals: z.infer<typeof classroomFormSchema>) =>
      editingRoom
        ? apiFetch(`/classes/classrooms/${editingRoom.id}`, { method: 'PATCH', body: JSON.stringify(vals) })
        : apiFetch('/classes/classrooms', { method: 'POST', body: JSON.stringify(vals) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setRoomModalOpen(false);
      setFeedback({ type: 'success', text: editingRoom ? 'Salle mise à jour.' : 'Salle créée.' });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      }),
  });

  const openCreateClass = () => {
    setEditingClass(null);
    const activeYear =
      yearsQuery.data?.items.find((y) => y.status === 'ACTIVE') ??
      yearsQuery.data?.items.find((y) => y.status !== 'CLOSED');
    const firstLevel = levelsQuery.data?.items[0];
    classForm.reset({
      name: '',
      academicYearId: activeYear?.id ?? 0,
      levelId: firstLevel?.id ?? 0,
      seriesId: null,
      classroomId: null,
      capacity: 35,
    });
    setClassModalOpen(true);
  };

  const openEditClass = (cls: ClassItem) => {
    setEditingClass(cls);
    classForm.reset({
      name: cls.name,
      academicYearId: cls.academicYearId,
      levelId: cls.levelId,
      seriesId: cls.seriesId,
      classroomId: cls.classroomId,
      capacity: cls.capacity,
    });
    setClassModalOpen(true);
  };

  const renderPrimaryAction = () => {
    if (!canManage) return undefined;
    if (tab === 'classes') {
      return (
        <button
          type="button"
          onClick={openCreateClass}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Nouvelle classe
        </button>
      );
    }
    if (tab === 'levels') {
      return (
        <button
          type="button"
          onClick={() => {
            setEditingLevel(null);
            levelForm.reset({
              code: '',
              name: '',
              cycle: 'COLLEGE',
              orderIndex: (levelsQuery.data?.items.length ?? 0) + 1,
            });
            setLevelModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Nouveau niveau
        </button>
      );
    }
    if (tab === 'series') {
      return (
        <button
          type="button"
          onClick={() => {
            setEditingSeries(null);
            seriesForm.reset({ code: '', name: '', description: '' });
            setSeriesModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Nouvelle série
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setEditingRoom(null);
          roomForm.reset({
            code: '',
            name: '',
            building: 'Bâtiment principal',
            capacity: 35,
            roomType: 'CLASSROOM',
            isActive: true,
          });
          setRoomModalOpen(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Plus className="w-4 h-4 shrink-0" />
        Nouvelle salle
      </button>
    );
  };

  return (
    <AppLayout headerAction={renderPrimaryAction()}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Niveaux, Séries, Salles & Classes
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Structurez les divisions pédagogiques, attribuez les salles et contrôlez les capacités d’accueil.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-md shrink-0 self-start sm:self-auto">
            {(
              [
                { id: 'classes', label: 'Classes' },
                { id: 'levels', label: 'Niveaux' },
                { id: 'series', label: 'Séries' },
                { id: 'classrooms', label: 'Salles' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {tab === 'classes' && (
          <>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Rechercher une classe (ex: 6e A, Terminale S)..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="Filtrer par année scolaire"
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                >
                  <option value="">Toutes les années</option>
                  {yearsQuery.data?.items.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrer par niveau"
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                >
                  <option value="">Tous les niveaux</option>
                  {levelsQuery.data?.items.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => {
                      setIncludeArchived(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                  />
                  <span>Inclure archivées</span>
                </label>
              </div>
            </div>

            {classesQuery.isLoading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : classesQuery.isError ? (
              <ErrorBanner
                message="Impossible de charger les classes."
                onRetry={() => classesQuery.refetch()}
              />
            ) : classesQuery.data && classesQuery.data.items.length === 0 ? (
              <EmptyState
                title="Aucune classe trouvée"
                description="Créez d’abord une année scolaire et les niveaux, puis ajoutez vos classes."
                action={
                  canManage ? (
                    <button
                      type="button"
                      onClick={openCreateClass}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                    >
                      Créer une classe
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <th className="py-3 px-4">Classe</th>
                        <th className="py-3 px-4">Année</th>
                        <th className="py-3 px-4">Niveau & Série</th>
                        <th className="py-3 px-4">Salle attribuée</th>
                        <th className="py-3 px-4 text-right">Capacité</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {classesQuery.data?.items.map((cls) => (
                        <tr key={cls.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {cls.name}
                            {cls.isArchived && (
                              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                                (Archivée)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {cls.academicYearName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                            {cls.levelName}
                            {cls.seriesName ? ` · ${cls.seriesName}` : ''}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {cls.classroomName ? (
                              <span>
                                {cls.classroomName}{' '}
                                <span className="font-mono text-slate-400">
                                  ({cls.classroomCapacity} pl.)
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Non attribuée</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                            {cls.enrolledCount} / {cls.capacity}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setRosterTarget(cls)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5" />
                                Élèves
                              </button>
                              {canManage && cls.academicYearStatus !== 'CLOSED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditClass(cls)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setArchiveTarget(cls)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    {cls.isArchived ? 'Restaurer' : 'Archiver'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {classesQuery.data && classesQuery.data.pagination.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-mono tabular-nums">
                      Page {classesQuery.data.pagination.page} / {classesQuery.data.pagination.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 cursor-pointer"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        disabled={page >= classesQuery.data.pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 cursor-pointer"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'levels' && (
          <div className="space-y-4">
            {canManage && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Vous pouvez initialiser automatiquement les 7 niveaux standards (6e, 5e, 4e, 3e, Seconde, Première, Terminale).
                </p>
                <button
                  type="button"
                  disabled={seedLevelsMutation.isPending}
                  onClick={() => seedLevelsMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Initialiser 6e à Terminale
                </button>
              </div>
            )}

            {levelsQuery.isLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : levelsQuery.data?.items.length === 0 ? (
              <EmptyState
                title="Aucun niveau configuré"
                description="Initialisez les niveaux du collège et du lycée en un clic ou créez-les manuellement."
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4">Ordre</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Libellé</th>
                      <th className="py-3 px-4">Cycle</th>
                      {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {levelsQuery.data?.items.map((lvl) => (
                      <tr key={lvl.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {lvl.orderIndex}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {lvl.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{lvl.name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                          {lvl.cycle === 'COLLEGE' ? 'Collège' : 'Lycée'}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLevel(lvl);
                                levelForm.reset(lvl);
                                setLevelModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                            >
                              Modifier
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'series' && (
          <div className="space-y-4">
            {canManage && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Les séries permettent de spécialiser les classes du lycée (Générale, L, ES, S, ou filières personnalisées).
                </p>
                <button
                  type="button"
                  disabled={seedSeriesMutation.isPending}
                  onClick={() => seedSeriesMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Initialiser séries standards
                </button>
              </div>
            )}

            {seriesQuery.isLoading ? (
              <TableSkeleton rows={4} cols={3} />
            ) : seriesQuery.data?.items.length === 0 ? (
              <EmptyState
                title="Aucune série enregistrée"
                description="Ajoutez vos séries d’enseignement ou initialisez les séries standards."
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Intitulé</th>
                      <th className="py-3 px-4">Description</th>
                      {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {seriesQuery.data?.items.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {s.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                          {s.description || '—'}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSeries(s);
                                seriesForm.reset(s);
                                setSeriesModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                            >
                              Modifier
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'classrooms' && (
          <div>
            {classroomsQuery.isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : classroomsQuery.data?.items.length === 0 ? (
              <EmptyState
                title="Aucune salle enregistrée"
                description="Enregistrez les salles de cours, laboratoires et salles informatiques avec leur capacité maximale."
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Salle</th>
                      <th className="py-3 px-4">Bâtiment & Type</th>
                      <th className="py-3 px-4 text-right">Capacité</th>
                      <th className="py-3 px-4">Statut</th>
                      {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {classroomsQuery.data?.items.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {room.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{room.name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                          {room.building} · {ROOM_TYPE_LABELS[room.roomType]}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 dark:text-slate-200 tabular-nums">
                          {room.capacity} places
                        </td>
                        <td className="py-3 px-4">
                          <StatusIndicator active={room.isActive} />
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoom(room);
                                roomForm.reset(room);
                                setRoomModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                            >
                              Modifier
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Classe */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingClass ? `Modifier ${editingClass.name}` : 'Créer une classe'}
              </h2>
              <button
                type="button"
                onClick={() => setClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={classForm.handleSubmit((vals) => saveClassMutation.mutate(vals))}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nom de la classe
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 6e A"
                    {...classForm.register('name')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {classForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {classForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Année scolaire
                  </label>
                  <select
                    disabled={Boolean(editingClass)}
                    {...classForm.register('academicYearId', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                  >
                    <option value={0}>Sélectionner...</option>
                    {yearsQuery.data?.items
                      .filter((y) => y.status !== 'CLOSED')
                      .map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Niveau
                  </label>
                  <select
                    {...classForm.register('levelId', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value={0}>Sélectionner...</option>
                    {levelsQuery.data?.items.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Série (optionnel)
                  </label>
                  <select
                    {...classForm.register('seriesId', {
                      setValueAs: (v) => (v ? Number(v) : null),
                    })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="">Aucune</option>
                    {seriesQuery.data?.items.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Salle attribuée (optionnel)
                  </label>
                  <select
                    {...classForm.register('classroomId', {
                      setValueAs: (v) => (v ? Number(v) : null),
                    })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="">Aucune salle</option>
                    {classroomsQuery.data?.items
                      .filter((r) => r.isActive)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.capacity} pl.)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacité maximale (élèves)
                  </label>
                  <input
                    type="number"
                    {...classForm.register('capacity', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveClassMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saveClassMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Niveau */}
      {levelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingLevel ? 'Modifier le niveau' : 'Nouveau niveau'}
              </h2>
              <button
                type="button"
                onClick={() => setLevelModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={levelForm.handleSubmit((vals) => saveLevelMutation.mutate(vals))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="ex: 6E"
                    {...levelForm.register('code')}
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ordre</label>
                  <input
                    type="number"
                    {...levelForm.register('orderIndex', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Libellé</label>
                <input
                  type="text"
                  placeholder="ex: Sixième (6e)"
                  {...levelForm.register('name')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Cycle</label>
                <select
                  {...levelForm.register('cycle')}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                >
                  <option value="COLLEGE">Collège</option>
                  <option value="LYCEE">Lycée</option>
                </select>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLevelModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveLevelMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Série */}
      {seriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingSeries ? 'Modifier la série' : 'Nouvelle série'}
              </h2>
              <button
                type="button"
                onClick={() => setSeriesModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={seriesForm.handleSubmit((vals) => saveSeriesMutation.mutate(vals))}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  placeholder="ex: S"
                  {...seriesForm.register('code')}
                  className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nom</label>
                <input
                  type="text"
                  placeholder="ex: Scientifique (S)"
                  {...seriesForm.register('name')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  {...seriesForm.register('description')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSeriesModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveSeriesMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Salle */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
              </h2>
              <button
                type="button"
                onClick={() => setRoomModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={roomForm.handleSubmit((vals) => saveRoomMutation.mutate(vals))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="ex: S-101"
                    {...roomForm.register('code')}
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Capacité</label>
                  <input
                    type="number"
                    {...roomForm.register('capacity', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nom</label>
                <input
                  type="text"
                  placeholder="ex: Salle 101"
                  {...roomForm.register('name')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Bâtiment</label>
                  <input
                    type="text"
                    {...roomForm.register('building')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    {...roomForm.register('roomType')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="CLASSROOM">Salle de cours</option>
                    <option value="LAB">Laboratoire</option>
                    <option value="IT_ROOM">Salle informatique</option>
                    <option value="EXAM_HALL">Salle d’examen</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  {...roomForm.register('isActive')}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                />
                <span>Salle disponible pour affectation</span>
              </label>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveRoomMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Liste des élèves de la classe */}
      {rosterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Liste des élèves · {rosterTarget.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rosterTarget.academicYearName} · {rosterTarget.levelName} ·{' '}
                  <span className="font-mono tabular-nums">
                    {rosterTarget.enrolledCount} / {rosterTarget.capacity}
                  </span>{' '}
                  places occupées
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRosterTarget(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {rosterQuery.isLoading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : rosterQuery.data && rosterQuery.data.students.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-700/80 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <th className="py-2.5 px-3">Matricule</th>
                        <th className="py-2.5 px-3">Élève</th>
                        <th className="py-2.5 px-3">Genre</th>
                        <th className="py-2.5 px-3">Né(e) le</th>
                        <th className="py-2.5 px-3 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {rosterQuery.data.students.map((st) => (
                        <tr key={st.enrollmentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                          <td className="py-2.5 px-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                            {st.matricule}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                            {st.lastName} {st.firstName}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">
                            {st.gender === 'F' ? 'Féminin' : 'Masculin'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {st.dateOfBirth}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {st.status === 'ACTIVE' ? 'Inscrit' : st.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-700/80 rounded-md">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Aucun élève inscrit dans cette classe
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Inscrivez des élèves depuis le module Élèves pour constituer l’effectif de cette division.
                  </p>
                  <Link
                    to="/students"
                    onClick={() => setRosterTarget(null)}
                    className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/80"
                  >
                    Accéder aux élèves
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title={
          archiveTarget?.isArchived
            ? `Restaurer la classe ${archiveTarget.name} ?`
            : `Archiver la classe ${archiveTarget?.name} ?`
        }
        description={
          archiveTarget?.isArchived
            ? 'La classe redeviendra visible dans les listes actives.'
            : 'La classe sera masquée des listes actives tout en conservant son historique.'
        }
        confirmLabel={archiveTarget?.isArchived ? 'Restaurer' : 'Archiver'}
        danger={!archiveTarget?.isArchived}
        isPending={archiveClassMutation.isPending}
        onConfirm={() => archiveTarget && archiveClassMutation.mutate(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />
    </AppLayout>
  );
}
