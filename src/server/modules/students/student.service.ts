import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import * as yearRepo from '../academic-years/academic-year.repository.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as classRepo from '../classes/class.repository.ts';
import * as repo from './student.repository.ts';
import type {
  CreateEnrollmentInput,
  CreateStudentInput,
  ImportCsvStudentsInput,
  ListStudentsQuery,
  UpdateEnrollmentInput,
  UpdateStudentInput,
} from './student.schema.ts';
import type {
  CsvImportRowResult,
  EnrollmentItem,
  StudentDossier,
  StudentItem,
} from './student.types.ts';

function sanitizeCsvCell(value: string | null | undefined): string {
  const raw = (value ?? '').replace(/\r?\n/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function serializeStudentsCsv(items: StudentItem[]): string {
  const header = [
    'Matricule',
    'Nom',
    'Prénom',
    'Sexe',
    'Date de naissance',
    'Classe actuelle',
    'Année scolaire',
    'Téléphone',
    'Email',
    'Adresse',
  ].join(';');

  const lines = items.map((s) =>
    [
      sanitizeCsvCell(s.matricule),
      sanitizeCsvCell(s.lastName),
      sanitizeCsvCell(s.firstName),
      sanitizeCsvCell(s.gender),
      sanitizeCsvCell(s.dateOfBirth),
      sanitizeCsvCell(s.currentEnrollment?.className ?? ''),
      sanitizeCsvCell(s.currentEnrollment?.academicYearName ?? ''),
      sanitizeCsvCell(s.phone),
      sanitizeCsvCell(s.email),
      sanitizeCsvCell(s.address),
    ].join(';')
  );

  return `\uFEFF${[header, ...lines].join('\n')}`;
}

export function parseCsvLines(csvContent: string): string[][] {
  const rows: string[][] = [];
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return rows;
  const delimiter = rawLines[0].includes(';') ? ';' : ',';

  for (const line of rawLines) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

async function assertClassAvailableForEnrollment(
  academicYearId: number,
  classId: number
): Promise<void> {
  const [year, cls] = await Promise.all([
    yearRepo.findAcademicYearById(academicYearId),
    classRepo.findClassById(classId),
  ]);

  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Impossible d’inscrire un élève dans une année scolaire clôturée.');
  }
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (cls.academicYearId !== academicYearId) {
    throw new ValidationError('La classe sélectionnée n’appartient pas à cette année scolaire.');
  }
  if (cls.isArchived) {
    throw new ValidationError('Impossible d’inscrire un élève dans une classe archivée.');
  }

  const activeCount = await repo.countActiveEnrollmentsInClass(classId);
  if (activeCount >= cls.capacity) {
    throw new ConflictError(
      `La classe « ${cls.name} » a atteint sa capacité maximale (${cls.capacity} élèves).`
    );
  }
}

export async function listStudents(
  query: ListStudentsQuery
): Promise<PaginatedResult<StudentItem>> {
  const { items, total } = await repo.findStudents(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function exportStudentsCsv(query: ListStudentsQuery): Promise<string> {
  const { items } = await repo.findStudents({ ...query, page: 1, limit: 1000 });
  return serializeStudentsCsv(items);
}

export async function getStudentDossier(id: number): Promise<StudentDossier> {
  const dossier = await repo.findStudentDossierById(id);
  if (!dossier) throw new NotFoundError('Dossier élève introuvable.');
  return dossier;
}

export async function createStudent(
  input: CreateStudentInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<StudentDossier> {
  const matricule =
    input.matricule && input.matricule.length > 0
      ? input.matricule.toUpperCase()
      : await repo.generateNextMatricule();

  const dup = await repo.findStudentByMatricule(matricule);
  if (dup) {
    throw new ConflictError(`Un élève avec le matricule « ${matricule} » existe déjà.`);
  }

  if (input.initialEnrollment) {
    await assertClassAvailableForEnrollment(
      input.initialEnrollment.academicYearId,
      input.initialEnrollment.classId
    );
  }

  const dossier = await repo.createStudentTransaction({
    matricule,
    input,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'STUDENT_CREATED',
    entityType: 'student',
    entityId: dossier.id,
    details: {
      matricule: dossier.matricule,
      fullName: `${dossier.firstName} ${dossier.lastName}`,
      enrolledClassId: input.initialEnrollment?.classId ?? null,
    },
    ipAddress: actor.ipAddress,
  });

  return dossier;
}

export async function updateStudent(
  id: number,
  input: UpdateStudentInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<StudentDossier> {
  const existing = await repo.findStudentDossierById(id);
  if (!existing) throw new NotFoundError('Dossier élève introuvable.');

  const updated = await repo.updateStudentRecord(id, input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: input.isArchived !== undefined && input.isArchived !== existing.isArchived
      ? input.isArchived
        ? 'STUDENT_ARCHIVED'
        : 'STUDENT_RESTORED'
      : 'STUDENT_UPDATED',
    entityType: 'student',
    entityId: updated.id,
    details: { matricule: updated.matricule, isArchived: updated.isArchived },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function enrollStudent(
  studentId: number,
  input: CreateEnrollmentInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<EnrollmentItem> {
  const student = await repo.findStudentDossierById(studentId);
  if (!student) throw new NotFoundError('Élève introuvable.');
  if (student.isArchived) {
    throw new ForbiddenError('Impossible d’inscrire un élève archivé.');
  }

  const existingYearEnrollment = await repo.findEnrollmentByStudentAndYear(
    studentId,
    input.academicYearId
  );
  if (existingYearEnrollment) {
    throw new ConflictError(
      'Cet élève possède déjà une inscription pour cette année scolaire. Modifiez son inscription existante.'
    );
  }

  await assertClassAvailableForEnrollment(input.academicYearId, input.classId);

  const created = await repo.insertEnrollment({
    studentId,
    academicYearId: input.academicYearId,
    classId: input.classId,
    enrollmentDate: input.enrollmentDate ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? '',
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'STUDENT_ENROLLED',
    entityType: 'enrollment',
    entityId: created.id,
    details: {
      studentId,
      matricule: student.matricule,
      academicYearId: input.academicYearId,
      classId: input.classId,
    },
    ipAddress: actor.ipAddress,
  });

  return created;
}

export async function updateEnrollment(
  enrollmentId: number,
  input: UpdateEnrollmentInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<EnrollmentItem> {
  const existing = await repo.findEnrollmentById(enrollmentId);
  if (!existing) throw new NotFoundError('Inscription introuvable.');

  const year = await yearRepo.findAcademicYearById(existing.academicYearId);
  if (year?.status === 'CLOSED') {
    throw new ForbiddenError('Impossible de modifier une inscription d’une année clôturée.');
  }

  if (input.classId && input.classId !== existing.classId) {
    await assertClassAvailableForEnrollment(existing.academicYearId, input.classId);
  }

  const updated = await repo.updateEnrollmentRecord(enrollmentId, existing.studentId, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ENROLLMENT_UPDATED',
    entityType: 'enrollment',
    entityId: updated.id,
    details: { classId: updated.classId, status: updated.status },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function importStudentsFromCsv(
  input: ImportCsvStudentsInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<{ imported: number; failed: number; results: CsvImportRowResult[] }> {
  const rows = parseCsvLines(input.csvContent);
  if (rows.length < 2) {
    throw new ValidationError(
      'Le fichier CSV doit contenir une ligne d’en-tête et au moins un élève.'
    );
  }

  if (input.academicYearId && input.classId) {
    await assertClassAvailableForEnrollment(input.academicYearId, input.classId);
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  const colIndex = (aliases: string[]): number =>
    headers.findIndex((h) => aliases.some((a) => h.includes(a)));

  const idxLast = colIndex(['nom', 'last']);
  const idxFirst = colIndex(['prénom', 'prenom', 'first']);
  const idxGender = colIndex(['sexe', 'genre', 'gender']);
  const idxDob = colIndex(['naissance', 'birth', 'dob']);
  const idxPhone = colIndex(['tél', 'tel', 'phone']);
  const idxEmail = colIndex(['mail', 'email']);
  const idxAddress = colIndex(['adresse', 'address']);

  if (idxLast === -1 || idxFirst === -1 || idxDob === -1) {
    throw new ValidationError(
      'Colonnes obligatoires manquantes : Nom, Prénom, Date de naissance (AAAA-MM-JJ).'
    );
  }

  const results: CsvImportRowResult[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const lastName = cols[idxLast] ?? '';
    const firstName = cols[idxFirst] ?? '';
    const rawGender = (idxGender >= 0 ? cols[idxGender] : 'M').toUpperCase();
    const gender: 'M' | 'F' = rawGender.startsWith('F') ? 'F' : 'M';
    const dateOfBirth = cols[idxDob] ?? '';
    const phone = idxPhone >= 0 ? cols[idxPhone] ?? '' : '';
    const email = idxEmail >= 0 ? cols[idxEmail] ?? '' : '';
    const address = idxAddress >= 0 ? cols[idxAddress] ?? '' : '';

    const fullName = `${firstName} ${lastName}`.trim() || `Ligne ${i + 1}`;

    if (!lastName || !firstName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      failed++;
      results.push({
        rowNumber: i + 1,
        fullName,
        status: 'ERROR',
        message: 'Nom, prénom ou date (AAAA-MM-JJ) invalide.',
      });
      continue;
    }

    try {
      const matricule = await repo.generateNextMatricule();
      const created = await repo.createStudentTransaction({
        matricule,
        input: {
          firstName,
          lastName,
          gender,
          dateOfBirth,
          placeOfBirth: '',
          nationality: '',
          address,
          phone,
          email,
          medicalNotes: '',
          initialEnrollment:
            input.academicYearId && input.classId
              ? {
                  academicYearId: input.academicYearId,
                  classId: input.classId,
                  notes: 'Import CSV',
                }
              : undefined,
        },
      });
      imported++;
      results.push({
        rowNumber: i + 1,
        matricule: created.matricule,
        fullName,
        status: 'CREATED',
        message: 'Inscrit avec succès.',
      });
    } catch (err) {
      failed++;
      results.push({
        rowNumber: i + 1,
        fullName,
        status: 'ERROR',
        message: err instanceof Error ? err.message : 'Erreur d’importation.',
      });
    }
  }

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'STUDENTS_CSV_IMPORTED',
    entityType: 'student',
    details: { imported, failed, totalRows: rows.length - 1 },
    ipAddress: actor.ipAddress,
  });

  return { imported, failed, results };
}
