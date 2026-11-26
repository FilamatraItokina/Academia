import { useQuery } from '@tanstack/react-query';
import { Eye, Search, X } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { EmptyState, ErrorBanner, TableSkeleton } from '../../components/ui/States.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { AuditLogItem, PaginatedResponse } from '../../types/api.ts';

const AUDIT_ACTIONS = [
  'BOOTSTRAP_ADMIN_ASSIGNED',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'PROFILE_UPDATED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_STATUS_CHANGED',
  'ROLE_PERMISSIONS_UPDATED',
  'SETTINGS_UPDATED',
];

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: '20',
  });
  if (search.trim()) params.set('search', search.trim());
  if (actionFilter) params.set('action', actionFilter);

  const auditQuery = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter],
    queryFn: () => apiFetch<PaginatedResponse<AuditLogItem>>(`/audit-logs?${params.toString()}`),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Journal d’audit & sécurité</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Traçabilité des connexions, modifications de rôles, statuts de comptes et paramètres critiques.
            </p>
          </div>
          {auditQuery.data && (
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
              {auditQuery.data.pagination.total} événement(s)
            </span>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrer par acteur, action ou entité..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>
          <select
            aria-label="Filtrer par type d’action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Toutes les actions</option>
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {auditQuery.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : auditQuery.isError ? (
          <ErrorBanner
            message={
              auditQuery.error instanceof ApiClientError
                ? auditQuery.error.message
                : 'Impossible de charger le journal d’audit.'
            }
            onRetry={() => auditQuery.refetch()}
          />
        ) : auditQuery.data && auditQuery.data.items.length === 0 ? (
          <EmptyState
            title="Aucun événement d’audit"
            description="Les actions administratives et connexions apparaîtront ici automatiquement."
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4">Horodatage</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Acteur</th>
                    <th className="py-3 px-4">Cible</th>
                    <th className="py-3 px-4 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {auditQuery.data?.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono font-medium text-slate-900 dark:text-slate-100">
                        {item.action}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 font-mono">
                        {item.actorEmail ?? 'Système'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                        {item.entityType}
                        {item.entityId ? ` #${item.entityId}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspecter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {auditQuery.data && auditQuery.data.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  Page {auditQuery.data.pagination.page} / {auditQuery.data.pagination.totalPages}
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
                    disabled={page >= auditQuery.data.pagination.totalPages}
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

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <h3 className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100">
                {selectedLog.action}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Acteur :</span>{' '}
                {selectedLog.actorEmail ?? 'Système'}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Adresse IP :</span>{' '}
                <span className="font-mono">{selectedLog.ipAddress ?? 'Non renseignée'}</span>
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Horodatage :</span>{' '}
                <span className="font-mono">
                  {new Date(selectedLog.createdAt).toISOString()}
                </span>
              </p>
            </div>
            <pre className="mt-4 p-3 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono rounded-md overflow-x-auto">
              {JSON.stringify(selectedLog.details ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
