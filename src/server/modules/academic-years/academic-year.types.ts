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
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicYearItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  terms: TermItem[];
}
