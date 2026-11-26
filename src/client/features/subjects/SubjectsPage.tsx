import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Copy,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiClientError } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  ClassCurriculumResponse,
  ClassItem,
  ClassSubjectItem,
  PaginatedResponse,
  SubjectItem,
  TeacherItem,
} from '../../types/api.ts';

const DEPARTMENTS = [
  'Sciences',
  'Lettres & Langues',
  'Sciences Humaines',
  'Arts & Sport',
  'Technologie',
  'Général',
] as const;

const parseDecimalInput = (raw: string): number => {
  const num = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(num) ? num : Number.NaN;
};

const subjectFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Minimum 2 caractères.')
    .max(16, 'Maximum 16 caractères.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Lettres, chiffres, tirets ou underscores uniquement.'),
  name: z
    .string()
    .trim()
    .min(2, 'Minimum 2 caractères.')
    .max(100, 'Maximum 100 caractères.'),
  department: z.string().trim().min(2, 'Pôle disciplinaire requis.'),
  defaultCoefficient: z.string().refine((v) => {
    const n = parseDecimalInput(v);
    return !Number.isNaN(n) && n >= 0.5 && n <= 20;
  }, 'Coefficient entre 0.5 et 20.'),
  description: z.string().max(500, '500 caractères maximum.'),
  isActive: z.boolean(),
});

type SubjectFormValues = z.infer<typeof subjectFormSchema>;

const assignFormSchema = z.object({
  subjectId: z.string().min(1, 'Sélectionnez une matière.'),
  teacherId: z.string(),
  coefficient: z.string().refine((v) => {
    const n = parseDecimalInput(v);
    return !Number.isNaN(n) && n >= 0.5 && n <= 20;
  }, 'Coefficient entre 0.5 et 20.'),
  weeklyHours: z.string().refine((v) => {
    const n = parseDecimalInput(v);
    return !Number.isNaN(n) && n >= 0.5 && n <= 40;
  }, 'Volume entre 0.5h et 40h.'),
  isOptional: z.boolean(),
});

type AssignFormValues = z.infer<typeof assignFormSchema>;

export function SubjectsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const canWrite = hasPermission('subjects:write');
  const canReadClasses = hasPermission('classes:read');
  const canReadTeachers = hasPermission('teachers:read');
  const canReadYears = hasPermission('academic_years:read');

  const [activeTab, setActiveTab] = useState<'curriculum' | 'catalog'>(
    canReadClasses ? 'curriculum' : 'catalog'
  );

  // Catalog filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Curriculum selectors
  const [selectedYearId, setSelectedYearId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);

  // Modals state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubjectItem | null>(null);

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState<number>(0);
  const [copyIncludeTeachers, setCopyIncludeTeachers] = useState(true);

  const [removeTarget, setRemoveTarget] = useState<ClassSubjectItem | null>(null);

  // Queries
  const catalogParams = new URLSearchParams();
  if (catalogSearch.trim()) catalogParams.set('search', catalogSearch.trim());
  if (departmentFilter) catalogParams.set('department', departmentFilter);

  const subjectsQuery = useQuery({
    queryKey: ['subjects', catalogSearch.trim(), departmentFilter],
    queryFn: () =>
      apiFetch<{ items: SubjectItem[] }>(
        `/subjects${catalogParams.toString() ? `?${catalogParams.toString()}` : ''}`
      ),
  });

  const activeSubjectsQuery = useQuery({
    queryKey: ['subjects-active-options'],
    queryFn: () => apiFetch<{ items: SubjectItem[] }>('/subjects?activeOnly=true'),
    enabled: canWrite,
  });

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
    enabled: canReadYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes', 'subjects-module'],
    queryFn: () => apiFetch<PaginatedResponse<ClassItem>>('/classes?page=1&limit=100'),
    enabled: canReadClasses,
  });

  const teachersQuery = useQuery({
    queryKey: ['teachers-active-options'],
    queryFn: () =>
      apiFetch<PaginatedResponse<TeacherItem>>('/teachers?isActive=true&page=1&limit=100'),
    enabled: canReadTeachers && canWrite,
  });

  const years = yearsQuery.data?.items ?? [];
  const allClasses = (classesQuery.data?.items ?? []).filter((c) => !c.isArchived);

  // Default year to active year
  useEffect(() => {
    if (selectedYearId === 0 && years.length > 0) {
      const active = years.find((y) => y.status === 'ACTIVE') ?? years[0];
      setSelectedYearId(active.id);
    }
  }, [years, selectedYearId]);

  const filteredClasses =
    selectedYearId > 0
      ? allClasses.filter((c) => c.academicYearId === selectedYearId)
      : allClasses;

  // Keep selectedClassId aligned with filteredClasses
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
    enabled: canReadClasses && selectedClassId > 0,
  });

  // Catalog Subject Form
  const subjectForm = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      code: '',
      name: '',
      department: 'Sciences',
      defaultCoefficient: '2',
      description: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!subjectModalOpen) return;
    if (editingSubject) {
      subjectForm.reset({
        code: editingSubject.code,
        name: editingSubject.name,
        department: editingSubject.department,
        defaultCoefficient: String(editingSubject.defaultCoefficient),
        description: editingSubject.description,
        isActive: editingSubject.isActive,
      });
    } else {
      subjectForm.reset({
        code: '',
        name: '',
        department: 'Sciences',
        defaultCoefficient: '2',
        description: '',
        isActive: true,
      });
    }
  }, [subjectModalOpen, editingSubject, subjectForm]);

  const saveSubjectMutation = useMutation({
    mutationFn: (values: SubjectFormValues) => {
      const defaultCoefficient = parseDecimalInput(values.defaultCoefficient);
      if (editingSubject) {
        return apiFetch<SubjectItem>(`/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            code: values.code.trim().toUpperCase(),
            name: values.name.trim(),
            department: values.department.trim(),
            defaultCoefficient,
            description: values.description.trim(),
            isActive: values.isActive,
          }),
        });
      }
      return apiFetch<SubjectItem>('/subjects', {
        method: 'POST',
        body: JSON.stringify({
          code: values.code.trim().toUpperCase(),
          name: values.name.trim(),
          department: values.department.trim(),
          defaultCoefficient,
          description: values.description.trim(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['subjects-active-options'] });
      queryClient.invalidateQueries({ queryKey: ['class-curriculum'] });
      setSubjectModalOpen(false);
      setEditingSubject(null);
      toast.success(
        editingSubject ? 'Matière mise à jour.' : 'Matière ajoutée au référentiel.'
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de l’enregistrement.');
    },
  });

  // Class Subject Assignment Form
  const assignForm = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      subjectId: '',
      teacherId: '',
      coefficient: '2',
      weeklyHours: '3',
      isOptional: false,
    },
  });

  const assignedSubjectIds = new Set(
    (curriculumQuery.data?.items ?? []).map((item) => item.subjectId)
  );
  const availableSubjects = (activeSubjectsQuery.data?.items ?? []).filter(
    (s) => !assignedSubjectIds.has(s.id)
  );

  useEffect(() => {
    if (!assignModalOpen) return;
    if (editingClassSubject) {
      assignForm.reset({
        subjectId: String(editingClassSubject.subjectId),
        teacherId: editingClassSubject.teacherId ? String(editingClassSubject.teacherId) : '',
        coefficient: String(editingClassSubject.coefficient),
        weeklyHours: String(editingClassSubject.weeklyHours),
        isOptional: editingClassSubject.isOptional,
      });
    } else {
      const firstSub = availableSubjects[0];
      assignForm.reset({
        subjectId: firstSub ? String(firstSub.id) : '',
        teacherId: '',
        coefficient: firstSub ? String(firstSub.defaultCoefficient) : '2',
        weeklyHours: '3',
        isOptional: false,
      });
    }
  }, [assignModalOpen, editingClassSubject, assignForm]);

  const saveAssignmentMutation = useMutation({
    mutationFn: (values: AssignFormValues) => {
      const coefficient = parseDecimalInput(values.coefficient);
      const weeklyHours = parseDecimalInput(values.weeklyHours);
      const teacherId = values.teacherId ? Number(values.teacherId) : null;

      if (editingClassSubject) {
        return apiFetch<ClassSubjectItem>(
          `/subjects/class-subjects/${editingClassSubject.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              teacherId,
              coefficient,
              weeklyHours,
              isOptional: values.isOptional,
            }),
          }
        );
      }

      return apiFetch<ClassSubjectItem>(`/subjects/classes/${selectedClassId}`, {
        method: 'POST',
        body: JSON.stringify({
          subjectId: Number(values.subjectId),
          teacherId,
          coefficient,
          weeklyHours,
          isOptional: values.isOptional,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-curriculum', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setAssignModalOpen(false);
      setEditingClassSubject(null);
      toast.success(
        editingClassSubject
          ? 'Affectation mise à jour.'
          : 'Matière ajoutée au programme de la classe.'
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Opération refusée.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/subjects/class-subjects/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-curriculum', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setRemoveTarget(null);
      toast.success('Matière retirée du programme.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Suppression impossible.');
    },
  });

  const copyMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ copiedCount: number; sourceClassName: string; targetClassName: string }>(
        `/subjects/classes/${selectedClassId}/copy-from`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceClassId: copySourceClassId,
            includeTeachers: copyIncludeTeachers,
          }),
        }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['class-curriculum', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setCopyModalOpen(false);
      toast.success(
        `${res.copiedCount} matière(s) copiée(s) depuis ${res.sourceClassName} vers ${res.targetClassName}.`
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Échec de la copie.');
    },
  });

  const curriculum = curriculumQuery.data;
  const isClosedYear = curriculum?.classInfo.academicYearStatus === 'CLOSED';
  const copyCandidates = allClasses.filter((c) => c.id !== selectedClassId);

  return (
    <AppLayout
      headerAction={
        canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditingSubject(null);
              setSubjectModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle matière
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-700">
              Phase 2 · Pédagogie — Module 7
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Matières, Coefficients & Programmes
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Structurez le référentiel disciplinaire de l’établissement, fixez les coefficients par classe et affectez les enseignants responsables.
            </p>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md self-start md:self-auto">
            {canReadClasses && (
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'curriculum'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Programme par classe
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Référentiel des matières ({subjectsQuery.data?.items.length ?? 0})
            </button>
          </div>
        </div>

        {/* ONGLET 1 : PROGRAMME PAR CLASSE */}
        {activeTab === 'curriculum' && canReadClasses && (
          <div className="space-y-6">
            {/* Barre de sélection année / classe */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {canReadYears && years.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Année scolaire
                    </label>
                    <select
                      value={selectedYearId}
                      onChange={(e) => setSelectedYearId(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-800"
                    >
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.status === 'ACTIVE' ? '(Active)' : y.status === 'CLOSED' ? '(Clôturée)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Classe sélectionnée
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    disabled={filteredClasses.length === 0}
                    className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-900 font-medium min-w-[210px]"
                  >
                    {filteredClasses.length === 0 ? (
                      <option value={0}>Aucune classe disponible</option>
                    ) : (
                      filteredClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.levelName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {curriculum && (
                  <div className="pt-4 text-xs text-slate-500">
                    {curriculum.classInfo.levelName}
                    {curriculum.classInfo.seriesName ? ` · Série ${curriculum.classInfo.seriesName}` : ''}
                    {' · '}
                    <span className="font-mono tabular-nums">
                      {curriculum.classInfo.enrolledCount} élève(s)
                    </span>
                  </div>
                )}
              </div>

              {canWrite && selectedClassId > 0 && !isClosedYear && (
                <div className="flex flex-wrap items-center gap-2">
                  {copyCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCopySourceClassId(copyCandidates[0].id);
                        setCopyIncludeTeachers(true);
                        setCopyModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copier depuis une classe
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassSubject(null);
                      setAssignModalOpen(true);
                    }}
                    disabled={availableSubjects.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter au programme
                  </button>
                </div>
              )}
            </div>

            {/* Synthèse du programme */}
            {selectedClassId > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/40">
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500">Matières au programme</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                      {curriculumQuery.isLoading ? '—' : curriculum?.summary.subjectCount ?? 0}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                      {curriculum?.summary.mandatoryCount ?? 0} oblig. · {curriculum?.summary.optionalCount ?? 0} opt.
                    </p>
                  </div>

                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500">Somme des coefficients</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-700 font-mono tabular-nums">
                      {curriculumQuery.isLoading ? '—' : curriculum?.summary.totalCoefficient ?? 0}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Base de calcul des moyennes</p>
                  </div>

                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500">Volume horaire hebdo</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                      {curriculumQuery.isLoading ? '—' : `${curriculum?.summary.totalWeeklyHours ?? 0} h`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Heures d’enseignement / sem.</p>
                  </div>

                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-500">Affectation enseignants</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                      {curriculumQuery.isLoading
                        ? '—'
                        : `${curriculum?.summary.assignedTeachersCount ?? 0} / ${curriculum?.summary.subjectCount ?? 0}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {(curriculum?.summary.unassignedTeachersCount ?? 0) > 0
                        ? `${curriculum?.summary.unassignedTeachersCount} matière(s) sans professeur`
                        : 'Couverture complète'}
                    </p>
                  </div>
                </div>

                {curriculumQuery.isLoading ? (
                  <div className="p-6">
                    <TableSkeleton rows={4} cols={5} />
                  </div>
                ) : curriculumQuery.isError ? (
                  <div className="p-6">
                    <ErrorBanner
                      message="Impossible de charger le programme de cette classe."
                      onRetry={() => curriculumQuery.refetch()}
                    />
                  </div>
                ) : !curriculum || curriculum.items.length === 0 ? (
                  <div className="p-8 text-center">
                    <BookOpen className="w-7 h-7 text-slate-400 mx-auto" />
                    <h3 className="mt-2.5 text-sm font-semibold text-slate-900">
                      Aucune matière configurée pour {curriculum?.classInfo.name ?? 'cette classe'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                      Associez les matières du référentiel avec leur coefficient, leur volume horaire et l’enseignant titulaire.
                    </p>
                    {canWrite && !isClosedYear && (
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if ((activeSubjectsQuery.data?.items.length ?? 0) === 0) {
                              setEditingSubject(null);
                              setSubjectModalOpen(true);
                            } else {
                              setEditingClassSubject(null);
                              setAssignModalOpen(true);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {(activeSubjectsQuery.data?.items.length ?? 0) === 0
                            ? 'Créer une première matière'
                            : 'Ajouter une matière'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                          <th className="py-3 px-6">Matière</th>
                          <th className="py-3 px-4">Pôle</th>
                          <th className="py-3 px-4">Coefficient</th>
                          <th className="py-3 px-4">Volume / sem.</th>
                          <th className="py-3 px-4">Enseignant responsable</th>
                          <th className="py-3 px-4">Régime</th>
                          {canWrite && !isClosedYear && (
                            <th className="py-3 px-6 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {curriculum.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs font-semibold text-indigo-700">
                                  {item.subjectCode}
                                </span>
                                <span className="font-medium text-slate-900">
                                  {item.subjectName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600">
                              {item.subjectDepartment}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                              {item.coefficient}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                              {item.weeklyHours} h
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              {item.teacherFullName ? (
                                <div className="flex items-center gap-1.5 text-slate-900">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-medium">{item.teacherFullName}</span>
                                  <span className="text-slate-400 font-mono">
                                    · {item.teacherEmployeeCode}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-amber-700 font-medium">
                                  Non affecté
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span
                                className={
                                  item.isOptional
                                    ? 'text-slate-500 font-medium'
                                    : 'text-slate-800 font-medium'
                                }
                              >
                                {item.isOptional ? 'Optionnelle' : 'Obligatoire'}
                              </span>
                            </td>
                            {canWrite && !isClosedYear && (
                              <td className="py-3.5 px-6 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingClassSubject(item);
                                      setAssignModalOpen(true);
                                    }}
                                    aria-label={`Modifier ${item.subjectName}`}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemoveTarget(item)}
                                    aria-label={`Retirer ${item.subjectName}`}
                                    className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              </div>
            )}

            {filteredClasses.length === 0 && !classesQuery.isLoading && (
              <EmptyState
                title="Aucune classe ouverte sur cette année"
                description="Créez d’abord des classes dans le module Classes & Niveaux avant de configurer leur programme."
              />
            )}
          </div>
        )}

        {/* ONGLET 2 : RÉFÉRENTIEL DES MATIÈRES */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher par code (MATH) ou intitulé..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                aria-label="Filtrer par pôle disciplinaire"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-700"
              >
                <option value="">Tous les pôles</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {subjectsQuery.isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : subjectsQuery.isError ? (
              <ErrorBanner
                message="Impossible de charger le référentiel des matières."
                onRetry={() => subjectsQuery.refetch()}
              />
            ) : (subjectsQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="Aucune matière répertoriée"
                description="Ajoutez les matières enseignées dans votre établissement (Mathématiques, Français, Physique-Chimie, Anglais...) pour pouvoir les affecter aux classes."
                action={
                  canWrite ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubject(null);
                        setSubjectModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Créer une matière
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
                        <th className="py-3 px-6">Code</th>
                        <th className="py-3 px-4">Intitulé</th>
                        <th className="py-3 px-4">Pôle disciplinaire</th>
                        <th className="py-3 px-4">Coeff. standard</th>
                        <th className="py-3 px-4">Classes dotées</th>
                        <th className="py-3 px-4">Statut</th>
                        {canWrite && <th className="py-3 px-6 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {subjectsQuery.data?.items.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/60">
                          <td className="py-3.5 px-6 font-mono text-xs font-semibold text-indigo-700">
                            {sub.code}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-900">{sub.name}</p>
                            {sub.description && (
                              <p className="text-xs text-slate-500 truncate max-w-xs">
                                {sub.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            {sub.department}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                            {sub.defaultCoefficient}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {sub.assignedClassCount} classe(s)
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusIndicator active={sub.isActive} />
                          </td>
                          {canWrite && (
                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubject(sub);
                                  setSubjectModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded cursor-pointer"
                              >
                                Modifier
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Création / Édition Matière */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingSubject ? `Modifier ${editingSubject.name}` : 'Nouvelle matière'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSubjectModalOpen(false);
                  setEditingSubject(null);
                }}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={subjectForm.handleSubmit((vals) => saveSubjectMutation.mutate(vals))}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    {...subjectForm.register('code')}
                    placeholder="ex: MATH"
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 rounded-md"
                  />
                  {subjectForm.formState.errors.code && (
                    <p className="mt-1 text-xs text-red-700">
                      {subjectForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Intitulé officiel *
                  </label>
                  <input
                    type="text"
                    {...subjectForm.register('name')}
                    placeholder="ex: Mathématiques"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                  {subjectForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-700">
                      {subjectForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pôle disciplinaire *
                  </label>
                  <select
                    {...subjectForm.register('department')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Coefficient par défaut *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    {...subjectForm.register('defaultCoefficient')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                  {subjectForm.formState.errors.defaultCoefficient && (
                    <p className="mt-1 text-xs text-red-700">
                      {subjectForm.formState.errors.defaultCoefficient.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description / Objectifs
                </label>
                <textarea
                  rows={2}
                  {...subjectForm.register('description')}
                  placeholder="Précisions sur le programme ou les épreuves..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              {editingSubject && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    {...subjectForm.register('isActive')}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Matière active dans l’établissement
                </label>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSubjectModalOpen(false);
                    setEditingSubject(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveSubjectMutation.isPending}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveSubjectMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Affectation Matière à la Classe */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingClassSubject
                    ? `Modifier ${editingClassSubject.subjectName}`
                    : `Ajouter au programme · ${curriculum?.classInfo.name ?? ''}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Coefficient, volume horaire hebdomadaire et enseignant titulaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignModalOpen(false);
                  setEditingClassSubject(null);
                }}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={assignForm.handleSubmit((vals) => saveAssignmentMutation.mutate(vals))}
              className="p-6 space-y-4"
            >
              {!editingClassSubject && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Matière *
                  </label>
                  <select
                    {...assignForm.register('subjectId', {
                      onChange: (e) => {
                        const sub = availableSubjects.find(
                          (s) => String(s.id) === e.target.value
                        );
                        if (sub) {
                          assignForm.setValue('coefficient', String(sub.defaultCoefficient));
                        }
                      },
                    })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                  >
                    {availableSubjects.length === 0 && (
                      <option value="">Toutes les matières actives sont déjà affectées</option>
                    )}
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.code}] {s.name} (coeff. std {s.defaultCoefficient})
                      </option>
                    ))}
                  </select>
                  {assignForm.formState.errors.subjectId && (
                    <p className="mt-1 text-xs text-red-700">
                      {assignForm.formState.errors.subjectId.message}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Enseignant responsable
                </label>
                <select
                  {...assignForm.register('teacherId')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                >
                  <option value="">Non affecté pour le moment</option>
                  {(teachersQuery.data?.items ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.lastName} {t.firstName} ({t.specialty} · {t.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Coefficient dans la classe *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    {...assignForm.register('coefficient')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                  {assignForm.formState.errors.coefficient && (
                    <p className="mt-1 text-xs text-red-700">
                      {assignForm.formState.errors.coefficient.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Heures par semaine *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    {...assignForm.register('weeklyHours')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                  {assignForm.formState.errors.weeklyHours && (
                    <p className="mt-1 text-xs text-red-700">
                      {assignForm.formState.errors.weeklyHours.message}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...assignForm.register('isOptional')}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Enseignement optionnel / facultatif
              </label>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOpen(false);
                    setEditingClassSubject(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveAssignmentMutation.isPending}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveAssignmentMutation.isPending ? 'Enregistrement...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Copie de programme */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Copier un programme existant
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Importe les matières et coefficients manquants vers {curriculum?.classInfo.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                aria-label="Fermer"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Classe modèle
              </label>
              <select
                value={copySourceClassId}
                onChange={(e) => setCopySourceClassId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
              >
                {copyCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.levelName} ({c.academicYearName})
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={copyIncludeTeachers}
                onChange={(e) => setCopyIncludeTeachers(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Conserver également les enseignants affectés
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={copyMutation.isPending || copySourceClassId === 0}
                onClick={() => copyMutation.mutate()}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
              >
                {copyMutation.isPending ? 'Copie en cours...' : 'Copier le programme'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression matière du programme */}
      <ConfirmModal
        open={Boolean(removeTarget)}
        title="Retirer cette matière du programme ?"
        description={
          removeTarget
            ? `La matière « ${removeTarget.subjectName} » sera retirée du programme de ${removeTarget.className}.`
            : ''
        }
        confirmLabel="Retirer"
        danger
        isPending={removeMutation.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget.id);
          }
        }}
      />
    </AppLayout>
  );
}
