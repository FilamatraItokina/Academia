export type ReportCardStatus = 'DRAFT' | 'VALIDATED';

export interface ReportCardSubjectLine {
  id: number;
  classSubjectId: number;
  subjectCode: string;
  subjectName: string;
  teacherFullName: string | null;
  coefficient: number;
  subjectAverage: number | null;
  classSubjectAverage: number | null;
  teacherRemark: string;
}

export interface ReportCardItem {
  id: number;
  studentId: number;
  studentMatricule: string;
  studentFirstName: string;
  studentLastName: string;
  studentDateOfBirth: string;
  classId: number;
  className: string;
  levelName: string;
  termId: number;
  termName: string;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: string;
  generalAverage: number | null;
  classAverage: number | null;
  rank: number | null;
  totalStudents: number;
  absencesCount: number;
  latesCount: number;
  honorMention: string;
  councilRemark: string;
  status: ReportCardStatus;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardDetail extends ReportCardItem {
  subjects: ReportCardSubjectLine[];
}

export interface ClassReportCardsResponse {
  classInfo: {
    id: number;
    name: string;
    levelName: string;
    academicYearName: string;
    academicYearStatus: string;
  };
  termInfo: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
  };
  items: ReportCardItem[];
  stats: {
    totalCards: number;
    validatedCount: number;
    draftCount: number;
    classAverage: number | null;
  };
}

export interface MyReportCardsResponse {
  students: Array<{
    id: number;
    matricule: string;
    firstName: string;
    lastName: string;
  }>;
  items: ReportCardItem[];
}
