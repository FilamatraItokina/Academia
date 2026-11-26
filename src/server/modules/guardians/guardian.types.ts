export type GuardianRelationship =
  | 'FATHER'
  | 'MOTHER'
  | 'LEGAL_GUARDIAN'
  | 'OTHER';

export interface LinkedStudentItem {
  studentId: number;
  matricule: string;
  firstName: string;
  lastName: string;
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
  createdAt: Date;
  updatedAt: Date;
  students: LinkedStudentItem[];
}
