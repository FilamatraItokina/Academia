import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Phone,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../../../lib/firebase.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  AttendanceStatus,
  ClassItem,
  ClassRollStudentItem,
  DailyAbsenteeItem,
  DailyAttendanceSummary,
} from '../../types/api.ts';
import { DetailDrawer } from '../../components/ui/DetailDrawer.tsx';
import { ErrorBanner, TableSkeleton } from '../../components/ui/States.tsx';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_BUTTONS: Array<{
  value: AttendanceStatus;
  label: string;
  activeClass: string;
}> = [
  {
    value: 'PRESENT',
    label: 'Présent',
    activeClass: 'bg-emerald-700 text-white border-emerald-700',
  },
  {
    value: 'ABSENT',
    label: 'Absent',
    activeClass: 'bg-red-700 text-white border-red-700',
  },
  {
    value: 'LATE',
    label: 'Retard',
    activeClass: 'bg-amber-600 text-white border-amber-600',
  },
  {
    value: 'EXCUSED',
    label: 'Justifié',
    activeClass: 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-600',
  },
];

export function DailyAttendanceModule({ classes }: { classes: ClassItem[] }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const canRead = hasPermission('attendance:read') && hasPermission('students:read');
  const canWrite = hasPermission('attendance:write') && hasPermission('students:read');

  const [selectedDate, setSelectedDate] = useState(getTodayDateString);
  const [classFilter, setClassFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unjustified' | 'justified'>('all');
  const [streamConnected, setStreamConnected] = useState(false);

  // Roll call drawer state
  const [rollDrawerOpen, setRollDrawerOpen] = useState(false);
  const [rollClassId, setRollClassId] = useState<number>(0);
  const [rollDraft, setRollDraft] = useState<
    Record<number, { status: AttendanceStatus; reason: string }>
  >({});

  // Justify inline modal/prompt state
  const [justifyTarget, setJustifyTarget] = useState<DailyAbsenteeItem | null>(null);
  const [justifyReason, setJustifyReason] = useState('');

  const summaryParams = new URLSearchParams({ date: selectedDate });
  if (classFilter) summaryParams.set('classId', classFilter);

  const summaryQuery = useQuery({
    queryKey: ['attendance-daily', selectedDate, classFilter],
    queryFn: () =>
      apiFetch<DailyAttendanceSummary>(`/attendance/daily-summary?${summaryParams.toString()}`),
    enabled: canRead,
    refetchInterval: 30_000,
  });

  // Real-time Server-Sent Events (SSE) subscription with authenticated fetch stream
  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    const controller = new AbortController();

    async function connectStream() {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/v1/attendance/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          setStreamConnected(false);
          return;
        }
        setStreamConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(5).trim()) as { type?: string };
              if (payload.type === 'attendance:updated') {
                queryClient.invalidateQueries({ queryKey: ['attendance-daily'] });
                queryClient.invalidateQueries({ queryKey: ['attendance-roll'] });
              }
            } catch {
              // Ignore malformed heartbeat frames
            }
          }
        }
      } catch {
        if (!cancelled) setStreamConnected(false);
      }
    }

    connectStream();
    return () => {
      cancelled = true;
      setStreamConnected(false);
      controller.abort();
    };
  }, [canRead, queryClient]);

  // Roll call query when drawer opens
  const openClasses = classes.filter((c) => !c.isArchived && c.academicYearStatus !== 'CLOSED');
  useEffect(() => {
    if (rollDrawerOpen && rollClassId === 0 && openClasses.length > 0) {
      setRollClassId(openClasses[0].id);
    }
  }, [rollDrawerOpen, rollClassId, openClasses]);

  const rollQuery = useQuery({
    queryKey: ['attendance-roll', rollClassId, selectedDate],
    queryFn: () =>
      apiFetch<{
        classId: number;
        className: string;
        date: string;
        students: ClassRollStudentItem[];
      }>(`/attendance/class-roll?classId=${rollClassId}&date=${selectedDate}`),
    enabled: rollDrawerOpen && rollClassId > 0 && canRead,
  });

  useEffect(() => {
    if (!rollQuery.data) return;
    const initial: Record<number, { status: AttendanceStatus; reason: string }> = {};
    for (const st of rollQuery.data.students) {
      initial[st.studentId] = {
        status: st.status ?? 'PRESENT',
        reason: st.reason ?? '',
      };
    }
    setRollDraft(initial);
  }, [rollQuery.data]);

  const saveRollMutation = useMutation({
    mutationFn: () => {
      const studentsList = rollQuery.data?.students ?? [];
      const entries = studentsList.map((st) => {
        const draft = rollDraft[st.studentId] ?? { status: 'PRESENT', reason: '' };
        return {
          studentId: st.studentId,
          status: draft.status,
          reason: draft.reason,
          isJustified: draft.status === 'EXCUSED',
        };
      });
      return apiFetch<{ savedCount: number }>('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({
          classId: rollClassId,
          date: selectedDate,
          entries,
        }),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-daily'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-roll'] });
      setRollDrawerOpen(false);
      toast.success(`Appel enregistré pour ${res.savedCount} élève(s).`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de l’enregistrement.');
    },
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: ({
      attendanceId,
      status,
      isJustified,
      reason,
    }: {
      attendanceId: number;
      status: AttendanceStatus;
      isJustified: boolean;
      reason?: string;
    }) =>
      apiFetch(`/attendance/${attendanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, isJustified, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-daily'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-roll'] });
      setJustifyTarget(null);
      setJustifyReason('');
      toast.success('Statut d’absence mis à jour en temps réel.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Mise à jour refusée.');
    },
  });

  if (!canRead) {
    return null;
  }

  const summary = summaryQuery.data;
  const allAbsentees = summary?.absentees ?? [];
  const filteredAbsentees = allAbsentees.filter((item) => {
    if (statusFilter === 'unjustified') return !item.isJustified && item.status === 'ABSENT';
    if (statusFilter === 'justified') return item.isJustified || item.status === 'EXCUSED';
    return true;
  });

  const rate = summary?.absenteeismRate ?? 0;
  const rateColor =
    rate >= 10
      ? 'text-red-700 dark:text-red-400'
      : rate >= 5
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <section
      aria-label="Suivi temps réel de l’absentéisme"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden"
    >
      {/* En-tête du module */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Absentéisme & Absents du jour
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Radio
                className={`w-3.5 h-3.5 ${
                  streamConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              />
              {streamConnected ? 'Temps réel actif' : 'Actualisation auto'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary
              ? `${summary.recordedCount} appel(s) saisi(s) sur ${summary.totalEnrolledStudents} élève(s) · Dernière synchro ${new Date(
                  summary.lastUpdatedAt
                ).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : 'Chargement du relevé journalier...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Date du suivi d’absentéisme"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-700 dark:text-slate-300"
          />

          <select
            aria-label="Filtrer les absents par classe"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-700 dark:text-slate-300"
          >
            <option value="">Toutes les classes</option>
            {openClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => summaryQuery.refetch()}
            aria-label="Actualiser les présences"
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${summaryQuery.isFetching ? 'animate-spin' : ''}`}
            />
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={() => setRollDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Saisir l’appel
            </button>
          )}
        </div>
      </div>

      {/* Bandeau d'indicateurs temps réel (séparés par hairline, sans cartes imbriquées) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30">
        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Taux d’absentéisme</p>
          <p className={`mt-1 text-2xl font-bold font-mono tabular-nums ${rateColor}`}>
            {summaryQuery.isLoading ? '—' : `${rate.toFixed(1)} %`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {rate >= 10
              ? 'Seuil d’alerte dépassé'
              : rate >= 5
                ? 'Vigilance modérée'
                : 'Niveau nominal'}
          </p>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Absents du jour</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {summaryQuery.isLoading ? '—' : summary?.absentCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary?.unjustifiedAbsentCount ?? 0} non justifié(s) ·{' '}
            {summary?.excusedCount ?? 0} justifié(s)
          </p>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Présents pointés</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {summaryQuery.isLoading ? '—' : summary?.presentCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            sur {summary?.totalEnrolledStudents ?? 0} élève(s) inscrit(s)
          </p>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Retards signalés</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {summaryQuery.isLoading ? '—' : summary?.lateCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Arrivées tardives enregistrées</p>
        </div>
      </div>

      {/* Barre de filtre de la liste des absents */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Liste nominative des absents ({filteredAbsentees.length})
        </span>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
          {(
            [
              { id: 'all', label: `Tous (${allAbsentees.length})` },
              {
                id: 'unjustified',
                label: `Non justifiés (${summary?.unjustifiedAbsentCount ?? 0})`,
              },
              { id: 'justified', label: `Justifiés (${summary?.excusedCount ?? 0})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Corps : Tableau des absents */}
      {summaryQuery.isLoading ? (
        <div className="p-6">
          <TableSkeleton rows={4} cols={5} />
        </div>
      ) : summaryQuery.isError ? (
        <div className="p-6">
          <ErrorBanner
            message="Impossible de charger le suivi d’absentéisme."
            onRetry={() => summaryQuery.refetch()}
          />
        </div>
      ) : filteredAbsentees.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {summary && summary.recordedCount === 0
              ? 'Aucun appel enregistré pour cette date'
              : 'Aucun élève absent sur ce filtre'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {summary && summary.recordedCount === 0
              ? 'Démarrez l’appel d’une classe pour calculer automatiquement le taux d’absentéisme et alerter la vie scolaire en temps réel.'
              : 'Tous les élèves pointés correspondant aux filtres sont présents ou en règle.'}
          </p>
          {canWrite && openClasses.length > 0 && (
            <button
              type="button"
              onClick={() => setRollDrawerOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded-md cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Faire l’appel d’une classe
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-6">Élève</th>
                <th className="py-2.5 px-4">Classe</th>
                <th className="py-2.5 px-4">Statut</th>
                <th className="py-2.5 px-4">Motif</th>
                <th className="py-2.5 px-4">Responsable à contacter</th>
                {canWrite && <th className="py-2.5 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredAbsentees.map((item) => (
                <tr key={item.attendanceId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-6">
                    <Link
                      to={`/students?studentId=${item.studentId}`}
                      className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      {item.lastName} {item.firstName}
                    </Link>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{item.matricule}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{item.className}</span>
                    <span className="text-slate-400"> · {item.levelName}</span>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                    {item.isJustified || item.status === 'EXCUSED' ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        Absence justifiée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-red-800 dark:text-red-300">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                        Non justifiée
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {item.reason || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {item.primaryGuardianPhone ? (
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {item.primaryGuardianName}
                        </p>
                        <p className="font-mono text-slate-500 dark:text-slate-400 tabular-nums inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {item.primaryGuardianPhone}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400">Non renseigné</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {!item.isJustified && (
                          <button
                            type="button"
                            onClick={() => {
                              setJustifyTarget(item);
                              setJustifyReason(item.reason || '');
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                          >
                            Justifier
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updateAttendanceMutation.isPending}
                          onClick={() =>
                            updateAttendanceMutation.mutate({
                              attendanceId: item.attendanceId,
                              status: 'PRESENT',
                              isJustified: false,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 rounded cursor-pointer"
                        >
                          Arrivé présent
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tiroir latéral : Saisir l'appel d'une classe */}
      <DetailDrawer
        open={rollDrawerOpen}
        onClose={() => setRollDrawerOpen(false)}
        title="Feuille d’appel en temps réel"
        subtitle={`Date du relevé : ${selectedDate}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRollDrawerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              disabled={
                saveRollMutation.isPending ||
                !rollQuery.data ||
                rollQuery.data.students.length === 0
              }
              onClick={() => saveRollMutation.mutate()}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-50"
            >
              {saveRollMutation.isPending ? 'Enregistrement...' : 'Valider l’appel'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Classe</label>
              <select
                value={rollClassId}
                onChange={(e) => setRollClassId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              >
                {openClasses.length === 0 && <option value={0}>Aucune classe ouverte</option>}
                {openClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.enrolledCount} élèves)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              />
            </div>
          </div>

          {rollQuery.isLoading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : rollQuery.data && rollQuery.data.students.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-700/80 rounded-md">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Aucun élève inscrit dans cette classe
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Affectez d’abord des élèves depuis le module Élèves.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
              {rollQuery.data?.students.map((st) => {
                const draft = rollDraft[st.studentId] ?? { status: 'PRESENT', reason: '' };
                return (
                  <div key={st.studentId} className="p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {st.lastName} {st.firstName}
                        </p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{st.matricule}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {STATUS_BUTTONS.map((btn) => (
                          <button
                            key={btn.value}
                            type="button"
                            onClick={() =>
                              setRollDraft((prev) => ({
                                ...prev,
                                [st.studentId]: { ...draft, status: btn.value },
                              }))
                            }
                            className={`px-2.5 py-1 text-xs font-medium border rounded transition-colors cursor-pointer ${
                              draft.status === btn.value
                                ? btn.activeClass
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {draft.status !== 'PRESENT' && (
                      <input
                        type="text"
                        value={draft.reason}
                        onChange={(e) =>
                          setRollDraft((prev) => ({
                            ...prev,
                            [st.studentId]: { ...draft, reason: e.target.value },
                          }))
                        }
                        placeholder="Motif ou observation (ex: Certificat médical, transport...)"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DetailDrawer>

      {/* Modal Justification rapide */}
      {justifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Justifier l’absence de {justifyTarget.firstName} {justifyTarget.lastName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {justifyTarget.className} · {selectedDate}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Motif du justificatif
              </label>
              <input
                type="text"
                value={justifyReason}
                onChange={(e) => setJustifyReason(e.target.value)}
                placeholder="ex: Certificat médical, rendez-vous familial..."
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setJustifyTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={updateAttendanceMutation.isPending}
                onClick={() =>
                  updateAttendanceMutation.mutate({
                    attendanceId: justifyTarget.attendanceId,
                    status: 'EXCUSED',
                    isJustified: true,
                    reason: justifyReason.trim(),
                  })
                }
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
              >
                Enregistrer le justificatif
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
