export type SchoolEventCategory = 'EXAM' | 'MEETING' | 'HOLIDAY' | 'OTHER';

export type EventTargetAudience = 'ALL' | 'STAFF' | 'TEACHERS' | 'STUDENTS_PARENTS';

export interface SchoolEventRecord {
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
}

export interface SchoolEventItem extends SchoolEventRecord {
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
