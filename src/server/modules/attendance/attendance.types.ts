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
  gender: 'M' | 'F';
  attendanceId: number | null;
  status: AttendanceStatus | null;
  isJustified: boolean;
  reason: string;
}
