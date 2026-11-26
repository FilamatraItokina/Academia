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
  createdAt: Date;
  updatedAt: Date;
}
