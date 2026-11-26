export type AssessmentType = 'QUIZ' | 'TEST' | 'EXAM' | 'ORAL' | 'PRACTICAL';

export interface AssessmentItem {
  id: number;
  classSubjectId: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectCoefficient: number;
  teacherId: number | null;
  teacherFullName: string | null;
  termId: number;
  termName: string;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  description: string;
  isPublished: boolean;
  gradedCount: number;
  absentCount: number;
  enrolledCount: number;
  averageOn20: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GradeSheetRow {
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  gradeId: number | null;
  score: number | null;
  isAbsent: boolean;
  comment: string;
  normalizedOn20: number | null;
  updatedAt: string | null;
}

export interface AssessmentSheetResponse {
  assessment: AssessmentItem;
  rows: GradeSheetRow[];
  stats: {
    enrolledCount: number;
    gradedCount: number;
    absentCount: number;
    averageRaw: number | null;
    averageOn20: number | null;
    minScore: number | null;
    maxScore: number | null;
  };
}

export interface StudentSubjectAverage {
  classSubjectId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  teacherFullName: string | null;
  assessmentCount: number;
  averageOn20: number | null;
}

export interface ClassStudentTermSummary {
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  subjectAverages: StudentSubjectAverage[];
  generalAverageOn20: number | null;
  rank: number | null;
}

export interface ClassTermSummaryResponse {
  classInfo: {
    id: number;
    name: string;
    levelName: string;
    academicYearName: string;
  };
  termInfo: {
    id: number;
    name: string;
  };
  subjects: Array<{
    classSubjectId: number;
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    coefficient: number;
    teacherFullName: string | null;
    classAverageOn20: number | null;
  }>;
  students: ClassStudentTermSummary[];
  stats: {
    studentCount: number;
    evaluatedStudentsCount: number;
    classGeneralAverage: number | null;
    highestAverage: number | null;
    lowestAverage: number | null;
  };
}

export interface MyPublishedGradeItem {
  assessmentId: number;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  score: number | null;
  isAbsent: boolean;
  normalizedOn20: number | null;
  comment: string;
}

export interface MySubjectGradesSummary {
  classSubjectId: number;
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  teacherFullName: string | null;
  averageOn20: number | null;
  grades: MyPublishedGradeItem[];
}

export interface MyGradesSummaryResponse {
  students: Array<{
    id: number;
    matricule: string;
    firstName: string;
    lastName: string;
    className: string | null;
  }>;
  selectedStudentId: number | null;
  terms: Array<{ id: number; name: string; isCurrent: boolean }>;
  selectedTermId: number | null;
  generalAverageOn20: number | null;
  subjects: MySubjectGradesSummary[];
}
