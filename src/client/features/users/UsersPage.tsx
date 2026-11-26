import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  PaginatedResponse,
  RoleWithPermissions,
  UserProfile,
} from '../../types/api.ts';

const userFormSchema = z.object({
  email: z.string().trim().email('Adresse e-mail valide requise.'),
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  phone: z.string().trim().max(30).optional(),
  isActive: z.boolean(),
  roleCodes: z.array(z.string()).min(1, 'Sélectionnez au moins un rôle.'),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UsersPage() {
  const { profile: currentUser, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasPermission('users:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '15',
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (roleFilter) queryParams.set('roleCode', roleFilter);
  if (statusFilter !== 'all') queryParams.set('isActive', statusFilter);

  const usersQuery = useQuery({
    queryKey: ['users', page, search, roleFilter, statusFilter],
    queryFn: () => apiFetch<PaginatedResponse<UserProfile>>(`/users?${queryParams.toString()}`),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<{ items: RoleWithPermissions[] }>('/roles'),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      isActive: true,
      roleCodes: ['TEACHER'],
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFeedback(null);
    form.reset({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      isActive: true,
      roleCodes: ['TEACHER'],
    });
    setModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFeedback(null);
    form.reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      isActive: user.isActive,
      roleCodes: user.roles.map((r) => r.code),
    });
    setModalOpen(true);
  };

  const saveUserMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (editingUser) {
        return apiFetch<UserProfile>(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone || null,
            isActive: values.isActive,
            roleCodes: values.roleCodes,
          }),
        });
      }
      return apiFetch<UserProfile>('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || null,
          isActive: values.isActive,
          roleCodes: values.roleCodes,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-users-count'] });
      setModalOpen(false);
      setFeedback({
        type: 'success',
        text: editingUser
          ? 'Le compte utilisateur a été mis à jour.'
          : 'Le compte utilisateur a été créé.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (user: UserProfile) =>
      apiFetch<UserProfile>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setToggleTarget(null);
      setFeedback({
        type: 'success',
        text: updated.isActive
          ? `Le compte de ${updated.firstName} ${updated.lastName} est activé.`
          : `Le compte de ${updated.firstName} ${updated.lastName} est désactivé.`,
      });
    },
    onError: (err) => {
      setToggleTarget(null);
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Action refusée.',
      });
    },
  });

  const watchedRoles = form.watch('roleCodes');

  const toggleRoleInForm = (code: string) => {
    const current = form.getValues('roleCodes');
    if (current.includes(code)) {
      form.setValue(
        'roleCodes',
        current.filter((c) => c !== code),
        { shouldValidate: true }
      );
    } else {
      form.setValue('roleCodes', [...current, code], { shouldValidate: true });
    }
  };

  return (
    <AppLayout
      headerAction={
        canWrite ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Nouvel utilisateur
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Annuaire & Comptes utilisateurs
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Gérez les accès par rôle, pré-enregistrez le personnel et contrôlez l’activation des comptes.
            </p>
          </div>
          {usersQuery.data && (
            <p className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
              {usersQuery.data.pagination.total} compte(s) au total
            </p>
          )}
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

        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom, prénom ou adresse e-mail..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Filtrer par rôle"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les rôles</option>
              {rolesQuery.data?.items.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'true', label: 'Actifs' },
                  { id: 'false', label: 'Désactivés' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
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
        </div>

        {usersQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : usersQuery.isError ? (
          <ErrorBanner
            message={
              usersQuery.error instanceof ApiClientError
                ? usersQuery.error.message
                : 'Impossible de charger la liste des utilisateurs.'
            }
            onRetry={() => usersQuery.refetch()}
          />
        ) : usersQuery.data && usersQuery.data.items.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur trouvé"
            description="Modifiez vos filtres ou créez un nouveau compte utilisateur."
            action={
              canWrite ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Créer un utilisateur
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Rôles attribués</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Dernière connexion</th>
                    {canWrite && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {usersQuery.data?.items.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {user.email}
                          {user.phone ? ` · ${user.phone}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {user.roles.length > 0
                          ? user.roles.map((r) => r.name).join(' · ')
                          : 'Aucun rôle attribué'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator active={user.isActive} />
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Jamais connecté'}
                      </td>
                      {canWrite && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                            {currentUser?.id !== user.id && (
                              <button
                                type="button"
                                onClick={() => setToggleTarget(user)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded cursor-pointer ${
                                  user.isActive
                                    ? 'text-red-700 border-red-200 bg-white hover:bg-red-50'
                                    : 'text-emerald-700 border-emerald-200 bg-white hover:bg-emerald-50'
                                }`}
                              >
                                {user.isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    Désactiver
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Activer
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usersQuery.data && usersQuery.data.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono tabular-nums">
                  Page {usersQuery.data.pagination.page} / {usersQuery.data.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    disabled={page >= usersQuery.data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingUser ? 'Modifier le compte utilisateur' : 'Créer un compte utilisateur'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit((vals) => saveUserMutation.mutate(vals))}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adresse e-mail professionnelle ou scolaire
                </label>
                <input
                  type="email"
                  disabled={Boolean(editingUser)}
                  {...form.register('email')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-700">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    {...form.register('firstName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.formState.errors.firstName && (
                    <p className="mt-1 text-xs text-red-700">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    {...form.register('lastName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.formState.errors.lastName && (
                    <p className="mt-1 text-xs text-red-700">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Téléphone (optionnel)
                </label>
                <input
                  type="text"
                  {...form.register('phone')}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Rôles attribués
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {rolesQuery.data?.items.map((role) => {
                    const checked = watchedRoles.includes(role.code);
                    return (
                      <label
                        key={role.code}
                        className={`flex items-center gap-2.5 px-3 py-2 border rounded-md text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-indigo-600 bg-indigo-50/50 text-slate-900 font-medium'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoleInForm(role.code)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{role.name}</span>
                      </label>
                    );
                  })}
                </div>
                {form.formState.errors.roleCodes && (
                  <p className="mt-1 text-xs text-red-700">
                    {form.formState.errors.roleCodes.message}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register('isActive')}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Compte actif (autorisé à se connecter)</span>
              </label>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saveUserMutation.isPending
                    ? 'Enregistrement...'
                    : editingUser
                    ? 'Enregistrer'
                    : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(toggleTarget)}
        title={
          toggleTarget?.isActive
            ? 'Désactiver le compte utilisateur ?'
            : 'Réactiver le compte utilisateur ?'
        }
        description={
          toggleTarget?.isActive
            ? `${toggleTarget.firstName} ${toggleTarget.lastName} (${toggleTarget.email}) ne pourra plus accéder à la plateforme tant que le compte restera désactivé.`
            : `${toggleTarget?.firstName} ${toggleTarget?.lastName} retrouvera l’accès à ses espaces selon ses rôles attribués.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Désactiver le compte' : 'Activer le compte'}
        danger={Boolean(toggleTarget?.isActive)}
        isPending={toggleStatusMutation.isPending}
        onConfirm={() => toggleTarget && toggleStatusMutation.mutate(toggleTarget)}
        onCancel={() => setToggleTarget(null)}
      />
    </AppLayout>
  );
}
