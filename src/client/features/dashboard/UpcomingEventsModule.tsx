import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Calendar,
  CalendarClock,
  Edit3,
  FileSpreadsheet,
  MapPin,
  Palmtree,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmModal, ErrorBanner, TableSkeleton } from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  EventTargetAudience,
  SchoolEventCategory,
  SchoolEventItem,
  UpcomingEventsResponse,
} from '../../types/api.ts';

const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Le titre doit contenir au moins 3 caractères.')
      .max(140, '140 caractères maximum.'),
    category: z.enum(['EXAM', 'MEETING', 'HOLIDAY', 'OTHER']),
    description: z.string().max(1000, '1000 caractères maximum.'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début requise (AAAA-MM-JJ).'),
    endDate: z
      .string()
      .refine(
        (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v),
        'Format de date invalide.'
      ),
    startTime: z
      .string()
      .refine(
        (v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        'Format HH:MM attendu.'
      ),
    location: z.string().max(120, '120 caractères maximum.'),
    targetAudience: z.enum(['ALL', 'STAFF', 'TEACHERS', 'STUDENTS_PARENTS']),
    academicYearId: z.string(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'La date de fin doit être postérieure ou égale au début.',
    path: ['endDate'],
  });

type EventFormValues = z.infer<typeof eventFormSchema>;

const CATEGORY_META: Record<
  SchoolEventCategory,
  { label: string; accent: string; Icon: typeof FileSpreadsheet }
> = {
  EXAM: {
    label: 'Examen',
    accent: 'text-red-700 dark:text-red-400',
    Icon: FileSpreadsheet,
  },
  MEETING: {
    label: 'Réunion',
    accent: 'text-indigo-700 dark:text-indigo-300',
    Icon: Users,
  },
  HOLIDAY: {
    label: 'Vacances',
    accent: 'text-emerald-700 dark:text-emerald-400',
    Icon: Palmtree,
  },
  OTHER: {
    label: 'Événement',
    accent: 'text-slate-700 dark:text-slate-300',
    Icon: CalendarClock,
  },
};

const AUDIENCE_LABELS: Record<EventTargetAudience, string> = {
  ALL: 'Toute l’école',
  STAFF: 'Personnel & direction',
  TEACHERS: 'Enseignants',
  STUDENTS_PARENTS: 'Élèves & parents',
};

function formatShortDateParts(isoDate: string): { day: string; month: string; full: string } {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { day: '—', month: '', full: isoDate };
  }
  const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(parsed);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
    .format(parsed)
    .replace('.', '');
  const full = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
  return { day, month, full };
}

function formatCountdown(event: SchoolEventItem): { label: string; toneClass: string } {
  if (event.isOngoing) {
    return { label: 'En cours', toneClass: 'text-indigo-700 dark:text-indigo-300 font-semibold' };
  }
  if (event.daysUntil === 0) {
    return { label: 'Aujourd’hui', toneClass: 'text-red-700 dark:text-red-400 font-semibold' };
  }
  if (event.daysUntil === 1) {
    return { label: 'Demain', toneClass: 'text-amber-700 dark:text-amber-400 font-semibold' };
  }
  if (event.daysUntil <= 3) {
    return { label: `Dans ${event.daysUntil} jours`, toneClass: 'text-amber-700 dark:text-amber-400 font-semibold' };
  }
  if (event.daysUntil <= 7) {
    return { label: `Dans ${event.daysUntil} jours`, toneClass: 'text-slate-800 dark:text-slate-200 font-medium' };
  }
  return { label: `Dans ${event.daysUntil} jours`, toneClass: 'text-slate-500 dark:text-slate-400' };
}

export function UpcomingEventsModule({
  academicYears,
}: {
  academicYears: AcademicYearItem[];
}) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const canRead = hasPermission('announcements:read');
  const canWrite = hasPermission('announcements:write');

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | SchoolEventCategory>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolEventItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolEventItem | null>(null);

  const activeYear = academicYears.find((y) => y.status === 'ACTIVE');

  const eventsQuery = useQuery({
    queryKey: ['upcoming-events', categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '15' });
      if (categoryFilter !== 'ALL') {
        params.set('category', categoryFilter);
      }
      return apiFetch<UpcomingEventsResponse>(`/events/upcoming?${params.toString()}`);
    },
    enabled: canRead,
    refetchInterval: 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      category: 'EXAM',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      startTime: '',
      location: '',
      targetAudience: 'ALL',
      academicYearId: activeYear ? String(activeYear.id) : '',
    },
  });

  useEffect(() => {
    if (!modalOpen) return;
    if (editingEvent) {
      reset({
        title: editingEvent.title,
        category: editingEvent.category,
        description: editingEvent.description,
        startDate: editingEvent.startDate,
        endDate: editingEvent.endDate ?? '',
        startTime: editingEvent.startTime,
        location: editingEvent.location,
        targetAudience: editingEvent.targetAudience,
        academicYearId: editingEvent.academicYearId ? String(editingEvent.academicYearId) : '',
      });
    } else {
      reset({
        title: '',
        category: 'EXAM',
        description: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        startTime: '',
        location: '',
        targetAudience: 'ALL',
        academicYearId: activeYear ? String(activeYear.id) : '',
      });
    }
  }, [modalOpen, editingEvent, activeYear, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      const payload = {
        title: values.title.trim(),
        category: values.category,
        description: values.description.trim(),
        startDate: values.startDate,
        endDate: values.endDate ? values.endDate : null,
        startTime: values.startTime.trim(),
        location: values.location.trim(),
        targetAudience: values.targetAudience,
        academicYearId: values.academicYearId ? Number(values.academicYearId) : null,
      };
      if (editingEvent) {
        return apiFetch<SchoolEventItem>(`/events/${editingEvent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<SchoolEventItem>('/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-audit-recent'] });
      setModalOpen(false);
      setEditingEvent(null);
      toast.success(
        editingEvent ? 'Événement mis à jour.' : 'Événement publié dans les notifications.'
      );
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Impossible d’enregistrer l’événement.'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/events/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-audit-recent'] });
      setDeleteTarget(null);
      toast.success('Événement supprimé.');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Échec de la suppression.'
      );
    },
  });

  if (!canRead) {
    return null;
  }

  const summary = eventsQuery.data?.summary;
  const items = eventsQuery.data?.items ?? [];

  return (
    <section
      aria-label="Notifications et événements scolaires à venir"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden"
    >
      {/* En-tête du module */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Notifications & Événements à venir
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary
              ? `${summary.totalUpcoming} événement(s) programmé(s) · ${summary.withinSevenDays} dans les 7 prochains jours`
              : 'Chargement du calendrier de l’établissement...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-x-auto">
            {(
              [
                { id: 'ALL', label: `Tous (${summary?.totalUpcoming ?? 0})` },
                { id: 'EXAM', label: `Examens (${summary?.examCount ?? 0})` },
                { id: 'MEETING', label: `Réunions (${summary?.meetingCount ?? 0})` },
                { id: 'HOLIDAY', label: `Vacances (${summary?.holidayCount ?? 0})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvel événement
            </button>
          )}
        </div>
      </div>

      {/* Liste des notifications */}
      {eventsQuery.isLoading ? (
        <div className="p-6">
          <TableSkeleton rows={3} cols={4} />
        </div>
      ) : eventsQuery.isError ? (
        <div className="p-6">
          <ErrorBanner
            message="Impossible de récupérer les événements scolaires à venir."
            onRetry={() => eventsQuery.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Calendar className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
            Aucun événement à venir sur ce filtre
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {categoryFilter === 'ALL'
              ? 'Les examens, réunions pédagogiques et périodes de vacances programmés apparaîtront automatiquement ici.'
              : 'Aucun événement programmé pour cette catégorie. Essayez de consulter tous les événements.'}
          </p>
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Planifier un événement
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((ev) => {
            const meta = CATEGORY_META[ev.category] ?? CATEGORY_META.OTHER;
            const CategoryIcon = meta.Icon;
            const dateParts = formatShortDateParts(ev.startDate);
            const endParts = ev.endDate ? formatShortDateParts(ev.endDate) : null;
            const countdown = formatCountdown(ev);

            return (
              <li
                key={ev.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Bloc date compact (typographie tabulaire, sans pilule) */}
                  <div className="w-12 shrink-0 text-center pt-0.5 border-r border-slate-200 dark:border-slate-700/80 pr-3">
                    <p className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {dateParts.day}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {dateParts.month}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.accent}`}
                      >
                        <CategoryIcon className="w-3.5 h-3.5 shrink-0" />
                        {meta.label}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className={`text-xs font-mono tabular-nums ${countdown.toneClass}`}>
                        {countdown.label}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {AUDIENCE_LABELS[ev.targetAudience]}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {ev.title}
                    </h3>

                    {ev.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums pt-0.5">
                      <span>
                        {endParts && ev.endDate !== ev.startDate
                          ? `Du ${dateParts.full} au ${endParts.full}`
                          : dateParts.full}
                      </span>
                      {ev.startTime && <span>à {ev.startTime}</span>}
                      {ev.location && (
                        <span className="inline-flex items-center gap-1 font-sans text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {ev.location}
                        </span>
                      )}
                      {ev.academicYearName && (
                        <span className="font-sans text-slate-400">
                          · {ev.academicYearName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canWrite && (
                  <div className="flex items-center gap-1.5 shrink-0 sm:pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEvent(ev);
                        setModalOpen(true);
                      }}
                      aria-label={`Modifier ${ev.title}`}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ev)}
                      aria-label={`Supprimer ${ev.title}`}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal création / édition d'événement */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4">
              <div>
                <h3 id="event-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {editingEvent ? 'Modifier l’événement scolaire' : 'Planifier un événement scolaire'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visible instantanément dans le flux de notifications du tableau de bord.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingEvent(null);
                }}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titre de l’événement *
                </label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="ex: Conseils de classe du 1er trimestre, Bac blanc..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-400">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Catégorie *
                  </label>
                  <select
                    {...register('category')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="EXAM">Examen / Évaluation</option>
                    <option value="MEETING">Réunion / Conseil</option>
                    <option value="HOLIDAY">Vacances / Jour férié</option>
                    <option value="OTHER">Autre événement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Public cible *
                  </label>
                  <select
                    {...register('targetAudience')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="ALL">Toute l’école</option>
                    <option value="STAFF">Personnel & direction</option>
                    <option value="TEACHERS">Enseignants</option>
                    <option value="STUDENTS_PARENTS">Élèves & parents</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    {...register('startDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">{errors.startDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    {...register('endDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {errors.endDate && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">{errors.endDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Heure
                  </label>
                  <input
                    type="time"
                    {...register('startTime')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {errors.startTime && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">{errors.startTime.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Lieu / Salle
                  </label>
                  <input
                    type="text"
                    {...register('location')}
                    placeholder="ex: Amphithéâtre, Salle B12..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Année scolaire
                  </label>
                  <select
                    {...register('academicYearId')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="">Non rattachée</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Détails complémentaires
                </label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="Consignes, classes concernées ou documents à prévoir..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-400">{errors.description.message}</p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveMutation.isPending
                    ? 'Enregistrement...'
                    : editingEvent
                      ? 'Mettre à jour'
                      : 'Publier l’événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Supprimer l’événement ?"
        description={
          deleteTarget
            ? `L’événement « ${deleteTarget.title} » sera retiré du calendrier et des notifications du tableau de bord.`
            : ''
        }
        confirmLabel="Supprimer"
        danger
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
      />
    </section>
  );
}
