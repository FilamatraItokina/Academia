import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { ErrorBanner, TableSkeleton } from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { PermissionItem, RoleWithPermissions } from '../../types/api.ts';

export function RolesPage() {
  const { hasPermission, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('roles:manage');

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<{ items: RoleWithPermissions[] }>('/roles'),
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiFetch<{ items: PermissionItem[] }>('/roles/permissions'),
  });

  const selectedRole = useMemo(() => {
    const list = rolesQuery.data?.items ?? [];
    if (list.length === 0) return null;
    return list.find((r) => r.id === selectedRoleId) ?? list[0];
  }, [rolesQuery.data, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) {
      setDraftPerms(selectedRole.permissionCodes);
      setFeedback(null);
    }
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();
    for (const perm of permissionsQuery.data?.items ?? []) {
      const list = groups.get(perm.module) ?? [];
      list.push(perm);
      groups.set(perm.module, list);
    }
    return Array.from(groups.entries());
  }, [permissionsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;
      return apiFetch<{ roleId: number; permissionCodes: string[] }>(
        `/roles/${selectedRole.id}/permissions`,
        {
          method: 'PUT',
          body: JSON.stringify({ permissionCodes: draftPerms }),
        }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      await refreshProfile();
      setFeedback({
        type: 'success',
        text: `Les permissions du rôle ${selectedRole?.name} ont été enregistrées.`,
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de la sauvegarde.',
      });
    },
  });

  const togglePerm = (code: string) => {
    if (!canManage) return;
    setDraftPerms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const hasChanges =
    selectedRole != null &&
    (draftPerms.length !== selectedRole.permissionCodes.length ||
      draftPerms.some((p) => !selectedRole.permissionCodes.includes(p)));

  return (
    <AppLayout
      headerAction={
        canManage && selectedRole ? (
          <button
            type="button"
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer la matrice'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rôles & Matrice des permissions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configurez précisément les autorisations des 8 profils de l’établissement secondaire.
          </p>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {rolesQuery.isLoading || permissionsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : rolesQuery.isError || permissionsQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger les rôles ou la matrice des permissions."
            onRetry={() => {
              rolesQuery.refetch();
              permissionsQuery.refetch();
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {rolesQuery.data?.items.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{role.name}</span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {role.userCount} util.
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-xs line-clamp-2 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {role.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
              {selectedRole && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h2 className="text-base font-semibold text-slate-900">
                          {selectedRole.name}
                        </h2>
                        <span className="text-xs font-mono text-slate-500">
                          · {selectedRole.code}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{selectedRole.description}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
                      {draftPerms.length} permission(s)
                    </span>
                  </div>

                  <div className="mt-5 space-y-6">
                    {groupedPermissions.map(([moduleName, perms]) => (
                      <div key={moduleName}>
                        <h3 className="text-xs font-semibold text-slate-700 pb-2 border-b border-slate-100">
                          {moduleName}
                        </h3>
                        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {perms.map((perm) => {
                            const checked = draftPerms.includes(perm.code);
                            const isLockedAdminPerm =
                              selectedRole.code === 'ADMIN' && perm.code === 'roles:manage';

                            return (
                              <label
                                key={perm.code}
                                className={`flex items-start gap-2.5 p-3 border rounded-md text-xs transition-colors ${
                                  canManage && !isLockedAdminPerm
                                    ? 'cursor-pointer hover:bg-slate-50'
                                    : 'opacity-80 cursor-default'
                                } ${
                                  checked
                                    ? 'border-indigo-300 bg-indigo-50/40'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canManage || isLockedAdminPerm}
                                  onChange={() => togglePerm(perm.code)}
                                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="min-w-0">
                                  <div className="font-mono font-medium text-slate-900">
                                    {perm.code}
                                  </div>
                                  <div className="mt-0.5 text-slate-600 leading-snug">
                                    {perm.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
