import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  CheckCircle2,
  ClipboardEdit,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLayout } from '../../components/layout/AppLayout.tsx';
import { DetailDrawer } from '../../components/ui/DetailDrawer.tsx';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  TableSkeleton,
} from '../../components/ui/States.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  AssessmentItem,
  AssessmentSheetResponse,
  AssessmentType,
  ClassCurriculumResponse,
  ClassItem,
  ClassTermSummaryResponse,
  MyGradesSummaryResponse,
  PaginatedResponse,
} from '../../types/api.ts';

const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  QUIZ: 'Interrogation',
  TEST: 'Devoir surveillé',
  EXAM: 'Examen / Composition',
  ORAL: 'Évaluation orale',
  PRACTICAL: 'Travaux pratiques',
};

const parseDecimalInput = (raw: string): number => {
  const num = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(num) ? num : Number.NaN;
};

const assessmentFormSchema = z.object({
  classSubjectId: z.string().min(1, 'Sélectionnez une matière.'),
  termId: z.string().min(1, 'Sélectionnez une période.'),
  title: z
    .string()
    .trim()
    .min(2, 'Minimum 2 caractères.')
    .max(120, 'Maximum 120 caractères.'),
  assessmentType: z.enum(['QUIZ', 'TEST', 'EXAM', 'ORAL', 'PRACTICAL']),
  assessmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ requis.'),
  maxScore: z.string().refine((v) => {
    const n = parseDecimalInput(v);
    return !Number.isNaN(n) && n >= 1 && n <= 200;
  }, 'Barème entre 1 et 200.'),
  weight: z.string().refine((v) => {
    const n = parseDecimalInput(v);
    return !Number.isNaN(n) && n >= 0.25 && n <= 10;
  }, 'Coefficient entre 0.25 et 10.'),
  description: z.string().max(500, '500 caractères maximum.'),
  isPublished: z.boolean(),
});

type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

export function GradesPage() {
  const { profile } = useAuth();
  const roleCodes = profile?.roles.map((r) => r.code) ?? [];
  const isStaffOrTeacher = roleCodes.some((c) =>
    ['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(c)
  );

  if (!isStaffOrTeacher) {
    return <StudentParentGradesView />;
  }
  return <StaffGradesView />;
}

function StaffGradesView() {
  const { profile, hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const roleCodes = profile?.roles.map((r) => r.code) ?? [];
  const isStaffOrTeacher = roleCodes.some((c) =>
    ['ADMIN', 'PRINCIPAL', 'TEACHER'].includes(c)
  );
  const canWrite = hasPermission('grades:write') && isStaffOrTeacher;

  const canReadYears = hasPermission('academic_years:read');
  const canReadClasses = hasPermission('classes:read');
  const canReadSubjects = hasPermission('subjects:read');

  const [activeTab, setActiveTab] = useState<'assessments' | 'summary'>('assessments');
  const [selectedYearId, setSelectedYearId] = useState<number>(0);
  const [selectedTermId, setSelectedTermId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<number>(0);

  // Create/Edit Assessment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentItem | null>(null);

  // Score Sheet Drawer
  const [sheetAssessmentId, setSheetAssessmentId] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState<
    Record<number, { scoreText: string; isAbsent: boolean; comment: string }>
  >({});

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
    enabled: canReadYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes', 'grades-module'],
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

  const curriculumQuery = useQuery({
    queryKey: ['class-curriculum', selectedClassId],
    queryFn: () => apiFetch<ClassCurriculumResponse>(`/subjects/classes/${selectedClassId}`),
    enabled: canReadSubjects && selectedClassId > 0,
  });

  const classSubjectsList = curriculumQuery.data?.items ?? [];

  useEffect(() => {
    if (
      selectedClassSubjectId !== 0 &&
      !classSubjectsList.some((cs) => cs.id === selectedClassSubjectId)
    ) {
      setSelectedClassSubjectId(0);
    }
  }, [classSubjectsList, selectedClassSubjectId]);

  const assessmentParams = new URLSearchParams();
  if (selectedClassId > 0) assessmentParams.set('classId', String(selectedClassId));
  if (selectedTermId > 0) assessmentParams.set('termId', String(selectedTermId));
  if (selectedClassSubjectId > 0) {
    assessmentParams.set('classSubjectId', String(selectedClassSubjectId));
  }

  const assessmentsQuery = useQuery({
    queryKey: [
      'grades-assessments',
      selectedClassId,
      selectedTermId,
      selectedClassSubjectId,
    ],
    queryFn: () =>
      apiFetch<{ items: AssessmentItem[] }>(
        `/grades/assessments${assessmentParams.toString() ? `?${assessmentParams.toString()}` : ''}`
      ),
    enabled: selectedClassId > 0 && selectedTermId > 0,
  });

  const classSummaryQuery = useQuery({
    queryKey: ['grades-class-summary', selectedClassId, selectedTermId],
    queryFn: () =>
      apiFetch<ClassTermSummaryResponse>(
        `/grades/class-summary?classId=${selectedClassId}&termId=${selectedTermId}`
      ),
    enabled: activeTab === 'summary' && selectedClassId > 0 && selectedTermId > 0,
  });

  const sheetQuery = useQuery({
    queryKey: ['grades-sheet', sheetAssessmentId],
    queryFn: () =>
      apiFetch<AssessmentSheetResponse>(`/grades/assessments/${sheetAssessmentId}/sheet`),
    enabled: sheetAssessmentId !== null,
  });

  useEffect(() => {
    if (!sheetQuery.data) return;
    const draft: Record<number, { scoreText: string; isAbsent: boolean; comment: string }> = {};
    for (const row of sheetQuery.data.rows) {
      draft[row.studentId] = {
        scoreText: row.score !== null ? String(row.score) : '',
        isAbsent: row.isAbsent,
        comment: row.comment,
      };
    }
    setScoreDraft(draft);
  }, [sheetQuery.data]);

  const assessmentForm = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      classSubjectId: '',
      termId: '',
      title: '',
      assessmentType: 'TEST',
      assessmentDate: new Date().toISOString().slice(0, 10),
      maxScore: '20',
      weight: '1',
      description: '',
      isPublished: false,
    },
  });

  useEffect(() => {
    if (!modalOpen) return;
    if (editingAssessment) {
      assessmentForm.reset({
        classSubjectId: String(editingAssessment.classSubjectId),
        termId: String(editingAssessment.termId),
        title: editingAssessment.title,
        assessmentType: editingAssessment.assessmentType,
        assessmentDate: editingAssessment.assessmentDate,
        maxScore: String(editingAssessment.maxScore),
        weight: String(editingAssessment.weight),
        description: editingAssessment.description,
        isPublished: editingAssessment.isPublished,
      });
    } else {
      const defaultCs =
        selectedClassSubjectId > 0
          ? String(selectedClassSubjectId)
          : classSubjectsList[0]
            ? String(classSubjectsList[0].id)
            : '';
      assessmentForm.reset({
        classSubjectId: defaultCs,
        termId: selectedTermId > 0 ? String(selectedTermId) : '',
        title: '',
        assessmentType: 'TEST',
        assessmentDate: new Date().toISOString().slice(0, 10),
        maxScore: '20',
        weight: '1',
        description: '',
        isPublished: false,
      });
    }
  }, [
    modalOpen,
    editingAssessment,
    selectedClassSubjectId,
    selectedTermId,
    classSubjectsList,
    assessmentForm,
  ]);

  const saveAssessmentMutation = useMutation({
    mutationFn: (values: AssessmentFormValues) => {
      const maxScore = parseDecimalInput(values.maxScore);
      const weight = parseDecimalInput(values.weight);

      if (editingAssessment) {
        return apiFetch<AssessmentItem>(`/grades/assessments/${editingAssessment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: values.title.trim(),
            assessmentType: values.assessmentType,
            assessmentDate: values.assessmentDate,
            maxScore,
            weight,
            description: values.description.trim(),
            isPublished: values.isPublished,
          }),
        });
      }

      return apiFetch<AssessmentItem>('/grades/assessments', {
        method: 'POST',
        body: JSON.stringify({
          classSubjectId: Number(values.classSubjectId),
          termId: Number(values.termId),
          title: values.title.trim(),
          assessmentType: values.assessmentType,
          assessmentDate: values.assessmentDate,
          maxScore,
          weight,
          description: values.description.trim(),
          isPublished: values.isPublished,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['grades-class-summary'] });
      setModalOpen(false);
      setEditingAssessment(null);
      toast.success(editingAssessment ? 'Évaluation mise à jour.' : 'Évaluation créée.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de l’enregistrement.');
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      apiFetch<AssessmentItem>(`/grades/assessments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['grades-assessments'] });
      toast.success(
        updated.isPublished
          ? 'Notes publiées aux élèves et parents.'
          : 'Évaluation repassée en brouillon.'
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Action refusée.');
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/grades/assessments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['grades-class-summary'] });
      setDeleteTarget(null);
      toast.success('Évaluation supprimée.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Suppression impossible.');
    },
  });

  const saveScoresMutation = useMutation({
    mutationFn: () => {
      if (!sheetQuery.data) throw new Error('Feuille introuvable.');
      const maxScore = sheetQuery.data.assessment.maxScore;
      const entries = sheetQuery.data.rows.map((row) => {
        const d = scoreDraft[row.studentId] ?? {
          scoreText: '',
          isAbsent: false,
          comment: '',
        };
        if (d.isAbsent) {
          return {
            studentId: row.studentId,
            score: null,
            isAbsent: true,
            comment: d.comment.trim(),
          };
        }
        const trimmed = d.scoreText.trim();
        if (trimmed === '') {
          return {
            studentId: row.studentId,
            score: null,
            isAbsent: false,
            comment: d.comment.trim(),
          };
        }
        const parsed = parseDecimalInput(trimmed);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > maxScore) {
          throw new Error(
            `Note invalide pour ${row.lastName} ${row.firstName} (doit être comprise entre 0 et ${maxScore}).`
          );
        }
        return {
          studentId: row.studentId,
          score: parsed,
          isAbsent: false,
          comment: d.comment.trim(),
        };
      });

      return apiFetch<{ savedCount: number }>(
        `/grades/assessments/${sheetQuery.data.assessment.id}/scores`,
        {
          method: 'PUT',
          body: JSON.stringify({ entries }),
        }
      );
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['grades-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['grades-sheet', sheetAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ['grades-class-summary'] });
      setSheetAssessmentId(null);
      toast.success(`${res.savedCount} ligne(s) de notes enregistrée(s).`);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Erreur lors de l’enregistrement des notes.'
      );
    },
  });

  const handleExportSummaryCsv = () => {
    const data = classSummaryQuery.data;
    if (!data) return;
    const headers = [
      'Rang',
      'Matricule',
      'Nom',
      'Prénom',
      ...data.subjects.map((s) => `${s.subjectCode} (coeff ${s.coefficient})`),
      'Moyenne Générale (/20)',
    ];
    const rows = data.students.map((st) => [
      st.rank ?? '',
      st.matricule,
      st.lastName,
      st.firstName,
      ...st.subjectAverages.map((sa) => (sa.averageOn20 !== null ? String(sa.averageOn20) : '')),
      st.generalAverageOn20 !== null ? String(st.generalAverageOn20) : '',
    ]);
    const csv = [headers, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moyennes-${data.classInfo.name}-${data.termInfo.name}.csv`.replace(/\s+/g, '_');
    link.click();
    URL.revokeObjectURL(url);
  };

  const assessmentsList = assessmentsQuery.data?.items ?? [];
  const isClosedYear = currentYear?.status === 'CLOSED';

  return (
    <AppLayout
      headerAction={
        canWrite && !isClosedYear && classSubjectsList.length > 0 && selectedTermId > 0 ? (
          <button
            type="button"
            onClick={() => {
              setEditingAssessment(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle évaluation
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Évaluations, Notes & Moyennes
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Planifiez vos contrôles, saisissez les notes par classe et suivez les moyennes pondérées et classements par trimestre.
            </p>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-md self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('assessments')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'assessments'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Évaluations & Saisie
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Synthèse & Classement
            </button>
          </div>
        </div>

        {/* Barre de sélection Année / Période / Classe / Matière */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-wrap items-end gap-4">
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
                    {t.name} {t.isCurrent ? '(En cours)' : ''}
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
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-900 dark:text-slate-100 font-medium min-w-[190px]"
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

          {activeTab === 'assessments' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Matière
              </label>
              <select
                value={selectedClassSubjectId}
                onChange={(e) => setSelectedClassSubjectId(Number(e.target.value))}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md text-slate-800 dark:text-slate-200 min-w-[200px]"
              >
                <option value={0}>Toutes les matières</option>
                {classSubjectsList.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    [{cs.subjectCode}] {cs.subjectName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ONGLET 1 : ÉVALUATIONS & SAISIE */}
        {activeTab === 'assessments' && (
          <div>
            {assessmentsQuery.isLoading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : assessmentsQuery.isError ? (
              <ErrorBanner
                message="Impossible de charger les évaluations de cette classe."
                onRetry={() => assessmentsQuery.refetch()}
              />
            ) : classSubjectsList.length === 0 ? (
              <EmptyState
                title="Aucune matière configurée dans cette classe"
                description="Configurez d’abord les matières et coefficients de cette classe dans le module Matières & Programmes avant de créer des évaluations."
              />
            ) : assessmentsList.length === 0 ? (
              <EmptyState
                title="Aucune évaluation enregistrée sur cette période"
                description="Créez un devoir surveillé, une interrogation ou un examen pour saisir les notes des élèves et publier les résultats."
                action={
                  canWrite && !isClosedYear ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssessment(null);
                        setModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Créer une évaluation
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
                        <th className="py-3 px-6">Évaluation</th>
                        <th className="py-3 px-4">Matière</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Barème / Coeff.</th>
                        <th className="py-3 px-4">Avancement & Moy.</th>
                        <th className="py-3 px-4">Publication</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {assessmentsList.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="py-3.5 px-6">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {ASSESSMENT_TYPE_LABELS[a.assessmentType]}
                              {a.teacherFullName ? ` · ${a.teacherFullName}` : ''}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                              {a.subjectCode}
                            </span>{' '}
                            <span className="text-slate-800 dark:text-slate-200">{a.subjectName}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {a.assessmentDate}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            /{a.maxScore} · coeff. {a.weight}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                            <p className="text-slate-900 dark:text-slate-100 font-medium">
                              {a.gradedCount} / {a.enrolledCount} noté(s)
                              {a.absentCount > 0 ? ` · ${a.absentCount} abs.` : ''}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              {a.averageOn20 !== null
                                ? `Moy. ${a.averageOn20.toFixed(2)} / 20`
                                : 'Aucune note saisie'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                            {a.isPublished ? (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Publiée
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Brouillon</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSheetAssessmentId(a.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 rounded cursor-pointer"
                              >
                                <ClipboardEdit className="w-3.5 h-3.5" />
                                {canWrite && !isClosedYear ? 'Saisir notes' : 'Consulter'}
                              </button>
                              {canWrite && !isClosedYear && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      togglePublishMutation.mutate({
                                        id: a.id,
                                        isPublished: !a.isPublished,
                                      })
                                    }
                                    title={
                                      a.isPublished
                                        ? 'Repasser en brouillon'
                                        : 'Publier aux élèves & parents'
                                    }
                                    aria-label={a.isPublished ? 'Masquer' : 'Publier'}
                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                  >
                                    {a.isPublished ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(a)}
                                    aria-label={`Supprimer ${a.title}`}
                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ONGLET 2 : SYNTHÈSE DES MOYENNES & CLASSEMENT */}
        {activeTab === 'summary' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
            {classSummaryQuery.isLoading ? (
              <div className="p-6">
                <TableSkeleton rows={5} cols={6} />
              </div>
            ) : classSummaryQuery.isError ? (
              <div className="p-6">
                <ErrorBanner
                  message="Impossible de calculer la synthèse des moyennes de la classe."
                  onRetry={() => classSummaryQuery.refetch()}
                />
              </div>
            ) : !classSummaryQuery.data ? null : (
              <>
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Tableau des moyennes · {classSummaryQuery.data.classInfo.name} ({classSummaryQuery.data.termInfo.name})
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                      {classSummaryQuery.data.stats.evaluatedStudentsCount} élève(s) évalué(s) sur{' '}
                      {classSummaryQuery.data.stats.studentCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportSummaryCsv}
                    disabled={classSummaryQuery.data.students.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30">
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Moyenne de la classe</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                      {classSummaryQuery.data.stats.classGeneralAverage !== null
                        ? `${classSummaryQuery.data.stats.classGeneralAverage.toFixed(2)} / 20`
                        : '—'}
                    </p>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Meilleure moyenne</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                      {classSummaryQuery.data.stats.highestAverage !== null
                        ? `${classSummaryQuery.data.stats.highestAverage.toFixed(2)} / 20`
                        : '—'}
                    </p>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Plus basse moyenne</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {classSummaryQuery.data.stats.lowestAverage !== null
                        ? `${classSummaryQuery.data.stats.lowestAverage.toFixed(2)} / 20`
                        : '—'}
                    </p>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Matières pondérées</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {classSummaryQuery.data.subjects.length}
                    </p>
                  </div>
                </div>

                {classSummaryQuery.data.students.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Aucun élève inscrit dans cette classe.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <th className="py-3 px-4">Rang</th>
                          <th className="py-3 px-4">Élève</th>
                          {classSummaryQuery.data.subjects.map((sub) => (
                            <th key={sub.classSubjectId} className="py-3 px-3 text-right whitespace-nowrap">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {sub.subjectCode}
                              </span>
                              <span className="block text-[10px] font-mono text-slate-400">
                                coeff. {sub.coefficient}
                              </span>
                            </th>
                          ))}
                          <th className="py-3 px-6 text-right">Moy. Générale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {classSummaryQuery.data.students.map((st) => (
                          <tr key={st.studentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                              {st.rank !== null ? `${st.rank}e` : '—'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {st.lastName} {st.firstName}
                              </p>
                              <p className="text-xs font-mono text-slate-400">{st.matricule}</p>
                            </td>
                            {st.subjectAverages.map((sa) => (
                              <td
                                key={sa.classSubjectId}
                                className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300"
                              >
                                {sa.averageOn20 !== null ? sa.averageOn20.toFixed(2) : '—'}
                              </td>
                            ))}
                            <td className="py-3 px-6 text-right font-mono font-bold tabular-nums">
                              {st.generalAverageOn20 !== null ? (
                                <span
                                  className={
                                    st.generalAverageOn20 >= 10
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-red-700 dark:text-red-400'
                                  }
                                >
                                  {st.generalAverageOn20.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal Création / Édition Évaluation */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingAssessment ? 'Modifier l’évaluation' : 'Nouvelle évaluation'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingAssessment(null);
                }}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={assessmentForm.handleSubmit((vals) => saveAssessmentMutation.mutate(vals))}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {!editingAssessment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Matière *
                    </label>
                    <select
                      {...assessmentForm.register('classSubjectId')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                    >
                      {classSubjectsList.map((cs) => (
                        <option key={cs.id} value={cs.id}>
                          [{cs.subjectCode}] {cs.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Période *
                    </label>
                    <select
                      {...assessmentForm.register('termId')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                    >
                      {termsForYear.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Intitulé de l’évaluation *
                </label>
                <input
                  type="text"
                  {...assessmentForm.register('title')}
                  placeholder="ex: Devoir surveillé n°1 — Algèbre linéaire"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
                {assessmentForm.formState.errors.title && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                    {assessmentForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nature *
                  </label>
                  <select
                    {...assessmentForm.register('assessmentType')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    {...assessmentForm.register('assessmentDate')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Note maximale (barème) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    {...assessmentForm.register('maxScore')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {assessmentForm.formState.errors.maxScore && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {assessmentForm.formState.errors.maxScore.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pondération dans la matière *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    {...assessmentForm.register('weight')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {assessmentForm.formState.errors.weight && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {assessmentForm.formState.errors.weight.message}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  {...assessmentForm.register('isPublished')}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                />
                Publier immédiatement les résultats aux élèves et parents
              </label>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveAssessmentMutation.isPending}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveAssessmentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tiroir latéral : Feuille de saisie des notes */}
      <DetailDrawer
        open={sheetAssessmentId !== null}
        onClose={() => setSheetAssessmentId(null)}
        title={sheetQuery.data?.assessment.title ?? 'Feuille de notes'}
        subtitle={
          sheetQuery.data
            ? `${sheetQuery.data.assessment.className} · ${sheetQuery.data.assessment.subjectName} · Barème /${sheetQuery.data.assessment.maxScore}`
            : 'Chargement...'
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setSheetAssessmentId(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
            >
              Fermer
            </button>
            {canWrite && !isClosedYear && (
              <button
                type="button"
                disabled={
                  saveScoresMutation.isPending ||
                  !sheetQuery.data ||
                  sheetQuery.data.rows.length === 0
                }
                onClick={() => saveScoresMutation.mutate()}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-50"
              >
                {saveScoresMutation.isPending ? 'Enregistrement...' : 'Enregistrer les notes'}
              </button>
            )}
          </>
        }
      >
        {sheetQuery.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : sheetQuery.isError || !sheetQuery.data ? (
          <ErrorBanner message="Impossible de charger la feuille de saisie." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md bg-slate-50/50 dark:bg-slate-800/40 text-center">
              <div className="p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Notés</p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {sheetQuery.data.stats.gradedCount} / {sheetQuery.data.stats.enrolledCount}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Moyenne / 20</p>
                <p className="text-base font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                  {sheetQuery.data.stats.averageOn20 !== null
                    ? sheetQuery.data.stats.averageOn20.toFixed(2)
                    : '—'}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Min / Max</p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {sheetQuery.data.stats.minScore !== null
                    ? `${sheetQuery.data.stats.minScore} – ${sheetQuery.data.stats.maxScore}`
                    : '—'}
                </p>
              </div>
            </div>

            {sheetQuery.data.rows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                Aucun élève inscrit activement dans cette classe.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
                {sheetQuery.data.rows.map((row) => {
                  const draft = scoreDraft[row.studentId] ?? {
                    scoreText: '',
                    isAbsent: false,
                    comment: '',
                  };
                  return (
                    <div key={row.studentId} className="p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {row.lastName} {row.firstName}
                          </p>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{row.matricule}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!canWrite || isClosedYear}
                              checked={draft.isAbsent}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [row.studentId]: {
                                    ...draft,
                                    isAbsent: e.target.checked,
                                    scoreText: e.target.checked ? '' : draft.scoreText,
                                  },
                                }))
                              }
                              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                            />
                            Absent
                          </label>

                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!canWrite || isClosedYear || draft.isAbsent}
                              value={draft.isAbsent ? '' : draft.scoreText}
                              onChange={(e) =>
                                setScoreDraft((prev) => ({
                                  ...prev,
                                  [row.studentId]: { ...draft, scoreText: e.target.value },
                                }))
                              }
                              placeholder="—"
                              className="w-20 px-2.5 py-1.5 text-sm text-right font-mono border border-slate-200 dark:border-slate-700/80 rounded bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                            />
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              /{sheetQuery.data.assessment.maxScore}
                            </span>
                          </div>
                        </div>
                      </div>

                      <input
                        type="text"
                        disabled={!canWrite || isClosedYear}
                        value={draft.comment}
                        onChange={(e) =>
                          setScoreDraft((prev) => ({
                            ...prev,
                            [row.studentId]: { ...draft, comment: e.target.value },
                          }))
                        }
                        placeholder="Observation du professeur (optionnel)"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-70"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Supprimer cette évaluation ?"
        description={
          deleteTarget
            ? `L’évaluation « ${deleteTarget.title} » et toutes les notes associées seront définitivement supprimées.`
            : ''
        }
        confirmLabel="Supprimer"
        danger
        isPending={deleteAssessmentMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteAssessmentMutation.mutate(deleteTarget.id);
          }
        }}
      />
    </AppLayout>
  );
}

function StudentParentGradesView() {
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const [termId, setTermId] = useState<number | undefined>(undefined);

  const params = new URLSearchParams();
  if (studentId) params.set('studentId', String(studentId));
  if (termId) params.set('termId', String(termId));

  const query = useQuery({
    queryKey: ['my-grades-summary', studentId, termId],
    queryFn: () =>
      apiFetch<MyGradesSummaryResponse>(
        `/grades/my-summary${params.toString() ? `?${params.toString()}` : ''}`
      ),
  });

  const data = query.data;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Espace Scolarité</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              Relevé de notes & Moyennes
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Consultez les évaluations publiées, vos moyennes par matière et votre moyenne générale.
            </p>
          </div>

          {data && data.students.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {data.students.length > 1 && (
                <select
                  value={data.selectedStudentId ?? ''}
                  onChange={(e) => setStudentId(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                >
                  {data.students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} ({st.className ?? 'Sans classe'})
                    </option>
                  ))}
                </select>
              )}

              {data.terms.length > 0 && (
                <select
                  value={data.selectedTermId ?? ''}
                  onChange={(e) => setTermId(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                >
                  {data.terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {query.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : query.isError ? (
          <ErrorBanner
            message="Impossible de charger vos résultats scolaires."
            onRetry={() => query.refetch()}
          />
        ) : !data || data.students.length === 0 ? (
          <EmptyState
            title="Aucun dossier élève rattaché"
            description="Votre compte utilisateur n’est pas encore associé à une fiche élève inscrite."
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Moyenne générale pondérée
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {data.generalAverageOn20 !== null
                      ? `${data.generalAverageOn20.toFixed(2)} / 20`
                      : 'En attente de notes publiées'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {data.subjects.length} matière(s) au programme
              </p>
            </div>

            {data.subjects.length === 0 ? (
              <EmptyState
                title="Aucune note publiée sur cette période"
                description="Les résultats apparaîtront ici dès que les enseignants auront publié les évaluations."
              />
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
                {data.subjects.map((sub) => (
                  <div key={sub.classSubjectId} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 mr-2">
                          {sub.subjectCode}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {sub.subjectName}
                        </span>
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                          · Coeff. {sub.coefficient}
                          {sub.teacherFullName ? ` · ${sub.teacherFullName}` : ''}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {sub.averageOn20 !== null ? `${sub.averageOn20.toFixed(2)} / 20` : '—'}
                      </span>
                    </div>

                    {sub.grades.length > 0 ? (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
                        {sub.grades.map((g) => (
                          <li
                            key={g.assessmentId}
                            className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <FileCheck2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">{g.title}</span>
                              <span className="text-slate-400 font-mono tabular-nums">
                                {g.assessmentDate}
                              </span>
                            </div>
                            <div className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {g.isAbsent ? (
                                <span className="text-red-700 dark:text-red-400 font-medium">Absent</span>
                              ) : g.score !== null ? (
                                <span>
                                  <strong>{g.score}</strong> / {g.maxScore}
                                </span>
                              ) : (
                                '—'
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Aucune évaluation publiée dans cette matière.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
