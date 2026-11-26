export interface RoleSummary {
  id: number;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
}

export interface UserProfile {
  id: number;
  uid: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleSummary[];
  permissions: string[];
}

export interface RoleWithPermissions extends RoleSummary {
  permissionCodes: string[];
  userCount: number;
}

export interface PermissionItem {
  id: number;
  code: string;
  module: string;
  description: string;
}

export interface SchoolSettings {
  id: number;
  schoolName: string;
  schoolType: 'COLLEGE' | 'LYCEE' | 'LYCEE_COLLEGE';
  academicSystem: 'TRIMESTER' | 'SEMESTER';
  gradingScale: number;
  currency: string;
  address: string;
  phone: string;
  email: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: number;
  actorUserId: number | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type AcademicYearStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type TermType = 'TRIMESTER' | 'SEMESTER';

export interface TermItem {
  id: number;
  academicYearId: number;
  name: string;
  termType: TermType;
  orderIndex: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface AcademicYearItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  closedAt: string | null;
  terms: TermItem[];
}

export type EducationCycle = 'COLLEGE' | 'LYCEE';
export type RoomType = 'CLASSROOM' | 'LAB' | 'IT_ROOM' | 'EXAM_HALL';

export interface LevelItem {
  id: number;
  code: string;
  name: string;
  cycle: EducationCycle;
  orderIndex: number;
}

export interface SeriesItem {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface ClassroomItem {
  id: number;
  code: string;
  name: string;
  building: string;
  capacity: number;
  roomType: RoomType;
  isActive: boolean;
}

export interface ClassItem {
  id: number;
  name: string;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: AcademicYearStatus;
  levelId: number;
  levelCode: string;
  levelName: string;
  levelCycle: EducationCycle;
  seriesId: number | null;
  seriesCode: string | null;
  seriesName: string | null;
  classroomId: number | null;
  classroomCode: string | null;
  classroomName: string | null;
  classroomCapacity: number | null;
  capacity: number;
  enrolledCount: number;
  isArchived: boolean;
}

export type Gender = 'M' | 'F';
export type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'COMPLETED';

export interface EnrollmentItem {
  id: number;
  studentId: number;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: AcademicYearStatus;
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
  relationship: 'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN' | 'OTHER';
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
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentEnrollment: EnrollmentItem | null;
}

export interface StudentDossier extends StudentItem {
  enrollments: EnrollmentItem[];
  guardians: StudentGuardianSummary[];
}

export interface ClassRosterStudent {
  enrollmentId: number;
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
}

export interface CsvImportSummary {
  totalRows: number;
  createdCount: number;
  errorCount: number;
  errors: Array<{ row: number; reason: string }>;
}

export type ContractType = 'PERMANENT' | 'CONTRACT' | 'PART_TIME';

export interface TeacherItem {
  id: number;
  employeeCode: string;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialty: string;
  qualification: string;
  contractType: ContractType;
  hireDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN' | 'OTHER';

export interface LinkedStudentItem {
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  currentClassName: string | null;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
  hasLegalCustody: boolean;
  canPickup: boolean;
}

export interface GuardianItem {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  address: string;
  profession: string;
  createdAt: string;
  updatedAt: string;
  students: LinkedStudentItem[];
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface DailyAbsenteeItem {
  attendanceId: number;
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  classId: number;
  className: string;
  levelName: string;
  status: 'ABSENT' | 'EXCUSED';
  isJustified: boolean;
  reason: string;
  primaryGuardianName: string | null;
  primaryGuardianPhone: string | null;
  updatedAt: string;
}

export interface DailyAttendanceSummary {
  date: string;
  academicYearId: number | null;
  academicYearName: string | null;
  totalEnrolledStudents: number;
  recordedCount: number;
  presentCount: number;
  absentCount: number;
  unjustifiedAbsentCount: number;
  excusedCount: number;
  lateCount: number;
  absenteeismRate: number;
  absentees: DailyAbsenteeItem[];
  lastUpdatedAt: string;
}

export interface ClassRollStudentItem {
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  attendanceId: number | null;
  status: AttendanceStatus | null;
  isJustified: boolean;
  reason: string;
}

export type SchoolEventCategory = 'EXAM' | 'MEETING' | 'HOLIDAY' | 'OTHER';
export type EventTargetAudience = 'ALL' | 'STAFF' | 'TEACHERS' | 'STUDENTS_PARENTS';

export interface SchoolEventItem {
  id: number;
  title: string;
  category: SchoolEventCategory;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  location: string;
  targetAudience: EventTargetAudience;
  academicYearId: number | null;
  academicYearName: string | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  daysUntil: number;
  isOngoing: boolean;
  isUrgent: boolean;
}

export interface UpcomingEventsSummary {
  totalUpcoming: number;
  withinSevenDays: number;
  examCount: number;
  meetingCount: number;
  holidayCount: number;
  otherCount: number;
}

export interface UpcomingEventsResponse {
  items: SchoolEventItem[];
  summary: UpcomingEventsSummary;
}

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
    academicYearStatus: AcademicYearStatus;
    levelName: string;
    seriesName: string | null;
    enrolledCount: number;
  };
  items: ClassSubjectItem[];
  summary: CurriculumSummary;
}



