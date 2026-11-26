import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { auth } from '../../../lib/firebase.ts';
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
  AcademicYearItem,
  ClassItem,
  ClassReportCardsResponse,
  MyReportCardsResponse,
  PaginatedResponse,
  ReportCardDetail,
} from '../../types/api.ts';

const HONOR_MENTIONS = [
  '',
  'Félicitations du conseil',
  'Tableau d’honneur',
  'Encouragements',
  'Mise en garde travail',
  'Mise en garde comportement',
] as const;

async function downloadReportCardPdfFile(
  cardId: number,
  fallbackFilename: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Session expirée.');
  const token = await user.getIdToken();
  const res = await fetch(`/api/v1/report-cards/${cardId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Impossible de générer le document PDF.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportCardsPage() {
  const { profile } = useAuth();
  const roleCodes = profile?.roles.map((r) => r.code) ?? [];
  const isStaff = roleCodes.some((c) =>
    ['ADMIN', 'PRINCIPAL', 'SECRETARY', 'TEACHER', 'SUPERVISOR'].includes(c)
  );

  if (!isStaff) {
    return <StudentParentReportCardsView />;
  }
  return <StaffReportCardsView />;
}

function StaffReportCardsView() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const canManage = hasPermission('report_cards:manage');
  const canReadYears = hasPermission('academic_years:read');
  const canReadClasses = hasPermission('classes:read');

  const [selectedYearId, setSelectedYearId] = useState<number>(0);
  const [selectedTermId, setSelectedTermId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Drawer editable state
  const [honorMention, setHonorMention] = useState('');
  const [councilRemark, setCouncilRemark] = useState('');
  const [subjectRemarksDraft, setSubjectRemarksDraft] = useState<Record<number, string>>({});

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
    enabled: canReadYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes', 'report-cards-module'],
    queryFn: () => apiFetch<PaginatedResponse<ClassItem>>('/classes?page=1&limit=100'),
    enabled: canReadClasses,
  });

  const years = yearsQuery.data?.items ?? [];
  const allClasses = (classesQuery.data?.items ?? []).filter((c) => !c.isArchived);

  useEffect(() => {
    if (selectedYearId === 0 && years.length > 0) {
      const active = years.find((y) => y.status === 'ACTIVE') ?? years[0];
      setSelectedYearId(active.id);
    }
  }, [years, selectedYearId]);

  const currentYear = years.find((y) => y.id === selectedYearId);
  const termsForYear = currentYear?.terms ?? [];

  useEffect(() => {
    if (termsForYear.length === 0) {
      if (selectedTermId !== 0) setSelectedTermId(0);
      return;
    }
    if (!termsForYear.some((t) => t.id === selectedTermId)) {
      const curr = termsForYear.find((t) => t.isCurrent) ?? termsForYear[0];
      setSelectedTermId(curr.id);
    }
  }, [termsForYear, selectedTermId]);

  const filteredClasses =
    selectedYearId > 0
      ? allClasses.filter((c) => c.academicYearId === selectedYearId)
      : allClasses;

  useEffect(() => {
    if (filteredClasses.length === 0) {
      if (selectedClassId !== 0) setSelectedClassId(0);
      return;
    }
    if (!filteredClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  const classCardsQuery = useQuery({
    queryKey: ['report-cards-class', selectedClassId, selectedTermId],
    queryFn: () =>
      apiFetch<ClassReportCardsResponse>(
        `/report-cards/class?classId=${selectedClassId}&termId=${selectedTermId}`
      ),
    enabled: selectedClassId > 0 && selectedTermId > 0,
  });

  const detailQuery = useQuery({
    queryKey: ['report-card-detail', selectedCardId],
    queryFn: () => apiFetch<ReportCardDetail>(`/report-cards/${selectedCardId}`),
    enabled: selectedCardId !== null,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setHonorMention(detailQuery.data.honorMention);
    setCouncilRemark(detailQuery.data.councilRemark);
    const map: Record<number, string> = {};
    for (const s of detailQuery.data.subjects) {
      map[s.classSubjectId] = s.teacherRemark;
    }
    setSubjectRemarksDraft(map);
  }, [detailQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiFetch<{
        createdCount: number;
        updatedCount: number;
        skippedValidatedCount: number;
      }>('/report-cards/generate', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId, termId: selectedTermId }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['report-cards-class'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-detail'] });
      toast.success(
        `${res.createdCount} bulletin(s) généré(s), ${res.updatedCount} actualisé(s)${
          res.skippedValidatedCount > 0
            ? ` (${res.skippedValidatedCount} validé(s) conservé(s))`
            : ''
        }.`
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la génération.');
    },
  });

  const validateAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ validatedCount: number }>('/report-cards/class/validate-all', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId, termId: selectedTermId }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['report-cards-class'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-detail'] });
      toast.success(`${res.validatedCount} bulletin(s) validé(s) et verrouillé(s).`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Validation impossible.');
    },
  });

  const saveDetailMutation = useMutation({
    mutationFn: () => {
      if (!detailQuery.data) throw new Error('Bulletin introuvable.');
      const payload: {
        honorMention?: string;
        councilRemark?: string;
        subjectRemarks: Array<{ classSubjectId: number; teacherRemark: string }>;
      } = {
        subjectRemarks: detailQuery.data.subjects.map((s) => ({
          classSubjectId: s.classSubjectId,
          teacherRemark: subjectRemarksDraft[s.classSubjectId] ?? '',
        })),
      };
      if (canManage) {
        payload.honorMention = honorMention;
        payload.councilRemark = councilRemark;
      }
      return apiFetch<ReportCardDetail>(`/report-cards/${detailQuery.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-cards-class'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-detail', selectedCardId] });
      toast.success('Appréciations enregistrées.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Enregistrement refusé.');
    },
  });

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'validate' | 'reopen' }) =>
      apiFetch<ReportCardDetail>(`/report-cards/${id}/${action}`, {
        method: 'POST',
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['report-cards-class'] });
      queryClient.invalidateQueries({ queryKey: ['report-card-detail', updated.id] });
      toast.success(
        updated.status === 'VALIDATED'
          ? 'Bulletin validé et mis à disposition des familles.'
          : 'Bulletin repassé en brouillon.'
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Action impossible.');
    },
  });

  const handleDownloadPdf = async (cardId: number, matricule: string, termName: string) => {
    setDownloadingId(cardId);
    try {
      await downloadReportCardPdfFile(
        cardId,
        `bulletin-${matricule}-${termName}.pdf`.replace(/\s+/g, '_')
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Téléchargement PDF impossible.');
    } finally {
      setDownloadingId(null);
    }
  };

  const data = classCardsQuery.data;
  const isClosedYear = currentYear?.status === 'CLOSED';
  const detail = detailQuery.data;

  return (
    <AppLayout
      headerAction={
        canManage && !isClosedYear && selectedClassId > 0 && selectedTermId > 0 ? (
          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${generateMutation.isPending ? 'animate-spin' : ''}`}
            />
            Générer / Actualiser les bulletins
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Bulletins scolaires & Export PDF
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Consolidez les moyennes et absences par trimestre, rédigez les appréciations du conseil de classe, validez les bulletins et générez les PDF officiels.
          </p>
        </div>

        {/* Sélecteurs Année / Période / Classe */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Année scolaire
              </label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(Number(e.target.value))}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-800 dark:text-slate-200"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.status === 'ACTIVE' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Période
              </label>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(Number(e.target.value))}
                disabled={termsForYear.length === 0}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-800 dark:text-slate-200"
              >
                {termsForYear.length === 0 ? (
                  <option value={0}>Aucune période</option>
                ) : (
                  termsForYear.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Classe
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
                disabled={filteredClasses.length === 0}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-900 dark:text-slate-100 font-medium min-w-[200px]"
              >
                {filteredClasses.length === 0 ? (
                  <option value={0}>Aucune classe</option>
                ) : (
                  filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.levelName}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {canManage && !isClosedYear && data && data.stats.draftCount > 0 && (
            <button
              type="button"
              disabled={validateAllMutation.isPending}
              onClick={() => validateAllMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 rounded-md cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Valider les {data.stats.draftCount} brouillon(s)
            </button>
          )}
        </div>

        {/* Corps principal */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          {classCardsQuery.isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={5} cols={6} />
            </div>
          ) : classCardsQuery.isError ? (
            <div className="p-6">
              <ErrorBanner
                message="Impossible de charger les bulletins de cette classe."
                onRetry={() => classCardsQuery.refetch()}
              />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-7 h-7 text-slate-400 mx-auto" />
              <h2 className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Aucun bulletin généré pour cette classe et période
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Générez les bulletins pour calculer automatiquement les moyennes pondérées, le classement et le relevé d’assiduité de chaque élève.
              </p>
              {canManage && !isClosedYear && selectedClassId > 0 && selectedTermId > 0 && (
                <button
                  type="button"
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Générer les bulletins maintenant
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30">
                <div className="px-6 py-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Bulletins générés</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {data.stats.totalCards}
                  </p>
                </div>
                <div className="px-6 py-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Validés / Publiés</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                    {data.stats.validatedCount}
                  </p>
                </div>
                <div className="px-6 py-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">En brouillon</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                    {data.stats.draftCount}
                  </p>
                </div>
                <div className="px-6 py-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Moyenne générale classe</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                    {data.stats.classAverage !== null
                      ? `${data.stats.classAverage.toFixed(2)} / 20`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-6">Élève</th>
                      <th className="py-3 px-4">Moyenne</th>
                      <th className="py-3 px-4">Rang</th>
                      <th className="py-3 px-4">Assiduité</th>
                      <th className="py-3 px-4">Mention</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {data.items.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                        <td className="py-3.5 px-6">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {card.studentLastName} {card.studentFirstName}
                          </p>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {card.studentMatricule}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                          {card.generalAverage !== null ? (
                            <span
                              className={
                                card.generalAverage >= 10 ? 'text-slate-900 dark:text-slate-100' : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {card.generalAverage.toFixed(2)} / 20
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                          {card.rank !== null ? `${card.rank}e / ${card.totalStudents}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {card.absencesCount} abs. · {card.latesCount} ret.
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                          {card.honorMention || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          {card.status === 'VALIDATED' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Validé
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">Brouillon</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedCardId(card.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                            >
                              Appréciations
                            </button>
                            <button
                              type="button"
                              disabled={downloadingId === card.id}
                              onClick={() =>
                                handleDownloadPdf(
                                  card.id,
                                  card.studentMatricule,
                                  card.termName
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tiroir détail & appréciations du bulletin */}
      <DetailDrawer
        open={selectedCardId !== null}
        onClose={() => setSelectedCardId(null)}
        title={
          detail
            ? `${detail.studentLastName} ${detail.studentFirstName}`
            : 'Détail du bulletin'
        }
        subtitle={
          detail
            ? `${detail.className} · ${detail.termName} · ${
                detail.generalAverage !== null ? `${detail.generalAverage.toFixed(2)} / 20` : '—'
              }`
            : 'Chargement...'
        }
        footer={
          detail ? (
            <>
              <button
                type="button"
                onClick={() =>
                  handleDownloadPdf(detail.id, detail.studentMatricule, detail.termName)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger PDF
              </button>

              {canManage && !isClosedYear && (
                <button
                  type="button"
                  disabled={statusToggleMutation.isPending}
                  onClick={() =>
                    statusToggleMutation.mutate({
                      id: detail.id,
                      action: detail.status === 'VALIDATED' ? 'reopen' : 'validate',
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md cursor-pointer ${
                    detail.status === 'VALIDATED'
                      ? 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-950/70'
                  }`}
                >
                  {detail.status === 'VALIDATED' ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Repasser en brouillon
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Valider le bulletin
                    </>
                  )}
                </button>
              )}

              {detail.status === 'DRAFT' && !isClosedYear && (
                <button
                  type="button"
                  disabled={saveDetailMutation.isPending}
                  onClick={() => saveDetailMutation.mutate()}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveDetailMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {detailQuery.isLoading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : detailQuery.isError || !detail ? (
          <ErrorBanner message="Impossible de charger le détail du bulletin." />
        ) : (
          <div className="space-y-5">
            {detail.status === 'VALIDATED' && (
              <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 rounded-md text-xs text-emerald-900 dark:text-emerald-200">
                Bulletin validé et verrouillé — visible dans l’espace élève et parent.
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
              {detail.subjects.map((sub) => (
                <div key={sub.classSubjectId} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 mr-2">
                        {sub.subjectCode}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {sub.subjectName}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        coeff. {sub.coefficient}
                      </span>
                    </div>
                    <div className="font-mono text-xs tabular-nums text-right">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {sub.subjectAverage !== null ? `${sub.subjectAverage.toFixed(2)}` : '—'}
                      </span>
                      <span className="text-slate-400">
                        {' '}
                        / cl.{' '}
                        {sub.classSubjectAverage !== null
                          ? sub.classSubjectAverage.toFixed(2)
                          : '—'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    disabled={detail.status === 'VALIDATED' || isClosedYear}
                    value={subjectRemarksDraft[sub.classSubjectId] ?? ''}
                    onChange={(e) =>
                      setSubjectRemarksDraft((prev) => ({
                        ...prev,
                        [sub.classSubjectId]: e.target.value,
                      }))
                    }
                    placeholder="Appréciation du professeur dans la matière..."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-70"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/80">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Distinction / Mention du conseil
                </label>
                <select
                  disabled={!canManage || detail.status === 'VALIDATED' || isClosedYear}
                  value={honorMention}
                  onChange={(e) => setHonorMention(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                >
                  {HONOR_MENTIONS.map((m) => (
                    <option key={m || 'none'} value={m}>
                      {m || 'Aucune mention particulière'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Appréciation générale du conseil de classe
                </label>
                <textarea
                  rows={3}
                  disabled={!canManage || detail.status === 'VALIDATED' || isClosedYear}
                  value={councilRemark}
                  onChange={(e) => setCouncilRemark(e.target.value)}
                  placeholder="Bilan trimestriel, attitude en classe et conseils..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                />
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </AppLayout>
  );
}

function StudentParentReportCardsView() {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['my-report-cards'],
    queryFn: () => apiFetch<MyReportCardsResponse>('/report-cards/my-cards'),
  });

  const handleDownload = async (id: number, matricule: string, termName: string) => {
    setDownloadingId(id);
    try {
      await downloadReportCardPdfFile(
        id,
        `bulletin-${matricule}-${termName}.pdf`.replace(/\s+/g, '_')
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Téléchargement impossible.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Espace Scolarité</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Bulletins scolaires officiels
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Consultez et téléchargez au format PDF les bulletins validés par le conseil de classe.
          </p>
        </div>

        {query.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : query.isError ? (
          <ErrorBanner
            message="Impossible de charger vos bulletins scolaires."
            onRetry={() => query.refetch()}
          />
        ) : !query.data || query.data.items.length === 0 ? (
          <EmptyState
            title="Aucun bulletin validé disponible"
            description="Vos bulletins trimestriels apparaîtront ici dès leur validation officielle par la direction."
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
            {query.data.items.map((card) => (
              <div
                key={card.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">{card.termName}</span>
                    <span>·</span>
                    <span>{card.academicYearName}</span>
                    <span>·</span>
                    <span>{card.className}</span>
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {card.studentLastName} {card.studentFirstName}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                    Moyenne :{' '}
                    <strong>
                      {card.generalAverage !== null
                        ? `${card.generalAverage.toFixed(2)} / 20`
                        : '—'}
                    </strong>
                    {card.rank !== null ? ` · Rang : ${card.rank}e / ${card.totalStudents}` : ''}
                    {card.honorMention ? ` · ${card.honorMention}` : ''}
                  </p>
                  {card.councilRemark && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{card.councilRemark}</p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={downloadingId === card.id}
                  onClick={() =>
                    handleDownload(card.id, card.studentMatricule, card.termName)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
