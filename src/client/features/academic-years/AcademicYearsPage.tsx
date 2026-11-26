import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Edit3,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  TableSkeleton,
} from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { AcademicYearItem, TermItem } from '../../types/api.ts';

const yearFormSchema = z
  .object({
    name: z.string().trim().min(4, 'Libellé requis (ex: 2026-2027).').max(40),
    startDate: z.string().min(10, 'Date de début requise.'),
    endDate: z.string().min(10, 'Date de fin requise.'),
    autoGeneratePeriods: z.enum(['TRIMESTER', 'SEMESTER', 'NONE']),
  })
  .refine((d) => d.startDate < d.endDate, {
    message: 'La date de fin doit être postérieure à la date de début.',
    path: ['endDate'],
  });

type YearFormValues = z.infer<typeof yearFormSchema>;

const termFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Nom requis.').max(60),
    termType: z.enum(['TRIMESTER', 'SEMESTER']),
    orderIndex: z.number().int().min(1).max(6),
    startDate: z.string().min(10, 'Date de début requise.'),
    endDate: z.string().min(10, 'Date de fin requise.'),
  })
  .refine((d) => d.startDate < d.endDate, {
    message: 'La date de fin doit être postérieure à la date de début.',
    path: ['endDate'],
  });

type TermFormValues = z.infer<typeof termFormSchema>;

function YearStatusLabel({ status }: { status: AcademicYearItem['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        Année active
      </span>
    );
  }
  if (status === 'CLOSED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        Clôturée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      Préparation
    </span>
  );
}

export function AcademicYearsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('academic_years:manage');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'CLOSED'>('ALL');
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYearItem | null>(null);

  const [termModalYear, setTermModalYear] = useState<AcademicYearItem | null>(null);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'close' | 'delete-term';
    year?: AcademicYearItem;
    term?: TermItem;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
  });

  const yearForm = useForm<YearFormValues>({
    resolver: zodResolver(yearFormSchema),
    defaultValues: {
      name: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      autoGeneratePeriods: 'TRIMESTER',
    },
  });

  const termForm = useForm<TermFormValues>({
    resolver: zodResolver(termFormSchema),
    defaultValues: {
      name: 'Trimestre 1',
      termType: 'TRIMESTER',
      orderIndex: 1,
      startDate: '',
      endDate: '',
    },
  });

  const openCreateYear = () => {
    setEditingYear(null);
    setFeedback(null);
    yearForm.reset({
      name: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      autoGeneratePeriods: 'TRIMESTER',
    });
    setYearModalOpen(true);
  };

  const openEditYear = (year: AcademicYearItem) => {
    setEditingYear(year);
    setFeedback(null);
    yearForm.reset({
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      autoGeneratePeriods: 'NONE',
    });
    setYearModalOpen(true);
  };

  const openAddTerm = (year: AcademicYearItem) => {
    setTermModalYear(year);
    setEditingTerm(null);
    const nextOrder = year.terms.length + 1;
    termForm.reset({
      name: `Trimestre ${nextOrder}`,
      termType: 'TRIMESTER',
      orderIndex: nextOrder,
      startDate: year.startDate,
      endDate: year.endDate,
    });
  };

  const openEditTerm = (year: AcademicYearItem, term: TermItem) => {
    setTermModalYear(year);
    setEditingTerm(term);
    termForm.reset({
      name: term.name,
      termType: term.termType,
      orderIndex: term.orderIndex,
      startDate: term.startDate,
      endDate: term.endDate,
    });
  };

  const saveYearMutation = useMutation({
    mutationFn: (values: YearFormValues) => {
      if (editingYear) {
        return apiFetch<AcademicYearItem>(`/academic-years/${editingYear.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: values.name,
            startDate: values.startDate,
            endDate: values.endDate,
          }),
        });
      }
      return apiFetch<AcademicYearItem>('/academic-years', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setYearModalOpen(false);
      setFeedback({
        type: 'success',
        text: editingYear ? 'Année scolaire mise à jour.' : 'Année scolaire créée.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      });
    },
  });

  const saveTermMutation = useMutation({
    mutationFn: (values: TermFormValues) => {
      if (editingTerm) {
        return apiFetch<TermItem>(`/academic-years/terms/${editingTerm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: values.name,
            startDate: values.startDate,
            endDate: values.endDate,
          }),
        });
      }
      return apiFetch<TermItem>(`/academic-years/${termModalYear!.id}/terms`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setTermModalYear(null);
      setEditingTerm(null);
      setFeedback({
        type: 'success',
        text: editingTerm ? 'Période scolaire mise à jour.' : 'Période scolaire ajoutée.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      });
    },
  });

  const setCurrentTermMutation = useMutation({
    mutationFn: (termId: number) =>
      apiFetch<TermItem>(`/academic-years/terms/${termId}/set-current`, {
        method: 'POST',
      }),
    onSuccess: (term) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setFeedback({
        type: 'success',
        text: `« ${term.name} » est désormais la période courante.`,
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Action refusée.',
      });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async () => {
      if (!confirmAction) return;
      if (confirmAction.type === 'activate' && confirmAction.year) {
        return apiFetch(`/academic-years/${confirmAction.year.id}/activate`, {
          method: 'POST',
        });
      }
      if (confirmAction.type === 'close' && confirmAction.year) {
        return apiFetch(`/academic-years/${confirmAction.year.id}/close`, {
          method: 'POST',
        });
      }
      if (confirmAction.type === 'delete-term' && confirmAction.term) {
        return apiFetch(`/academic-years/terms/${confirmAction.term.id}`, {
          method: 'DELETE',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      const type = confirmAction?.type;
      setConfirmAction(null);
      setFeedback({
        type: 'success',
        text:
          type === 'activate'
            ? 'Année scolaire activée.'
            : type === 'close'
            ? 'Année scolaire clôturée et archivée.'
            : 'Période supprimée.',
      });
    },
    onError: (err) => {
      setConfirmAction(null);
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Opération impossible.',
      });
    },
  });

  const filteredYears =
    yearsQuery.data?.items.filter((y) =>
      statusFilter === 'ALL' ? true : y.status === statusFilter
    ) ?? [];

  return (
    <AppLayout
      headerAction={
        canManage ? (
          <button
            type="button"
            onClick={openCreateYear}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Nouvelle année scolaire
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Années scolaires & Périodes
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Planifiez les exercices académiques, activez l’année en cours et découpez les trimestres ou semestres.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md shrink-0 self-start sm:self-auto">
            {(
              [
                { id: 'ALL', label: 'Toutes' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'DRAFT', label: 'En préparation' },
                { id: 'CLOSED', label: 'Clôturées' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
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

        {yearsQuery.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : yearsQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger les années scolaires."
            onRetry={() => yearsQuery.refetch()}
          />
        ) : filteredYears.length === 0 ? (
          <EmptyState
            title="Aucune année scolaire enregistrée"
            description="Créez votre première année scolaire (ex. 2026-2027) avec ses trimestres ou semestres pour démarrer les inscriptions."
            action={
              canManage ? (
                <button
                  type="button"
                  onClick={openCreateYear}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Créer une année scolaire
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredYears.map((year) => (
              <section
                key={year.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                        {year.name}
                      </h2>
                      <YearStatusLabel status={year.status} />
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
                      Du {year.startDate} au {year.endDate} · {year.terms.length} période(s)
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {year.status !== 'CLOSED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditYear(year)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddTerm(year)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Ajouter période
                          </button>
                        </>
                      )}

                      {year.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: 'activate', year })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap cursor-pointer"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          Activer l’année
                        </button>
                      )}

                      {year.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: 'close', year })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md whitespace-nowrap cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Clôturer l’année
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {year.terms.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-medium text-slate-500">
                          <th className="py-2.5 px-5">Ordre</th>
                          <th className="py-2.5 px-5">Période</th>
                          <th className="py-2.5 px-5">Dates</th>
                          <th className="py-2.5 px-5">État</th>
                          {canManage && year.status !== 'CLOSED' && (
                            <th className="py-2.5 px-5 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {year.terms.map((term) => (
                          <tr key={term.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-5 font-mono text-xs text-slate-500 tabular-nums">
                              #{term.orderIndex}
                            </td>
                            <td className="py-2.5 px-5 font-medium text-slate-900">
                              {term.name}
                            </td>
                            <td className="py-2.5 px-5 text-xs font-mono text-slate-600 tabular-nums">
                              {term.startDate} → {term.endDate}
                            </td>
                            <td className="py-2.5 px-5 text-xs">
                              {term.isCurrent ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Période en cours
                                </span>
                              ) : (
                                <span className="text-slate-500">Planifiée</span>
                              )}
                            </td>
                            {canManage && year.status !== 'CLOSED' && (
                              <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  {!term.isCurrent && (
                                    <button
                                      type="button"
                                      onClick={() => setCurrentTermMutation.mutate(term.id)}
                                      className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded cursor-pointer"
                                    >
                                      Activer période
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditTerm(year, term)}
                                    className="px-2 py-1 text-xs text-slate-700 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Supprimer ${term.name}`}
                                    onClick={() =>
                                      setConfirmAction({ type: 'delete-term', year, term })
                                    }
                                    className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-5 py-4 text-xs text-slate-500">
                    Aucune période configurée pour cette année scolaire.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {yearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingYear ? 'Modifier l’année scolaire' : 'Nouvelle année scolaire'}
              </h2>
              <button
                type="button"
                onClick={() => setYearModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={yearForm.handleSubmit((vals) => saveYearMutation.mutate(vals))}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Libellé de l’année (ex: 2026-2027)
                </label>
                <input
                  type="text"
                  {...yearForm.register('name')}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {yearForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-700">
                    {yearForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date de rentrée
                  </label>
                  <input
                    type="date"
                    {...yearForm.register('startDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    {...yearForm.register('endDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {yearForm.formState.errors.endDate && (
                <p className="text-xs text-red-700">
                  {yearForm.formState.errors.endDate.message}
                </p>
              )}

              {!editingYear && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Génération automatique des périodes
                  </label>
                  <select
                    {...yearForm.register('autoGeneratePeriods')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TRIMESTER">3 Trimestres automatiques</option>
                    <option value="SEMESTER">2 Semestres automatiques</option>
                    <option value="NONE">Aucune (configurer manuellement)</option>
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setYearModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveYearMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saveYearMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {termModalYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingTerm
                  ? `Modifier ${editingTerm.name}`
                  : `Ajouter une période (${termModalYear.name})`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTermModalYear(null);
                  setEditingTerm(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={termForm.handleSubmit((vals) => saveTermMutation.mutate(vals))}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nom de la période
                  </label>
                  <input
                    type="text"
                    {...termForm.register('name')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ordre
                  </label>
                  <input
                    type="number"
                    disabled={Boolean(editingTerm)}
                    {...termForm.register('orderIndex', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md disabled:bg-slate-100"
                  />
                </div>
              </div>

              {!editingTerm && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Type de période
                  </label>
                  <select
                    {...termForm.register('termType')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                  >
                    <option value="TRIMESTER">Trimestre</option>
                    <option value="SEMESTER">Semestre</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Début
                  </label>
                  <input
                    type="date"
                    {...termForm.register('startDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fin
                  </label>
                  <input
                    type="date"
                    {...termForm.register('endDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                </div>
              </div>
              {termForm.formState.errors.endDate && (
                <p className="text-xs text-red-700">
                  {termForm.formState.errors.endDate.message}
                </p>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTermModalYear(null);
                    setEditingTerm(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveTermMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saveTermMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={
          confirmAction?.type === 'activate'
            ? `Activer l’année ${confirmAction.year?.name} ?`
            : confirmAction?.type === 'close'
            ? `Clôturer définitivement ${confirmAction.year?.name} ?`
            : `Supprimer la période ${confirmAction?.term?.name} ?`
        }
        description={
          confirmAction?.type === 'activate'
            ? 'Cette année deviendra l’année scolaire courante. Toute autre année actuellement active sera automatiquement clôturée.'
            : confirmAction?.type === 'close'
            ? 'Une année clôturée est archivée en lecture seule afin de préserver l’historique scolaire et ne pourra plus être modifiée.'
            : 'Cette période sera retirée du calendrier de l’année scolaire.'
        }
        confirmLabel={
          confirmAction?.type === 'activate'
            ? 'Activer cette année'
            : confirmAction?.type === 'close'
            ? 'Clôturer définitivement'
            : 'Supprimer'
        }
        danger={confirmAction?.type !== 'activate'}
        isPending={lifecycleMutation.isPending}
        onConfirm={() => lifecycleMutation.mutate()}
        onCancel={() => setConfirmAction(null)}
      />
    </AppLayout>
  );
}
