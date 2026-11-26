export type Gender = 'M' | 'F';
export type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'COMPLETED';

export interface EnrollmentItem {
  id: number;
  studentId: number;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: string;
  classId: number;
  className: string;
  levelName: string;
  seriesName: string | null;
  enrollmentDate: string;
  status: EnrollmentStatus;
  notes: string;
}

export interface StudentGuardianSummary {
  guardianId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimaryContact: boolean;
  hasLegalCustody: boolean;
  canPickup: boolean;
}

export interface StudentItem {
  id: number;
  matricule: string;
  userId: number | null;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  address: string;
  phone: string;
  email: string;
  photoUrl: string | null;
  medicalNotes: string;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  currentEnrollment: EnrollmentItem | null;
}

export interface StudentDossier extends StudentItem {
  enrollments: EnrollmentItem[];
  guardians: StudentGuardianSummary[];
}

export interface CsvImportRowResult {
  rowNumber: number;
  matricule?: string;
  fullName: string;
  status: 'CREATED' | 'ERROR';
  message: string;
}
