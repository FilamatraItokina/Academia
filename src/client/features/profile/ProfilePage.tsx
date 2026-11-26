import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Moon, Save, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type { UserProfile } from '../../types/api.ts';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  phone: z.string().trim().max(30).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      phone: profile?.phone ?? '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? '',
      });
    }
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      apiFetch<{ user: UserProfile }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || null,
        }),
      }),
    onSuccess: async () => {
      await refreshProfile();
      setFeedback({ type: 'success', text: 'Votre profil a été mis à jour.' });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Erreur lors de la mise à jour.',
      });
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mon profil</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Informations personnelles, préférences d’affichage, rôles attribués et périmètre d’autorisations.
          </p>
        </div>

        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg border text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form
          onSubmit={form.handleSubmit((vals) => mutation.mutate(vals))}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5"
        >
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Adresse e-mail liée au compte</p>
            <p className="mt-0.5 text-sm font-mono text-slate-900 dark:text-slate-100">{profile?.email}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Prénom
              </label>
              <input
                type="text"
                {...form.register('firstName')}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {form.formState.errors.firstName && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nom
              </label>
              <input
                type="text"
                {...form.register('lastName')}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {form.formState.errors.lastName && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Téléphone
            </label>
            <input
              type="text"
              {...form.register('phone')}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4 shrink-0" />
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Apparence</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Choisissez le thème d’affichage appliqué sur l’ensemble de l’application.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Sun className="w-4 h-4 shrink-0" />
              Mode clair
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Moon className="w-4 h-4 shrink-0" />
              Mode sombre
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Rôles & Permissions actives</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Rôles attribués : {profile?.roles.map((r) => r.name).join(' · ') || 'Aucun'}
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {profile?.permissions.map((perm) => (
              <div
                key={perm}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/60"
              >
                {perm}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
