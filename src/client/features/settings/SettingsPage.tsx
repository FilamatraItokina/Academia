import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { ErrorBanner, TableSkeleton } from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { SchoolSettings } from '../../types/api.ts';

const settingsFormSchema = z.object({
  schoolName: z.string().trim().min(2, 'Nom de l’établissement requis.').max(140),
  schoolType: z.enum(['COLLEGE', 'LYCEE', 'LYCEE_COLLEGE']),
  academicSystem: z.enum(['TRIMESTER', 'SEMESTER']),
  gradingScale: z.number().int().min(10).max(100),
  currency: z.string().trim().min(3).max(6),
  address: z.string().trim().max(250),
  phone: z.string().trim().max(40),
  email: z.union([z.string().trim().email('Adresse e-mail invalide.'), z.literal('')]),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

interface OpenApiResponse {
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary?: string; tags?: string[] }>>;
}

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('settings:manage');

  const [activeTab, setActiveTab] = useState<'general' | 'openapi'>('general');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SchoolSettings>('/settings'),
  });

  const openApiQuery = useQuery({
    queryKey: ['openapi-spec'],
    queryFn: () => apiFetch<OpenApiResponse>('/docs/openapi.json'),
    enabled: activeTab === 'openapi',
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      schoolName: 'Lycée Académia',
      schoolType: 'LYCEE_COLLEGE',
      academicSystem: 'TRIMESTER',
      gradingScale: 20,
      currency: 'EUR',
      address: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset({
        schoolName: settingsQuery.data.schoolName,
        schoolType: settingsQuery.data.schoolType,
        academicSystem: settingsQuery.data.academicSystem,
        gradingScale: settingsQuery.data.gradingScale,
        currency: settingsQuery.data.currency,
        address: settingsQuery.data.address,
        phone: settingsQuery.data.phone,
        email: settingsQuery.data.email,
      });
    }
  }, [settingsQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      apiFetch<SchoolSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setFeedback({
        type: 'success',
        text: 'Les paramètres de l’établissement ont été enregistrés.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.',
      });
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Paramètres de l’établissement</h1>
            <p className="mt-1 text-sm text-slate-600">
              Identité, découpage des périodes académiques, barème de notation et documentation API.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Configuration générale
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('openapi')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'openapi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Documentation API
            </button>
          </div>
        </div>

        {feedback && activeTab === 'general' && (
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

        {activeTab === 'general' ? (
          settingsQuery.isLoading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : settingsQuery.isError ? (
            <ErrorBanner
              message="Impossible de charger la configuration de l’établissement."
              onRetry={() => settingsQuery.refetch()}
            />
          ) : (
            <form
              onSubmit={form.handleSubmit((vals) => saveMutation.mutate(vals))}
              className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nom officiel de l’établissement
                  </label>
                  <input
                    type="text"
                    disabled={!canManage}
                    {...form.register('schoolName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.formState.errors.schoolName && (
                    <p className="mt-1 text-xs text-red-700">
                      {form.formState.errors.schoolName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Type d’établissement
                  </label>
                  <select
                    disabled={!canManage}
                    {...form.register('schoolType')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="COLLEGE">Collège</option>
                    <option value="LYCEE">Lycée</option>
                    <option value="LYCEE_COLLEGE">Collège & Lycée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Système de périodes scolaires
                  </label>
                  <select
                    disabled={!canManage}
                    {...form.register('academicSystem')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TRIMESTER">Trimestres (3 périodes / an)</option>
                    <option value="SEMESTER">Semestres (2 périodes / an)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Barème par défaut
                    </label>
                    <input
                      type="number"
                      disabled={!canManage}
                      {...form.register('gradingScale', { valueAsNumber: true })}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Devise (ISO)
                    </label>
                    <input
                      type="text"
                      disabled={!canManage}
                      {...form.register('currency')}
                      className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    E-mail administratif
                  </label>
                  <input
                    type="email"
                    disabled={!canManage}
                    {...form.register('email')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-700">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    disabled={!canManage}
                    {...form.register('phone')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Adresse postale
                  </label>
                  <input
                    type="text"
                    disabled={!canManage}
                    {...form.register('address')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {canManage && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                  </button>
                </div>
              )}
            </form>
          )
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <FileCode2 className="w-4 h-4 text-indigo-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Spécification OpenAPI 3.0 (/api/v1)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Endpoints REST actifs et schémas de sécurité Bearer JWT
                  </p>
                </div>
              </div>
              <a
                href="/api/v1/docs/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-indigo-600 hover:underline whitespace-nowrap shrink-0"
              >
                /api/v1/docs/openapi.json
              </a>
            </div>

            {openApiQuery.isLoading ? (
              <TableSkeleton rows={5} cols={3} />
            ) : openApiQuery.data ? (
              <div className="divide-y divide-slate-100">
                {Object.entries(openApiQuery.data.paths).map(([path, methods]) =>
                  Object.entries(methods).map(([method, meta]) => (
                    <div
                      key={`${method}-${path}`}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono font-semibold uppercase text-indigo-700 w-14 shrink-0">
                          {method}
                        </span>
                        <span className="text-xs font-mono text-slate-900 truncate">
                          /api/v1{path}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600">{meta.summary}</span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
