import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Download,
  Edit3,
  FileSpreadsheet,
  FolderOpen,
  ImagePlus,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
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
import { apiFetch, apiFetchBlob, ApiClientError } from '../../services/apiClient.ts';
import type {
  AcademicYearItem,
  ClassItem,
  CsvImportSummary,
  EnrollmentStatus,
  LevelItem,
  PaginatedResponse,
  StudentDossier,
  StudentItem,
} from '../../types/api.ts';

const studentFormSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  gender: z.enum(['M', 'F']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date requise (AAAA-MM-JJ).'),
  placeOfBirth: z.string().trim().max(100),
  nationality: z.string().trim().max(80),
  address: z.string().trim().max(240),
  phone: z.string().trim().max(30),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]),
  medicalNotes: z.string().trim().max(500),
  photoUrl: z.string().nullable(),
  enrollYearId: z.number().int().min(0),
  enrollClassId: z.number().int().min(0),
});

const enrollmentFormSchema = z.object({
  academicYearId: z.number().int().positive('Année scolaire requise.'),
  classId: z.number().int().positive('Classe requise.'),
  notes: z.string().trim().max(300),
});

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Inscrit',
  TRANSFERRED: 'Transféré',
  WITHDRAWN: 'Radié / Retiré',
  COMPLETED: 'Terminé',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  FATHER: 'Père',
  MOTHER: 'Mère',
  LEGAL_GUARDIAN: 'Tuteur légal',
  OTHER: 'Autre responsable',
};

const SAMPLE_CSV = [
  'firstName;lastName;gender;dateOfBirth;placeOfBirth;nationality;phone;email;address',
  'Camille;Durand;F;2011-04-12;Lyon;Française;0612345678;camille.durand@exemple.fr;12 rue Victor Hugo',
  'Lucas;Morel;M;2010-09-23;Marseille;Française;0698765432;;8 avenue Jean Jaurès',
].join('\n');

function compressPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire l’image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non pris en charge.'));
      img.onload = () => {
        const maxSize = 320;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function StudentsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = hasPermission('students:write');

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modals & Drawers
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<StudentItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importYearId, setImportYearId] = useState<number>(0);
  const [importClassId, setImportClassId] = useState<number>(0);
  const [importResult, setImportResult] = useState<CsvImportSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showNewEnrollForm, setShowNewEnrollForm] = useState(false);

  // Deep link from Command Palette (?studentId=123)
  useEffect(() => {
    const paramId = Number(searchParams.get('studentId'));
    if (Number.isInteger(paramId) && paramId > 0) {
      setSelectedStudentId(paramId);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Reference data queries
  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ items: AcademicYearItem[] }>('/academic-years'),
  });

  const levelsQuery = useQuery({
    queryKey: ['levels'],
    queryFn: () => apiFetch<{ items: LevelItem[] }>('/classes/levels'),
  });

  const classesQuery = useQuery({
    queryKey: ['classes-all'],
    queryFn: () => apiFetch<PaginatedResponse<ClassItem>>('/classes?limit=100'),
  });

  // Students list query
  const listParams = new URLSearchParams({
    page: String(page),
    limit: '15',
    includeArchived: String(includeArchived),
  });
  if (search.trim()) listParams.set('search', search.trim());
  if (yearFilter) listParams.set('academicYearId', yearFilter);
  if (classFilter) listParams.set('classId', classFilter);
  if (levelFilter) listParams.set('levelId', levelFilter);
  if (genderFilter) listParams.set('gender', genderFilter);

  const studentsQuery = useQuery({
    queryKey: [
      'students',
      page,
      search,
      yearFilter,
      classFilter,
      levelFilter,
      genderFilter,
      includeArchived,
    ],
    queryFn: () => apiFetch<PaginatedResponse<StudentItem>>(`/students?${listParams.toString()}`),
  });

  const dossierQuery = useQuery({
    queryKey: ['student-dossier', selectedStudentId],
    queryFn: () => apiFetch<StudentDossier>(`/students/${selectedStudentId}`),
    enabled: Boolean(selectedStudentId),
  });

  const studentForm = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'F',
      dateOfBirth: '',
      placeOfBirth: '',
      nationality: '',
      address: '',
      phone: '',
      email: '',
      medicalNotes: '',
      photoUrl: null,
      enrollYearId: 0,
      enrollClassId: 0,
    },
  });

  const enrollForm = useForm<z.infer<typeof enrollmentFormSchema>>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: { academicYearId: 0, classId: 0, notes: '' },
  });

  const watchFormYearId = studentForm.watch('enrollYearId');
  const watchFormPhoto = studentForm.watch('photoUrl');
  const watchDrawerYearId = enrollForm.watch('academicYearId');

  const saveStudentMutation = useMutation({
    mutationFn: async (vals: z.infer<typeof studentFormSchema>) => {
      if (editingStudent) {
        return apiFetch<StudentDossier>(`/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: vals.firstName,
            lastName: vals.lastName,
            gender: vals.gender,
            dateOfBirth: vals.dateOfBirth,
            placeOfBirth: vals.placeOfBirth,
            nationality: vals.nationality,
            address: vals.address,
            phone: vals.phone,
            email: vals.email,
            medicalNotes: vals.medicalNotes,
            photoUrl: vals.photoUrl,
          }),
        });
      }

      const payload: Record<string, unknown> = {
        firstName: vals.firstName,
        lastName: vals.lastName,
        gender: vals.gender,
        dateOfBirth: vals.dateOfBirth,
        placeOfBirth: vals.placeOfBirth,
        nationality: vals.nationality,
        address: vals.address,
        phone: vals.phone,
        email: vals.email,
        medicalNotes: vals.medicalNotes,
        photoUrl: vals.photoUrl,
      };
      if (vals.enrollYearId > 0 && vals.enrollClassId > 0) {
        payload.initialEnrollment = {
          academicYearId: vals.enrollYearId,
          classId: vals.enrollClassId,
        };
      }
      return apiFetch<StudentDossier>('/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-all'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier', saved.id] });
      setFormModalOpen(false);
      toast.success(
        editingStudent
          ? `Dossier de ${saved.firstName} ${saved.lastName} mis à jour.`
          : `Élève ${saved.firstName} ${saved.lastName} inscrit (${saved.matricule}).`
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Erreur lors de l’enregistrement.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (st: StudentItem) =>
      apiFetch<StudentDossier>(`/students/${st.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !st.isArchived }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier', updated.id] });
      setArchiveTarget(null);
      toast.success(
        updated.isArchived
          ? `Dossier ${updated.matricule} archivé.`
          : `Dossier ${updated.matricule} restauré.`
      );
    },
    onError: (err) => {
      setArchiveTarget(null);
      toast.error(err instanceof ApiClientError ? err.message : 'Action refusée.');
    },
  });

  const addEnrollmentMutation = useMutation({
    mutationFn: (vals: z.infer<typeof enrollmentFormSchema>) =>
      apiFetch(`/students/${selectedStudentId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify(vals),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-all'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier', selectedStudentId] });
      setShowNewEnrollForm(false);
      toast.success('Inscription annuelle enregistrée.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Inscription impossible.');
    },
  });

  const updateEnrollmentClassMutation = useMutation({
    mutationFn: ({
      enrollmentId,
      classId,
      status,
    }: {
      enrollmentId: number;
      classId?: number;
      status?: EnrollmentStatus;
    }) =>
      apiFetch(`/students/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ classId, status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-all'] });
      queryClient.invalidateQueries({ queryKey: ['student-dossier', selectedStudentId] });
      toast.success('Inscription mise à jour.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Mise à jour refusée.');
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      apiFetch<CsvImportSummary>('/students/import', {
        method: 'POST',
        body: JSON.stringify({
          csvContent: csvText,
          ...(importYearId > 0 && importClassId > 0
            ? { academicYearId: importYearId, classId: importClassId }
            : {}),
        }),
      }),
    onSuccess: (summary) => {
      setImportResult(summary);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-all'] });
      if (summary.createdCount > 0) {
        toast.success(`${summary.createdCount} élève(s) importé(s) avec succès.`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : 'Importation échouée.');
    },
  });

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const exportParams = new URLSearchParams(listParams);
      exportParams.delete('page');
      exportParams.delete('limit');
      const blob = await apiFetchBlob(`/students/export?${exportParams.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eleves-academia-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé.');
    } catch {
      toast.error('Impossible d’exporter la liste des élèves.');
    } finally {
      setExporting(false);
    }
  };

  const openCreateStudent = () => {
    setEditingStudent(null);
    const activeYear = yearsQuery.data?.items.find((y) => y.status === 'ACTIVE');
    studentForm.reset({
      firstName: '',
      lastName: '',
      gender: 'F',
      dateOfBirth: '',
      placeOfBirth: '',
      nationality: '',
      address: '',
      phone: '',
      email: '',
      medicalNotes: '',
      photoUrl: null,
      enrollYearId: activeYear?.id ?? 0,
      enrollClassId: 0,
    });
    setFormModalOpen(true);
  };

  const openEditStudent = (st: StudentItem) => {
    setEditingStudent(st);
    studentForm.reset({
      firstName: st.firstName,
      lastName: st.lastName,
      gender: st.gender,
      dateOfBirth: st.dateOfBirth,
      placeOfBirth: st.placeOfBirth,
      nationality: st.nationality,
      address: st.address,
      phone: st.phone,
      email: st.email,
      medicalNotes: st.medicalNotes,
      photoUrl: st.photoUrl,
      enrollYearId: 0,
      enrollClassId: 0,
    });
    setFormModalOpen(true);
  };

  const openEnrollmentInDrawer = () => {
    const activeYear =
      yearsQuery.data?.items.find((y) => y.status === 'ACTIVE') ??
      yearsQuery.data?.items.find((y) => y.status !== 'CLOSED');
    enrollForm.reset({
      academicYearId: activeYear?.id ?? 0,
      classId: 0,
      notes: '',
    });
    setShowNewEnrollForm(true);
  };

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressPhotoFile(file);
      studentForm.setValue('photoUrl', compressed, { shouldDirty: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur sur la photo.');
    }
  };

  const activeYears = yearsQuery.data?.items.filter((y) => y.status !== 'CLOSED') ?? [];
  const classesForFormYear =
    classesQuery.data?.items.filter((c) => !c.isArchived && c.academicYearId === watchFormYearId) ??
    [];
  const classesForImportYear =
    classesQuery.data?.items.filter((c) => !c.isArchived && c.academicYearId === importYearId) ??
    [];
  const classesForDrawerYear =
    classesQuery.data?.items.filter(
      (c) => !c.isArchived && c.academicYearId === watchDrawerYearId
    ) ?? [];

  return (
    <AppLayout
      headerAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Export...' : 'Exporter CSV'}
          </button>
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportResult(null);
                  setCsvText('');
                  const activeYear = yearsQuery.data?.items.find((y) => y.status === 'ACTIVE');
                  setImportYearId(activeYear?.id ?? 0);
                  setImportClassId(0);
                  setImportModalOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Importer CSV
              </button>
              <button
                type="button"
                onClick={openCreateStudent}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Nouvel élève
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Élèves & Inscriptions annuelles
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Gérez les dossiers scolaires, les matricules uniques, l’affectation en classe et l’historique d’inscription.
          </p>
        </div>

        {/* Barre de filtres multi-critères */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher par matricule, nom, prénom ou e-mail..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Filtrer par année scolaire"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              >
                <option value="">Toutes les années</option>
                {yearsQuery.data?.items.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par niveau"
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              >
                <option value="">Tous les niveaux</option>
                {levelsQuery.data?.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par classe"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              >
                <option value="">Toutes les classes</option>
                {classesQuery.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYearName})
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par genre"
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
              >
                <option value="">Tous genres</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>

              <label className="inline-flex items-center gap-2 px-2 py-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400"
                />
                <span>Inclure archivés</span>
              </label>
            </div>
          </div>
        </div>

        {/* Liste des élèves */}
        {studentsQuery.isLoading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : studentsQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger les dossiers élèves."
            onRetry={() => studentsQuery.refetch()}
          />
        ) : studentsQuery.data && studentsQuery.data.items.length === 0 ? (
          <EmptyState
            title="Aucun élève trouvé"
            description="Inscrivez votre premier élève ou importez une cohorte complète via un fichier CSV."
            action={
              canWrite ? (
                <button
                  type="button"
                  onClick={openCreateStudent}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer"
                >
                  Inscrire un élève
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
                    <th className="py-3 px-4">Élève</th>
                    <th className="py-3 px-4">Matricule</th>
                    <th className="py-3 px-4">Naissance</th>
                    <th className="py-3 px-4">Classe actuelle</th>
                    <th className="py-3 px-4">Situation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {studentsQuery.data?.items.map((st) => (
                    <tr
                      key={st.id}
                      onClick={() => {
                        setShowNewEnrollForm(false);
                        setSelectedStudentId(st.id);
                      }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {st.photoUrl ? (
                            <img
                              src={st.photoUrl}
                              alt={`${st.firstName} ${st.lastName}`}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700/80 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-semibold shrink-0">
                              {st.firstName[0]}
                              {st.lastName[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {st.lastName} {st.firstName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {st.gender === 'F' ? 'Féminin' : 'Masculin'}
                              {st.phone ? ` · ${st.phone}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {st.matricule}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {st.dateOfBirth}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {st.currentEnrollment ? (
                          <span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {st.currentEnrollment.className}
                            </span>{' '}
                            <span className="text-slate-500 dark:text-slate-400">
                              · {st.currentEnrollment.academicYearName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Non affecté</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {st.isArchived ? (
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Archivé</span>
                        ) : st.currentEnrollment ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {ENROLLMENT_STATUS_LABELS[st.currentEnrollment.status]}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">En attente de classe</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewEnrollForm(false);
                              setSelectedStudentId(st.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Dossier
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditStudent(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => setArchiveTarget(st)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                {st.isArchived ? 'Restaurer' : 'Archiver'}
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

            {studentsQuery.data && studentsQuery.data.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {studentsQuery.data.pagination.total} élève(s) · Page{' '}
                  {studentsQuery.data.pagination.page} /{' '}
                  {studentsQuery.data.pagination.totalPages}
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
                    disabled={page >= studentsQuery.data.pagination.totalPages}
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

      {/* Panneau latéral : Dossier scolaire complet */}
      <DetailDrawer
        open={Boolean(selectedStudentId)}
        onClose={() => {
          setSelectedStudentId(null);
          setShowNewEnrollForm(false);
        }}
        title={
          dossierQuery.data
            ? `${dossierQuery.data.lastName} ${dossierQuery.data.firstName}`
            : 'Dossier scolaire'
        }
        subtitle={
          dossierQuery.data
            ? `Matricule ${dossierQuery.data.matricule} · Né(e) le ${dossierQuery.data.dateOfBirth}`
            : 'Chargement du dossier...'
        }
        footer={
          dossierQuery.data && canWrite ? (
            <>
              <button
                type="button"
                onClick={() => openEditStudent(dossierQuery.data!)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
              >
                Modifier la fiche
              </button>
              <button
                type="button"
                onClick={() => setArchiveTarget(dossierQuery.data!)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-md cursor-pointer"
              >
                {dossierQuery.data.isArchived ? 'Restaurer' : 'Archiver'}
              </button>
            </>
          ) : undefined
        }
      >
        {dossierQuery.isLoading ? (
          <TableSkeleton rows={4} cols={2} />
        ) : dossierQuery.isError ? (
          <ErrorBanner
            message="Impossible de charger ce dossier élève."
            onRetry={() => dossierQuery.refetch()}
          />
        ) : dossierQuery.data ? (
          <div className="space-y-6">
            {/* Identité & Photo */}
            <div className="flex items-start gap-4 pb-5 border-b border-slate-200 dark:border-slate-700/80">
              {dossierQuery.data.photoUrl ? (
                <img
                  src={dossierQuery.data.photoUrl}
                  alt={`${dossierQuery.data.firstName} ${dossierQuery.data.lastName}`}
                  className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700/80 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xl font-bold shrink-0">
                  {dossierQuery.data.firstName[0]}
                  {dossierQuery.data.lastName[0]}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs flex-1 min-w-0">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Genre</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {dossierQuery.data.gender === 'F' ? 'Féminin' : 'Masculin'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Lieu de naissance</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {dossierQuery.data.placeOfBirth || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Nationalité</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {dossierQuery.data.nationality || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Téléphone / E-mail</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 truncate block">
                    {dossierQuery.data.phone || dossierQuery.data.email || '—'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 dark:text-slate-400 block">Adresse</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {dossierQuery.data.address || '—'}
                  </span>
                </div>
              </div>
            </div>

            {dossierQuery.data.medicalNotes && (
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-md">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Informations médicales</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {dossierQuery.data.medicalNotes}
                </p>
              </div>
            )}

            {/* Inscriptions annuelles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Historique des inscriptions annuelles
                </h3>
                {canWrite && !dossierQuery.data.isArchived && (
                  <button
                    type="button"
                    onClick={openEnrollmentInDrawer}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Inscrire / Réinscrire
                  </button>
                )}
              </div>

              {showNewEnrollForm && (
                <form
                  onSubmit={enrollForm.handleSubmit((vals) => addEnrollmentMutation.mutate(vals))}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Année scolaire
                      </label>
                      <select
                        {...enrollForm.register('academicYearId', { valueAsNumber: true })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                      >
                        <option value={0}>Choisir...</option>
                        {activeYears.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Classe d’affectation
                      </label>
                      <select
                        {...enrollForm.register('classId', { valueAsNumber: true })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                      >
                        <option value={0}>Choisir...</option>
                        {classesForDrawerYear.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.enrolledCount}/{c.capacity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewEnrollForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={addEnrollmentMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded cursor-pointer"
                    >
                      Valider l’inscription
                    </button>
                  </div>
                </form>
              )}

              {dossierQuery.data.enrollments.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3 border border-dashed border-slate-200 dark:border-slate-700/80 rounded text-center">
                  Aucune inscription enregistrée pour cet élève.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
                  {dossierQuery.data.enrollments.map((enr) => {
                    const sameYearClasses =
                      classesQuery.data?.items.filter(
                        (c) => !c.isArchived && c.academicYearId === enr.academicYearId
                      ) ?? [];

                    return (
                      <div
                        key={enr.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {enr.className} · {enr.levelName}
                            {enr.seriesName ? ` (${enr.seriesName})` : ''}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            Année {enr.academicYearName} · Inscrit le {enr.enrollmentDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canWrite && enr.academicYearStatus !== 'CLOSED' ? (
                            <>
                              <select
                                aria-label="Changer de classe"
                                value={enr.classId}
                                onChange={(e) => {
                                  const nextClassId = Number(e.target.value);
                                  if (nextClassId !== enr.classId) {
                                    updateEnrollmentClassMutation.mutate({
                                      enrollmentId: enr.id,
                                      classId: nextClassId,
                                    });
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                              >
                                {sameYearClasses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Statut d’inscription"
                                value={enr.status}
                                onChange={(e) =>
                                  updateEnrollmentClassMutation.mutate({
                                    enrollmentId: enr.id,
                                    status: e.target.value as EnrollmentStatus,
                                  })
                                }
                                className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                              >
                                <option value="ACTIVE">Inscrit</option>
                                <option value="TRANSFERRED">Transféré</option>
                                <option value="WITHDRAWN">Retiré</option>
                                <option value="COMPLETED">Terminé</option>
                              </select>
                            </>
                          ) : (
                            <span className="font-medium text-slate-600 dark:text-slate-400">
                              {ENROLLMENT_STATUS_LABELS[enr.status]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Responsables légaux */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Parents & Responsables légaux
                </h3>
                <Link
                  to="/guardians"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Gérer dans Parents & Tuteurs
                </Link>
              </div>

              {dossierQuery.data.guardians.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3 border border-dashed border-slate-200 dark:border-slate-700/80 rounded text-center">
                  Aucun responsable légal associé à cet élève.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md">
                  {dossierQuery.data.guardians.map((g) => (
                    <div key={g.guardianId} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {g.firstName} {g.lastName}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {RELATIONSHIP_LABELS[g.relationship] ?? g.relationship}
                          {g.isPrimaryContact ? ' · Contact principal' : ''}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        {g.phone}
                        {g.email ? ` · ${g.email}` : ''}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {g.hasLegalCustody ? 'Autorité parentale' : 'Sans autorité parentale'} ·{' '}
                        {g.canPickup ? 'Autorisé à récupérer l’élève' : 'Sortie non autorisée'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DetailDrawer>

      {/* Modal Création / Modification d'élève */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingStudent
                  ? `Modifier le dossier · ${editingStudent.matricule}`
                  : 'Inscrire un nouvel élève'}
              </h2>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={studentForm.handleSubmit((vals) => saveStudentMutation.mutate(vals))}
              className="p-6 space-y-5 overflow-y-auto flex-1"
            >
              {/* Photo */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                {watchFormPhoto ? (
                  <img
                    src={watchFormPhoto}
                    alt="Aperçu élève"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700/80 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer">
                      Choisir une photo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                      />
                    </label>
                    {watchFormPhoto && (
                      <button
                        type="button"
                        onClick={() => studentForm.setValue('photoUrl', null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Retirer
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    JPEG, PNG ou WebP · Redimensionné automatiquement pour le trombinoscope.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Prénom *</label>
                  <input
                    type="text"
                    {...studentForm.register('firstName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {studentForm.formState.errors.firstName && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {studentForm.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
                  <input
                    type="text"
                    {...studentForm.register('lastName')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {studentForm.formState.errors.lastName && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {studentForm.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Genre *</label>
                  <select
                    {...studentForm.register('gender')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                  >
                    <option value="F">Féminin</option>
                    <option value="M">Masculin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date de naissance *
                  </label>
                  <input
                    type="date"
                    {...studentForm.register('dateOfBirth')}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                  {studentForm.formState.errors.dateOfBirth && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {studentForm.formState.errors.dateOfBirth.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Lieu de naissance
                  </label>
                  <input
                    type="text"
                    {...studentForm.register('placeOfBirth')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nationalité
                  </label>
                  <input
                    type="text"
                    {...studentForm.register('nationality')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    {...studentForm.register('phone')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    {...studentForm.register('email')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
                <input
                  type="text"
                  {...studentForm.register('address')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes médicales / Allergies
                </label>
                <textarea
                  rows={2}
                  {...studentForm.register('medicalNotes')}
                  placeholder="Allergies, PAI, observations particulières..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700/80 rounded-md"
                />
              </div>

              {!editingStudent && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md space-y-3">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Affectation immédiate en classe (optionnel)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Année scolaire
                      </label>
                      <select
                        {...studentForm.register('enrollYearId', { valueAsNumber: true })}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md"
                      >
                        <option value={0}>Ne pas affecter maintenant</option>
                        {activeYears.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Classe
                      </label>
                      <select
                        disabled={watchFormYearId === 0}
                        {...studentForm.register('enrollClassId', { valueAsNumber: true })}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                      >
                        <option value={0}>Sélectionner une classe...</option>
                        {classesForFormYear.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.enrolledCount}/{c.capacity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveStudentMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {saveStudentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Importation CSV d’élèves
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Séparateur point-virgule (;) ou virgule (,). Les matricules manquants sont générés automatiquement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded cursor-pointer">
                Charger un fichier .csv
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setCsvText(await file.text());
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setCsvText(SAMPLE_CSV)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
              >
                Insérer un exemple CSV
              </button>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="firstName;lastName;gender;dateOfBirth;placeOfBirth;nationality;phone;email;address"
              className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Inscrire dans l’année (optionnel)
                </label>
                <select
                  value={importYearId}
                  onChange={(e) => {
                    setImportYearId(Number(e.target.value));
                    setImportClassId(0);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded"
                >
                  <option value={0}>Aucune inscription immédiate</option>
                  {activeYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Classe cible
                </label>
                <select
                  disabled={importYearId === 0}
                  value={importClassId}
                  onChange={(e) => setImportClassId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded disabled:bg-slate-100 dark:disabled:bg-slate-800/70"
                >
                  <option value={0}>Sélectionner une classe...</option>
                  {classesForImportYear.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.enrolledCount}/{c.capacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {importResult && (
              <div className="p-4 border border-slate-200 dark:border-slate-700/80 rounded-md bg-slate-50 dark:bg-slate-800/60 space-y-2 text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Résultat : {importResult.createdCount} créé(s) sur {importResult.totalRows}{' '}
                  ligne(s) · {importResult.errorCount} erreur(s)
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="space-y-1 text-red-700 dark:text-red-400 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Ligne {err.row} : {err.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-md cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={importMutation.isPending || csvText.trim().length < 5}
                onClick={() => importMutation.mutate()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer disabled:opacity-50"
              >
                {importMutation.isPending ? 'Importation...' : 'Lancer l’import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title={
          archiveTarget?.isArchived
            ? `Restaurer ${archiveTarget.firstName} ${archiveTarget.lastName} ?`
            : `Archiver ${archiveTarget?.firstName} ${archiveTarget?.lastName} ?`
        }
        description={
          archiveTarget?.isArchived
            ? 'Le dossier élève redeviendra actif dans les listes.'
            : 'Le dossier sera archivé tout en préservant l’historique de ses inscriptions et bulletins.'
        }
        confirmLabel={archiveTarget?.isArchived ? 'Restaurer' : 'Archiver'}
        danger={!archiveTarget?.isArchived}
        isPending={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />
    </AppLayout>
  );
}
