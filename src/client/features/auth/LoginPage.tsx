import { Building2, LogIn, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { ErrorBanner } from '../../components/ui/States.tsx';

export function LoginPage() {
  const { signInWithGoogle, loading, authError, firebaseUser, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [imageError, setImageError] = useState(false);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950">
      <div className="relative hidden lg:flex flex-col justify-between bg-slate-950 overflow-hidden">
        {!imageError ? (
          <img
            src="/src/assets/images/campus_architecture_courtyard_1795706846248.jpg"
            alt="Cour intérieure d’un établissement secondaire moderne"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex items-center justify-center">
            <Building2 className="w-24 h-24 text-slate-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/30" />

        <div className="relative z-10 p-10">
          <span className="text-xl font-bold tracking-tight text-white">Académia</span>
        </div>

        <div className="relative z-10 p-10 max-w-xl">
          <p className="text-xs font-medium text-indigo-300 tracking-wide">
            Système d’Information Scolaire · Collèges & Lycées
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white leading-tight [text-wrap:balance]">
            Pilotez la scolarité, la pédagogie et l’administration en un seul espace sécurisé.
          </h1>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Gestion des comptes multi-rôles, dossiers élèves historisés par année scolaire,
            suivi des présences, évaluations et comptabilité scolaire.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-slate-50 dark:bg-slate-950">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md transition-colors cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-slate-600" />
          )}
          <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-8">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Académia</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Accès sécurisé par contrôle de rôles</span>
            </div>

            <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
              Connexion à l’espace établissement
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Authentifiez-vous avec votre compte Google institutionnel ou personnel
              enregistré par l’administration.
            </p>

            {authError && (
              <div className="mt-6">
                <ErrorBanner message={authError} />
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                {loading ? 'Vérification en cours...' : 'Continuer avec Google'}
              </button>

              {firebaseUser && authError && (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  Changer de compte Google ({firebaseUser.email})
                </button>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
              <p>
                Premier démarrage : le premier compte connecté obtient automatiquement le rôle
                Administrateur afin d’initialiser l’établissement.
              </p>
              <p>
                Les autres comptes doivent être activés et dotés d’un rôle par l’administration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
