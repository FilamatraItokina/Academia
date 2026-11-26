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
  academicYearStatus: string;
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
  createdAt: Date;
  updatedAt: Date;
}
