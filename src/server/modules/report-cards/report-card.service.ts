import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { findTermById } from '../academic-years/academic-year.repository.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as classRepo from '../classes/class.repository.ts';
import * as gradeRepo from '../grades/grade.repository.ts';
import * as gradeService from '../grades/grade.service.ts';
import { buildReportCardPdfBuffer } from './report-card.pdf.ts';
import * as repo from './report-card.repository.ts';
import type {
  ClassReportCardsQuery,
  GenerateReportCardsInput,
  UpdateReportCardInput,
} from './report-card.schema.ts';
import type {
  ClassReportCardsResponse,
  MyReportCardsResponse,
  ReportCardDetail,
} from './report-card.types.ts';

interface ActorContext {
  id: number;
  email: string;
  roleCodes: string[];
  permissions: string[];
  ipAddress?: string;
}

export function computeHonorMention(generalAverage: number | null): string {
  if (generalAverage === null) return '';
  if (generalAverage >= 16) return 'Félicitations du conseil';
  if (generalAverage >= 14) return 'Tableau d’honneur';
  if (generalAverage >= 12) return 'Encouragements';
  if (generalAverage < 8) return 'Mise en garde travail';
  return '';
}

function isStaffReader(actor: ActorContext): boolean {
  return actor.roleCodes.some((c) =>
    ['ADMIN', 'PRINCIPAL', 'SECRETARY', 'TEACHER', 'SUPERVISOR'].includes(c)
  );
}

export async function listClassReportCards(
  query: ClassReportCardsQuery,
  actor: ActorContext
): Promise<ClassReportCardsResponse> {
  if (!isStaffReader(actor)) {
    throw new ForbiddenError('Accès réservé au personnel et aux enseignants.');
  }

  const [cls, term] = await Promise.all([
    classRepo.findClassById(query.classId),
    findTermById(query.termId),
  ]);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (!term) throw new NotFoundError('Période introuvable.');
  if (term.academicYearId !== cls.academicYearId) {
    throw new ValidationError('Cette période n’appartient pas à l’année scolaire de la classe.');
  }

  const items = await repo.findReportCardsByClassAndTerm(cls.id, term.id);
  const validatedCount = items.filter((i) => i.status === 'VALIDATED').length;
  const avgs = items
    .map((i) => i.generalAverage)
    .filter((v): v is number => v !== null);

  return {
    classInfo: {
      id: cls.id,
      name: cls.name,
      levelName: cls.levelName,
      academicYearName: cls.academicYearName,
      academicYearStatus: cls.academicYearStatus,
    },
    termInfo: {
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    items,
    stats: {
      totalCards: items.length,
      validatedCount,
      draftCount: items.length - validatedCount,
      classAverage:
        avgs.length > 0
          ? Math.round((avgs.reduce((acc, v) => acc + v, 0) / avgs.length) * 100) / 100
          : null,
    },
  };
}

export async function generateClassReportCards(
  input: GenerateReportCardsInput,
  actor: ActorContext
) {
  const [cls, term] = await Promise.all([
    classRepo.findClassById(input.classId),
    findTermById(input.termId),
  ]);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (!term) throw new NotFoundError('Période introuvable.');
  if (cls.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Impossible de générer des bulletins sur une année clôturée.');
  }
  if (term.academicYearId !== cls.academicYearId) {
    throw new ValidationError('La période choisie ne correspond pas à l’année scolaire de la classe.');
  }

  const [termSummary, attendanceMap] = await Promise.all([
    gradeService.getClassTermSummary(
      { classId: cls.id, termId: term.id },
      { id: actor.id, email: actor.email, roleCodes: actor.roleCodes }
    ),
    repo.findStudentTermAttendanceCounts(cls.id, term.startDate, term.endDate),
  ]);

  if (termSummary.students.length === 0) {
    throw new ValidationError(`Aucun élève actif inscrit dans ${cls.name}.`);
  }

  const classSubjectAvgMap = new Map(
    termSummary.subjects.map((s) => [s.classSubjectId, s.classAverageOn20])
  );

  const cardsPayload = termSummary.students.map((st) => {
    const att = attendanceMap.get(st.studentId) ?? { absencesCount: 0, latesCount: 0 };
    return {
      studentId: st.studentId,
      generalAverage: st.generalAverageOn20,
      rank: st.rank,
      absencesCount: att.absencesCount,
      latesCount: att.latesCount,
      suggestedMention: computeHonorMention(st.generalAverageOn20),
      subjectLines: st.subjectAverages.map((sa) => ({
        classSubjectId: sa.classSubjectId,
        subjectAverage: sa.averageOn20,
        classSubjectAverage: classSubjectAvgMap.get(sa.classSubjectId) ?? null,
        coefficient: sa.coefficient,
      })),
    };
  });

  const result = await repo.upsertGeneratedReportCards({
    classId: cls.id,
    termId: term.id,
    classAverage: termSummary.stats.classGeneralAverage,
    totalStudents: termSummary.students.length,
    cards: cardsPayload,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'REPORT_CARDS_GENERATED',
    entityType: 'CLASS',
    entityId: String(cls.id),
    details: {
      className: cls.name,
      termName: term.name,
      ...result,
    },
    ipAddress: actor.ipAddress,
  });

  return result;
}

async function assertCanAccessReportCard(
  detail: ReportCardDetail,
  actor: ActorContext
): Promise<void> {
  if (isStaffReader(actor)) return;

  const accessible = await gradeRepo.findAccessibleStudentsForUser(
    actor.id,
    actor.roleCodes
  );
  const ownsStudent = accessible.some((s) => s.id === detail.studentId);
  if (!ownsStudent || detail.status !== 'VALIDATED') {
    throw new ForbiddenError('Accès refusé à ce bulletin scolaire.');
  }
}

export async function getReportCardDetail(
  id: number,
  actor: ActorContext
): Promise<ReportCardDetail> {
  const detail = await repo.findReportCardDetailById(id);
  if (!detail) throw new NotFoundError('Bulletin introuvable.');
  await assertCanAccessReportCard(detail, actor);
  return detail;
}

export async function updateReportCard(
  id: number,
  input: UpdateReportCardInput,
  actor: ActorContext
): Promise<ReportCardDetail> {
  const detail = await repo.findReportCardDetailById(id);
  if (!detail) throw new NotFoundError('Bulletin introuvable.');
  if (detail.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : modification impossible.');
  }
  if (detail.status === 'VALIDATED') {
    throw new ForbiddenError('Ce bulletin est déjà validé. Rouvrez-le en brouillon pour le modifier.');
  }

  const canManageAll = actor.permissions.includes('report_cards:manage');
  if (!canManageAll) {
    if (!actor.roleCodes.includes('TEACHER')) {
      throw new ForbiddenError('Modification non autorisée.');
    }
    if (input.honorMention !== undefined || input.councilRemark !== undefined) {
      throw new ForbiddenError(
        'Seule la direction peut modifier la mention ou l’appréciation générale du conseil.'
      );
    }
    if (input.subjectRemarks && input.subjectRemarks.length > 0) {
      const teacher = await gradeRepo.findTeacherByUserId(actor.id);
      if (!teacher) {
        throw new ForbiddenError('Compte enseignant non rattaché à une fiche professeur.');
      }
      // Verify teacher owns every subject remark being edited
      const allowedSubjectIds = new Set<number>();
      for (const s of detail.subjects) {
        const ctx = await gradeRepo.findClassSubjectContext(s.classSubjectId);
        if (ctx?.teacherId === teacher.id) {
          allowedSubjectIds.add(s.classSubjectId);
        }
      }
      for (const rem of input.subjectRemarks) {
        if (!allowedSubjectIds.has(rem.classSubjectId)) {
          throw new ForbiddenError(
            'Vous ne pouvez rédiger une appréciation que dans vos matières affectées.'
          );
        }
      }
    }
  }

  await repo.updateReportCardFieldsAndRemarks(id, input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'REPORT_CARD_UPDATED',
    entityType: 'REPORT_CARD',
    entityId: String(id),
    details: {
      studentMatricule: detail.studentMatricule,
      termName: detail.termName,
    },
    ipAddress: actor.ipAddress,
  });

  const updated = await repo.findReportCardDetailById(id);
  if (!updated) throw new NotFoundError('Bulletin introuvable.');
  return updated;
}

export async function validateReportCard(
  id: number,
  actor: ActorContext
): Promise<ReportCardDetail> {
  const detail = await repo.findReportCardDetailById(id);
  if (!detail) throw new NotFoundError('Bulletin introuvable.');
  if (detail.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée.');
  }

  await repo.setReportCardStatus(id, 'VALIDATED', actor.id);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'REPORT_CARD_VALIDATED',
    entityType: 'REPORT_CARD',
    entityId: String(id),
    details: { studentMatricule: detail.studentMatricule, termName: detail.termName },
    ipAddress: actor.ipAddress,
  });

  const updated = await repo.findReportCardDetailById(id);
  if (!updated) throw new NotFoundError('Bulletin introuvable.');
  return updated;
}

export async function reopenReportCard(
  id: number,
  actor: ActorContext
): Promise<ReportCardDetail> {
  const detail = await repo.findReportCardDetailById(id);
  if (!detail) throw new NotFoundError('Bulletin introuvable.');
  if (detail.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée.');
  }

  await repo.setReportCardStatus(id, 'DRAFT', null);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'REPORT_CARD_REOPENED',
    entityType: 'REPORT_CARD',
    entityId: String(id),
    details: { studentMatricule: detail.studentMatricule, termName: detail.termName },
    ipAddress: actor.ipAddress,
  });

  const updated = await repo.findReportCardDetailById(id);
  if (!updated) throw new NotFoundError('Bulletin introuvable.');
  return updated;
}

export async function validateAllClassCards(
  input: GenerateReportCardsInput,
  actor: ActorContext
): Promise<{ validatedCount: number }> {
  const cls = await classRepo.findClassById(input.classId);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (cls.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée.');
  }

  const validatedCount = await repo.validateAllDraftCardsForClassTerm(
    input.classId,
    input.termId,
    actor.id
  );

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'REPORT_CARDS_CLASS_VALIDATED',
    entityType: 'CLASS',
    entityId: String(input.classId),
    details: { className: cls.name, termId: input.termId, validatedCount },
    ipAddress: actor.ipAddress,
  });

  return { validatedCount };
}

export async function listMyValidatedReportCards(
  actor: ActorContext
): Promise<MyReportCardsResponse> {
  const accessible = await gradeRepo.findAccessibleStudentsForUser(
    actor.id,
    actor.roleCodes
  );
  const items = await repo.findValidatedReportCardsByStudentIds(
    accessible.map((s) => s.id)
  );

  return {
    students: accessible.map((s) => ({
      id: s.id,
      matricule: s.matricule,
      firstName: s.firstName,
      lastName: s.lastName,
    })),
    items,
  };
}

export async function generateReportCardPdf(
  id: number,
  actor: ActorContext
): Promise<{ buffer: Buffer; filename: string }> {
  const detail = await repo.findReportCardDetailById(id);
  if (!detail) throw new NotFoundError('Bulletin introuvable.');
  await assertCanAccessReportCard(detail, actor);

  const school = await repo.getSchoolHeaderSettings();
  const buffer = await buildReportCardPdfBuffer(detail, school);

  const safeMatricule = detail.studentMatricule.replace(/[^A-Za-z0-9_-]/g, '');
  const safeTerm = detail.termName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '_');

  return {
    buffer,
    filename: `bulletin-${safeMatricule}-${safeTerm}.pdf`,
  };
}
