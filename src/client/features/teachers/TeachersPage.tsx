import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, FolderOpen, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { DetailDrawer } from '../../components/ui/DetailDrawer.tsx';
import {
  EmptyState,
  ErrorBanner,
  StatusIndicator,
  TableSkeleton,
} from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { ContractType, PaginatedResponse, TeacherItem } from '../../types/api.ts';

const teacherFormSchema = z.object({
  employeeCode: z.string().trim().max(40),
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  email: z.string().trim().email('E-mail valide requis.'),
  phone: z.string().trim().max(30),
  specialty: z.string().trim().min(2, 'Spécialité requise.').max(100),
  qualification: z.string().trim().max(100),
  contractType: z.enum(['PERMANENT', 'CONTRACT', 'PART_TIME']),
  hireDate: z.string(),
  isActive: z.boolean(),
});

const CONTRACT_LABELS: Record<ContractType, string> = {
  PERMANENT: 'Titulaire',
  CONTRACT: 'Contractuel',
  PART_TIME: 'Vacataire',
};

export function TeachersPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = hasPermission('teachers:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [drawerTeacher, setDrawerTeacher] = useState<TeacherItem | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: '15',
  });
  if (search.trim()) params.set('search', search.trim());
  if (specialtyFilter.trim()) params.set('specialty', specialtyFilter.trim());
  if (statusFilter !== 'all') params.set('isActive', statusFilter);

  const teachersQuery = useQuery({
    queryKey: ['teachers', page, search, specialtyFilter, statusFilter],
    queryFn: () => apiFetch<PaginatedResponse<TeacherItem>>(`/teachers?${params.toString()}`),
  });

  // Deep link (?teacherId=...)
  const paramTeacherId = Number(searchParams.get('teacherId'));
  const deepLinkedTeacherQuery = useQuery({
    queryKey: ['teacher-detail', paramTeacherId],
    queryFn: () => apiFetch<TeacherItem>(`/teachers/${paramTeacherId}`),
    enabled: Number.isInteger(paramTeacherId) && paramTeacherId > 0,
  });

  useEffect(() => {
    if (deepLinkedTeacherQuery.data) {
      setDrawerTeacher(deepLinkedTeacherQuery.data);
      setSearchParams({}, { replace: true });
    }
  }, [deepLinkedTeacherQuery.data, setSearchParams]);

  const form = useForm<z.infer<typeof teacherFormSchema>>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialty: '',
      qualification: '',
      contractType: 'PERMANENT',
      hireDate: '',
      isActive: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (vals: z.infer<typeof teacherFormSchema>) => {
      const payload = {
        ...vals,
        employeeCode: vals.employeeCode.trim() || undefined,
        hireDate: vals.hireDate.trim() || null,
      };
      if (editingTeacher) {
        return apiFetch<TeacherItem>(`/teachers/${editingTeacher.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<TeacherItem>('/teachers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      if (drawerTeacher?.id === saved.id) setDrawerTeacher(saved);
      setModalOpen(false);
      toast.success(
        editingTeacher
          ? `Fiche de ${saved.firstName} ${saved.lastName} mise à jour.`
          : `Enseignant ${saved.firstName} ${saved.lastName} enregistré (${saved.employeeCode}).`
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.');
    },
  });

  const openCreate = () => {
    setEditingTeacher(null);
    form.reset({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialty: '',
      qualification: '',
      contractType: 'PERMANENT',
      hireDate: new Date().toISOString().slice(0, 10),
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (t: TeacherItem) => {
    setEditingTeacher(t);
    form.reset({
      employeeCode: t.employeeCode,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      specialty: t.specialty,
      qualification: t.qualification,
      contractType: t.contractType,
      hireDate: t.hireDate ?? '',
      isActive: t.isActive,
    });
    setModalOpen(true);
  };

  return (
    <AppLayout
      headerAction={
        canWrite ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Nouvel enseignant
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Corps enseignant</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Répertoire des professeurs, spécialités disciplinaires, types de contrats et coordonnées professionnelles.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par code (ENS-...), nom, prénom ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <input
            type="text"
            value={specialtyFilter}
            onChange={(e) => {
              setSpecialtyFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filtrer par spécialité..."
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md md:w-56"
          />

          <select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
          >
            <option value="all">Tous les statuts</option>
            <option value="true">Actifs uniquement</option>
            <option value="false">Désactivés</option>
          </select>
        </div>

        {teachersQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : teachersQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger la liste des enseignants."
            onRetry={() => teachersQuery.refetch()}
          />
        ) : teachersQuery.data && teachersQuery.data.items.length === 0 ? (
          <EmptyState
            title="Aucun enseignant enregistré"
            description="Ajoutez les membres du corps enseignant afin de préparer l’attribution des matières et emplois du temps."
            action={
              canWrite ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Ajouter un enseignant
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
                    <th className="py-3 px-4">Enseignant</th>
                    <th className="py-3 px-4">Matricule</th>
                    <th className="py-3 px-4">Spécialité</th>
                    <th className="py-3 px-4">Contrat</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {teachersQuery.data?.items.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setDrawerTeacher(t)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold shrink-0">
                            {t.firstName[0]}
                            {t.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {t.lastName} {t.firstName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {t.employeeCode}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{t.specialty}</p>
                        {t.qualification && (
                          <p className="text-slate-500 dark:text-slate-400">{t.qualification}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {CONTRACT_LABELS[t.contractType]}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusIndicator active={t.isActive} />
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerTeacher(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Fiche
                          </button>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {teachersQuery.data && teachersQuery.data.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {teachersQuery.data.pagination.total} enseignant(s) · Page{' '}
                  {teachersQuery.data.pagination.page} /{' '}
                  {teachersQuery.data.pagination.totalPages}
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
                    disabled={page >= teachersQuery.data.pagination.totalPages}
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
      </div>

      {/* Panneau latéral Fiche Enseignant */}
      <DetailDrawer
        open={Boolean(drawerTeacher)}
        onClose={() => setDrawerTeacher(null)}
        title={
          drawerTeacher
            ? `${drawerTeacher.lastName} ${drawerTeacher.firstName}`
            : 'Fiche enseignant'
        }
        subtitle={
          drawerTeacher
            ? `${drawerTeacher.employeeCode} · ${drawerTeacher.specialty}`
            : undefined
        }
        footer={
          drawerTeacher && canWrite ? (
            <button
              type="button"
              onClick={() => openEdit(drawerTeacher)}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
            >
              Modifier la fiche
            </button>
          ) : undefined
        }
      >
        {drawerTeacher && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-xs pb-5 border-b border-slate-200 dark:border-slate-700/80">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">E-mail professionnel</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{drawerTeacher.email}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Téléphone</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {drawerTeacher.phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Spécialité</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{drawerTeacher.specialty}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Qualification / Grade</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {drawerTeacher.qualification || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Type de contrat</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {CONTRACT_LABELS[drawerTeacher.contractType]}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Date d’embauche</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {drawerTeacher.hireDate || '—'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Matières & Classes attribuées
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Consultez et gérez les affectations par matière et par classe depuis la page Matières & Programmes.
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Modal Enseignant */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingTeacher
                  ? `Modifier ${editingTeacher.firstName} ${editingTeacher.lastName}`
                  : 'Nouvel enseignant'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit((vals) => saveMutation.mutate(vals))}
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Prénom *</label>
                  <input
                    type="text"
                    {...form.register('firstName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {form.formState.errors.firstName && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
                  <input
                    type="text"
                    {...form.register('lastName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {form.formState.errors.lastName && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-mail professionnel *
                  </label>
                  <input
                    type="email"
                    {...form.register('email')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    {...form.register('phone')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Spécialité principale *
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Mathématiques, Lettres modernes"
                    {...form.register('specialty')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {form.formState.errors.specialty && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {form.formState.errors.specialty.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Qualification / Grade
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Agrégé, Certifié CAPES"
                    {...form.register('qualification')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Matricule interne
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingTeacher)}
                    placeholder="Auto (ENS-...)"
                    {...form.register('employeeCode')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Contrat</label>
                  <select
                    {...form.register('contractType')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="PERMANENT">Titulaire</option>
                    <option value="CONTRACT">Contractuel</option>
                    <option value="PART_TIME">Vacataire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date d’embauche
                  </label>
                  <input
                    type="date"
                    {...form.register('hireDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  {...form.register('isActive')}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                />
                <span>Enseignant actuellement en exercice dans l’établissement</span>
              </label>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
