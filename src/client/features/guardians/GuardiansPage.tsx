import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  FolderOpen,
  Link2,
  Plus,
  Search,
  Unlink,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { DetailDrawer } from '../../components/ui/DetailDrawer.tsx';
import {
  EmptyState,
  ErrorBanner,
  TableSkeleton,
} from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  GuardianItem,
  GuardianRelationship,
  PaginatedResponse,
  StudentItem,
} from '../../types/api.ts';

const guardianFormSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  phone: z.string().trim().min(5, 'Téléphone requis.').max(30),
  secondaryPhone: z.string().trim().max(30),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]),
  address: z.string().trim().max(240),
  profession: z.string().trim().max(100),
  initialStudentId: z.number().int().min(0),
  initialRelationship: z.enum(['FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER']),
});

const linkFormSchema = z.object({
  studentId: z.number().int().positive('Sélectionnez un élève.'),
  relationship: z.enum(['FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER']),
  isPrimaryContact: z.boolean(),
  hasLegalCustody: z.boolean(),
  canPickup: z.boolean(),
});

const RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  FATHER: 'Père',
  MOTHER: 'Mère',
  LEGAL_GUARDIAN: 'Tuteur légal',
  OTHER: 'Autre responsable',
};

export function GuardiansPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canWrite = hasPermission('guardians:write');
  const canReadStudents = hasPermission('students:read');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<GuardianItem | null>(null);
  const [drawerGuardianId, setDrawerGuardianId] = useState<number | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  const params = new URLSearchParams({
    page: String(page),
    limit: '15',
  });
  if (search.trim()) params.set('search', search.trim());

  const guardiansQuery = useQuery({
    queryKey: ['guardians', page, search],
    queryFn: () => apiFetch<PaginatedResponse<GuardianItem>>(`/guardians?${params.toString()}`),
  });

  const drawerGuardianQuery = useQuery({
    queryKey: ['guardian-detail', drawerGuardianId],
    queryFn: () => apiFetch<GuardianItem>(`/guardians/${drawerGuardianId}`),
    enabled: Boolean(drawerGuardianId),
  });

  const studentsLookupQuery = useQuery({
    queryKey: ['students-lookup-guardians'],
    queryFn: () => apiFetch<PaginatedResponse<StudentItem>>('/students?limit=100'),
    enabled: canReadStudents && (modalOpen || showLinkForm),
  });

  const form = useForm<z.infer<typeof guardianFormSchema>>({
    resolver: zodResolver(guardianFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      secondaryPhone: '',
      email: '',
      address: '',
      profession: '',
      initialStudentId: 0,
      initialRelationship: 'LEGAL_GUARDIAN',
    },
  });

  const linkForm = useForm<z.infer<typeof linkFormSchema>>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      studentId: 0,
      relationship: 'LEGAL_GUARDIAN',
      isPrimaryContact: true,
      hasLegalCustody: true,
      canPickup: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (vals: z.infer<typeof guardianFormSchema>) => {
      if (editingGuardian) {
        return apiFetch<GuardianItem>(`/guardians/${editingGuardian.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: vals.firstName,
            lastName: vals.lastName,
            phone: vals.phone,
            secondaryPhone: vals.secondaryPhone,
            email: vals.email,
            address: vals.address,
            profession: vals.profession,
          }),
        });
      }
      const payload: Record<string, unknown> = {
        firstName: vals.firstName,
        lastName: vals.lastName,
        phone: vals.phone,
        secondaryPhone: vals.secondaryPhone,
        email: vals.email,
        address: vals.address,
        profession: vals.profession,
      };
      if (vals.initialStudentId > 0) {
        payload.initialStudentLink = {
          studentId: vals.initialStudentId,
          relationship: vals.initialRelationship,
          isPrimaryContact: true,
          hasLegalCustody: true,
          canPickup: true,
        };
      }
      return apiFetch<GuardianItem>('/guardians', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-detail', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier'] });
      setModalOpen(false);
      toast.success(
        editingGuardian
          ? `Fiche de ${saved.firstName} ${saved.lastName} mise à jour.`
          : `Responsable légal ${saved.firstName} ${saved.lastName} créé.`
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.');
    },
  });

  const linkStudentMutation = useMutation({
    mutationFn: (vals: z.infer<typeof linkFormSchema>) =>
      apiFetch<GuardianItem>(`/guardians/${drawerGuardianId}/students`, {
        method: 'POST',
        body: JSON.stringify(vals),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-detail', drawerGuardianId] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier'] });
      setShowLinkForm(false);
      toast.success('Élève rattaché au responsable légal.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Association refusée.');
    },
  });

  const unlinkStudentMutation = useMutation({
    mutationFn: (studentId: number) =>
      apiFetch<GuardianItem>(`/guardians/${drawerGuardianId}/students/${studentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardians'] });
      queryClient.invalidateQueries({ queryKey: ['guardian-detail', drawerGuardianId] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier'] });
      toast.success('Lien parent-élève retiré.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Suppression impossible.');
    },
  });

  const openCreate = () => {
    setEditingGuardian(null);
    form.reset({
      firstName: '',
      lastName: '',
      phone: '',
      secondaryPhone: '',
      email: '',
      address: '',
      profession: '',
      initialStudentId: 0,
      initialRelationship: 'LEGAL_GUARDIAN',
    });
    setModalOpen(true);
  };

  const openEdit = (g: GuardianItem) => {
    setEditingGuardian(g);
    form.reset({
      firstName: g.firstName,
      lastName: g.lastName,
      phone: g.phone,
      secondaryPhone: g.secondaryPhone,
      email: g.email,
      address: g.address,
      profession: g.profession,
      initialStudentId: 0,
      initialRelationship: 'LEGAL_GUARDIAN',
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
            Nouveau responsable
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Parents & Responsables légaux
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Centralisez les coordonnées des familles, contacts d’urgence, autorisations parentales et rattachements multi-enfants.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom, prénom, téléphone ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
        </div>

        {guardiansQuery.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : guardiansQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger les parents et responsables légaux."
            onRetry={() => guardiansQuery.refetch()}
          />
        ) : guardiansQuery.data && guardiansQuery.data.items.length === 0 ? (
          <EmptyState
            title="Aucun responsable légal enregistré"
            description="Ajoutez les parents ou tuteurs et rattachez-les à un ou plusieurs élèves."
            action={
              canWrite ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Ajouter un parent / tuteur
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
                    <th className="py-3 px-4">Responsable légal</th>
                    <th className="py-3 px-4">Coordonnées</th>
                    <th className="py-3 px-4">Élèves rattachés</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {guardiansQuery.data?.items.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => {
                        setShowLinkForm(false);
                        setDrawerGuardianId(g.id);
                      }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {g.lastName} {g.firstName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {g.profession || 'Responsable légal'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">{g.phone}</p>
                        <p className="text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {g.email || g.secondaryPhone || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                        {g.students.length === 0 ? (
                          <span className="text-slate-400">Aucun élève lié</span>
                        ) : (
                          <span>
                            {g.students
                              .map(
                                (s) =>
                                  `${s.firstName} ${s.lastName}${
                                    s.currentClassName ? ` (${s.currentClassName})` : ''
                                  }`
                              )
                              .join(' · ')}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowLinkForm(false);
                              setDrawerGuardianId(g.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Enfants ({g.students.length})
                          </button>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => openEdit(g)}
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

            {guardiansQuery.data && guardiansQuery.data.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {guardiansQuery.data.pagination.total} responsable(s) · Page{' '}
                  {guardiansQuery.data.pagination.page} /{' '}
                  {guardiansQuery.data.pagination.totalPages}
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
                    disabled={page >= guardiansQuery.data.pagination.totalPages}
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

      {/* Panneau latéral Fiche Parent & Enfants rattachés */}
      <DetailDrawer
        open={Boolean(drawerGuardianId)}
        onClose={() => {
          setDrawerGuardianId(null);
          setShowLinkForm(false);
        }}
        title={
          drawerGuardianQuery.data
            ? `${drawerGuardianQuery.data.lastName} ${drawerGuardianQuery.data.firstName}`
            : 'Fiche responsable légal'
        }
        subtitle={
          drawerGuardianQuery.data
            ? `${drawerGuardianQuery.data.phone}${
                drawerGuardianQuery.data.profession
                  ? ` · ${drawerGuardianQuery.data.profession}`
                  : ''
              }`
            : 'Chargement...'
        }
        footer={
          drawerGuardianQuery.data && canWrite ? (
            <button
              type="button"
              onClick={() => openEdit(drawerGuardianQuery.data!)}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
            >
              Modifier les coordonnées
            </button>
          ) : undefined
        }
      >
        {drawerGuardianQuery.isLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : drawerGuardianQuery.data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-xs pb-5 border-b border-slate-200 dark:border-slate-700/80">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Téléphone principal</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {drawerGuardianQuery.data.phone}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Téléphone secondaire</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {drawerGuardianQuery.data.secondaryPhone || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">E-mail</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {drawerGuardianQuery.data.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Profession</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {drawerGuardianQuery.data.profession || '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400 block">Adresse</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {drawerGuardianQuery.data.address || '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Élèves rattachés ({drawerGuardianQuery.data.students.length})
                </h3>
                {canWrite && canReadStudents && (
                  <button
                    type="button"
                    onClick={() => {
                      linkForm.reset({
                        studentId: 0,
                        relationship: 'LEGAL_GUARDIAN',
                        isPrimaryContact: true,
                        hasLegalCustody: true,
                        canPickup: true,
                      });
                      setShowLinkForm(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Associer un élève
                  </button>
                )}
              </div>

              {showLinkForm && (
                <form
                  onSubmit={linkForm.handleSubmit((vals) => linkStudentMutation.mutate(vals))}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Élève
                      </label>
                      <select
                        {...linkForm.register('studentId', { valueAsNumber: true })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                      >
                        <option value={0}>Choisir un élève...</option>
                        {studentsLookupQuery.data?.items.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.lastName} {st.firstName} ({st.matricule})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Lien de parenté
                      </label>
                      <select
                        {...linkForm.register('relationship')}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                      >
                        <option value="MOTHER">Mère</option>
                        <option value="FATHER">Père</option>
                        <option value="LEGAL_GUARDIAN">Tuteur légal</option>
                        <option value="OTHER">Autre responsable</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" {...linkForm.register('isPrimaryContact')} />
                      <span>Contact principal</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" {...linkForm.register('hasLegalCustody')} />
                      <span>Autorité parentale</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" {...linkForm.register('canPickup')} />
                      <span>Autorisé à récupérer</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLinkForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={linkStudentMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded cursor-pointer"
                    >
                      Valider le lien
                    </button>
                  </div>
                </form>
              )}

              {drawerGuardianQuery.data.students.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 border border-dashed border-slate-200 dark:border-slate-700/80 rounded text-center">
                  Aucun élève rattaché pour le moment.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
                  {drawerGuardianQuery.data.students.map((st) => (
                    <div
                      key={st.studentId}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {st.lastName} {st.firstName}{' '}
                          <span className="font-mono font-normal text-slate-500 dark:text-slate-400">
                            ({st.matricule})
                          </span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {RELATIONSHIP_LABELS[st.relationship]} ·{' '}
                          {st.currentClassName ?? 'Non affecté'}
                          {st.isPrimaryContact ? ' · Contact principal' : ''}
                        </p>
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          disabled={unlinkStudentMutation.isPending}
                          onClick={() => unlinkStudentMutation.mutate(st.studentId)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded cursor-pointer shrink-0"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          Dissocier
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DetailDrawer>

      {/* Modal Parent */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingGuardian
                  ? `Modifier ${editingGuardian.firstName} ${editingGuardian.lastName}`
                  : 'Nouveau responsable légal'}
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
                    Téléphone principal *
                  </label>
                  <input
                    type="tel"
                    {...form.register('phone')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {form.formState.errors.phone && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone secondaire
                  </label>
                  <input
                    type="tel"
                    {...form.register('secondaryPhone')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    {...form.register('email')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Profession
                  </label>
                  <input
                    type="text"
                    {...form.register('profession')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
                <input
                  type="text"
                  {...form.register('address')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>

              {!editingGuardian && canReadStudents && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md space-y-3">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Associer directement un élève (optionnel)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      {...form.register('initialStudentId', { valueAsNumber: true })}
                      className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                    >
                      <option value={0}>Aucun pour l’instant</option>
                      {studentsLookupQuery.data?.items.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.lastName} {st.firstName} ({st.matricule})
                        </option>
                      ))}
                    </select>
                    <select
                      {...form.register('initialRelationship')}
                      className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                    >
                      <option value="MOTHER">Mère</option>
                      <option value="FATHER">Père</option>
                      <option value="LEGAL_GUARDIAN">Tuteur légal</option>
                      <option value="OTHER">Autre responsable</option>
                    </select>
                  </div>
                </div>
              )}

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
