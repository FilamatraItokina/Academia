export interface SubjectItem {
  id: number;
  code: string;
  name: string;
  department: string;
  defaultCoefficient: number;
  description: string;
  isActive: boolean;
  assignedClassCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubjectItem {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectDepartment: string;
  subjectIsActive: boolean;
  teacherId: number | null;
  teacherEmployeeCode: string | null;
  teacherFullName: string | null;
  teacherSpecialty: string | null;
  coefficient: number;
  weeklyHours: number;
  isOptional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumSummary {
  subjectCount: number;
  mandatoryCount: number;
  optionalCount: number;
  totalCoefficient: number;
  totalWeeklyHours: number;
  assignedTeachersCount: number;
  unassignedTeachersCount: number;
}

export interface ClassCurriculumResponse {
  classInfo: {
    id: number;
    name: string;
    academicYearId: number;
    academicYearName: string;
    academicYearStatus: string;
    levelName: string;
    seriesName: string | null;
    enrolledCount: number;
  };
  items: ClassSubjectItem[];
  summary: CurriculumSummary;
}
