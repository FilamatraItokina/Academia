import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').unique(),
    email: text('email').notNull().unique(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_is_active_idx').on(table.isActive),
  ]
);

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isSystem: boolean('is_system').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  module: text('module').notNull(),
  description: text('description').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    roleId: integer('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);

export const schoolSettings = pgTable('school_settings', {
  id: serial('id').primaryKey(),
  schoolName: text('school_name').notNull().default('Lycée Académia'),
  schoolType: text('school_type').notNull().default('LYCEE_COLLEGE'),
  academicSystem: text('academic_system').notNull().default('TRIMESTER'),
  gradingScale: integer('grading_scale').notNull().default(20),
  currency: text('currency').notNull().default('EUR'),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorUserId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ]
);

// ==========================================
// MODULE 2 : ANNÉES SCOLAIRES & PÉRIODES
// ==========================================

export const academicYears = pgTable(
  'academic_years',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: text('status').notNull().default('DRAFT'), // DRAFT | ACTIVE | CLOSED
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('academic_years_status_idx').on(table.status)]
);

export const terms = pgTable(
  'terms',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    termType: text('term_type').notNull().default('TRIMESTER'), // TRIMESTER | SEMESTER
    orderIndex: integer('order_index').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    isCurrent: boolean('is_current').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('terms_year_order_uidx').on(table.academicYearId, table.orderIndex),
  ]
);

// ==========================================
// MODULE 3 : NIVEAUX, SÉRIES, SALLES & CLASSES
// ==========================================

export const levels = pgTable(
  'levels',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    cycle: text('cycle').notNull().default('COLLEGE'), // COLLEGE | LYCEE
    orderIndex: integer('order_index').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('levels_order_idx').on(table.orderIndex)]
);

export const series = pgTable('series', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classrooms = pgTable('classrooms', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  building: text('building').notNull().default('Bâtiment principal'),
  capacity: integer('capacity').notNull().default(35),
  roomType: text('room_type').notNull().default('CLASSROOM'), // CLASSROOM | LAB | IT_ROOM | EXAM_HALL
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classes = pgTable(
  'classes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id, { onDelete: 'restrict' })
      .notNull(),
    levelId: integer('level_id')
      .references(() => levels.id, { onDelete: 'restrict' })
      .notNull(),
    seriesId: integer('series_id').references(() => series.id, {
      onDelete: 'set null',
    }),
    classroomId: integer('classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    capacity: integer('capacity').notNull().default(35),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('classes_year_name_uidx').on(table.academicYearId, table.name),
    index('classes_level_idx').on(table.levelId),
    index('classes_year_idx').on(table.academicYearId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const academicYearsRelations = relations(academicYears, ({ many }) => ({
  terms: many(terms),
  classes: many(classes),
}));

export const termsRelations = relations(terms, ({ one }) => ({
  academicYear: one(academicYears, {
    fields: [terms.academicYearId],
    references: [academicYears.id],
  }),
}));

export const levelsRelations = relations(levels, ({ many }) => ({
  classes: many(classes),
}));

export const seriesRelations = relations(series, ({ many }) => ({
  classes: many(classes),
}));

export const classroomsRelations = relations(classrooms, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [classes.academicYearId],
    references: [academicYears.id],
  }),
  level: one(levels, {
    fields: [classes.levelId],
    references: [levels.id],
  }),
  series: one(series, {
    fields: [classes.seriesId],
    references: [series.id],
  }),
  classroom: one(classrooms, {
    fields: [classes.classroomId],
    references: [classrooms.id],
  }),
  enrollments: many(enrollments),
}));

// ==========================================
// MODULE 4 : ÉLÈVES & INSCRIPTIONS ANNUELLES
// ==========================================

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    matricule: text('matricule').notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    gender: text('gender').notNull(), // M | F
    dateOfBirth: date('date_of_birth').notNull(),
    placeOfBirth: text('place_of_birth').notNull().default(''),
    nationality: text('nationality').notNull().default(''),
    address: text('address').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    photoUrl: text('photo_url'),
    medicalNotes: text('medical_notes').notNull().default(''),
    isArchived: boolean('is_archived').notNull().default(false),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('students_name_idx').on(table.lastName, table.firstName),
    index('students_archived_idx').on(table.isArchived),
  ]
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id, { onDelete: 'restrict' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'restrict' })
      .notNull(),
    enrollmentDate: date('enrollment_date').notNull(),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | TRANSFERRED | WITHDRAWN | COMPLETED
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('enrollments_student_year_uidx').on(table.studentId, table.academicYearId),
    index('enrollments_class_idx').on(table.classId),
    index('enrollments_year_idx').on(table.academicYearId),
  ]
);

// ==========================================
// MODULE 5 : ENSEIGNANTS
// ==========================================

export const teachers = pgTable(
  'teachers',
  {
    id: serial('id').primaryKey(),
    employeeCode: text('employee_code').notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull().default(''),
    specialty: text('specialty').notNull(),
    qualification: text('qualification').notNull().default(''),
    contractType: text('contract_type').notNull().default('PERMANENT'), // PERMANENT | CONTRACT | PART_TIME
    hireDate: date('hire_date'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('teachers_name_idx').on(table.lastName, table.firstName),
    index('teachers_specialty_idx').on(table.specialty),
  ]
);

// ==========================================
// MODULE 6 : PARENTS & RESPONSABLES LÉGAUX
// ==========================================

export const guardians = pgTable(
  'guardians',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull(),
    secondaryPhone: text('secondary_phone').notNull().default(''),
    address: text('address').notNull().default(''),
    profession: text('profession').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('guardians_name_idx').on(table.lastName, table.firstName)]
);

export const studentGuardians = pgTable(
  'student_guardians',
  {
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    guardianId: integer('guardian_id')
      .references(() => guardians.id, { onDelete: 'cascade' })
      .notNull(),
    relationship: text('relationship').notNull().default('LEGAL_GUARDIAN'), // FATHER | MOTHER | LEGAL_GUARDIAN | OTHER
    isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
    hasLegalCustody: boolean('has_legal_custody').notNull().default(true),
    canPickup: boolean('can_pickup').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.guardianId] })]
);

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  enrollments: many(enrollments),
  studentGuardians: many(studentGuardians),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  academicYear: one(academicYears, {
    fields: [enrollments.academicYearId],
    references: [academicYears.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
}));

export const teachersRelations = relations(teachers, ({ one }) => ({
  user: one(users, { fields: [teachers.userId], references: [users.id] }),
}));

export const guardiansRelations = relations(guardians, ({ one, many }) => ({
  user: one(users, { fields: [guardians.userId], references: [users.id] }),
  studentGuardians: many(studentGuardians),
}));

export const studentGuardiansRelations = relations(studentGuardians, ({ one }) => ({
  student: one(students, {
    fields: [studentGuardians.studentId],
    references: [students.id],
  }),
  guardian: one(guardians, {
    fields: [studentGuardians.guardianId],
    references: [guardians.id],
  }),
}));

// ==========================================
// MODULE 8 (SOCLE TEMPS RÉEL) : PRÉSENCES & ABSENCES
// ==========================================

export const studentAttendances = pgTable(
  'student_attendances',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id, { onDelete: 'restrict' })
      .notNull(),
    attendanceDate: date('attendance_date').notNull(),
    status: text('status').notNull().default('PRESENT'), // PRESENT | ABSENT | LATE | EXCUSED
    reason: text('reason').notNull().default(''),
    isJustified: boolean('is_justified').notNull().default(false),
    recordedByUserId: integer('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('student_attendances_student_date_uidx').on(
      table.studentId,
      table.attendanceDate
    ),
    index('student_attendances_date_status_idx').on(
      table.attendanceDate,
      table.status
    ),
    index('student_attendances_class_date_idx').on(
      table.classId,
      table.attendanceDate
    ),
  ]
);

export const studentAttendancesRelations = relations(studentAttendances, ({ one }) => ({
  student: one(students, {
    fields: [studentAttendances.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [studentAttendances.classId],
    references: [classes.id],
  }),
  academicYear: one(academicYears, {
    fields: [studentAttendances.academicYearId],
    references: [academicYears.id],
  }),
  recordedBy: one(users, {
    fields: [studentAttendances.recordedByUserId],
    references: [users.id],
  }),
}));

// ==========================================
// NOTIFICATIONS & ÉVÉNEMENTS SCOLAIRES À VENIR
// ==========================================

export const schoolEvents = pgTable(
  'school_events',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    category: text('category').notNull().default('OTHER'), // EXAM | MEETING | HOLIDAY | OTHER
    description: text('description').notNull().default(''),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    startTime: text('start_time').notNull().default(''),
    location: text('location').notNull().default(''),
    targetAudience: text('target_audience').notNull().default('ALL'), // ALL | STAFF | TEACHERS | STUDENTS_PARENTS
    academicYearId: integer('academic_year_id').references(() => academicYears.id, {
      onDelete: 'set null',
    }),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('school_events_start_date_idx').on(table.startDate),
    index('school_events_category_idx').on(table.category),
  ]
);

export const schoolEventsRelations = relations(schoolEvents, ({ one }) => ({
  academicYear: one(academicYears, {
    fields: [schoolEvents.academicYearId],
    references: [academicYears.id],
  }),
  createdBy: one(users, {
    fields: [schoolEvents.createdByUserId],
    references: [users.id],
  }),
}));

// ==========================================
// PHASE 2 — MODULE 7 : MATIÈRES, COEFFICIENTS & AFFECTATIONS
// ==========================================

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    department: text('department').notNull().default('Général'),
    defaultCoefficient: numeric('default_coefficient', { precision: 4, scale: 1 })
      .notNull()
      .default('1.0'),
    description: text('description').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('subjects_name_idx').on(table.name),
    index('subjects_department_idx').on(table.department),
  ]
);

export const classSubjects = pgTable(
  'class_subjects',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'restrict' })
      .notNull(),
    teacherId: integer('teacher_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    coefficient: numeric('coefficient', { precision: 4, scale: 1 }).notNull().default('1.0'),
    weeklyHours: numeric('weekly_hours', { precision: 4, scale: 1 }).notNull().default('2.0'),
    isOptional: boolean('is_optional').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('class_subjects_class_subject_uidx').on(table.classId, table.subjectId),
    index('class_subjects_class_idx').on(table.classId),
    index('class_subjects_subject_idx').on(table.subjectId),
    index('class_subjects_teacher_idx').on(table.teacherId),
  ]
);

export const subjectsRelations = relations(subjects, ({ many }) => ({
  classSubjects: many(classSubjects),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one, many }) => ({
  class: one(classes, {
    fields: [classSubjects.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [classSubjects.subjectId],
    references: [subjects.id],
  }),
  teacher: one(teachers, {
    fields: [classSubjects.teacherId],
    references: [teachers.id],
  }),
  assessments: many(assessments),
}));

// ==========================================
// PHASE 2 — MODULE 8 : ÉVALUATIONS & NOTES
// ==========================================

export const assessments = pgTable(
  'assessments',
  {
    id: serial('id').primaryKey(),
    classSubjectId: integer('class_subject_id')
      .references(() => classSubjects.id, { onDelete: 'cascade' })
      .notNull(),
    termId: integer('term_id')
      .references(() => terms.id, { onDelete: 'restrict' })
      .notNull(),
    title: text('title').notNull(),
    assessmentType: text('assessment_type').notNull().default('TEST'), // QUIZ | TEST | EXAM | ORAL | PRACTICAL
    assessmentDate: date('assessment_date').notNull(),
    maxScore: numeric('max_score', { precision: 5, scale: 2 }).notNull().default('20.00'),
    weight: numeric('weight', { precision: 4, scale: 2 }).notNull().default('1.00'),
    description: text('description').notNull().default(''),
    isPublished: boolean('is_published').notNull().default(false),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('assessments_class_subject_idx').on(table.classSubjectId),
    index('assessments_term_idx').on(table.termId),
    index('assessments_date_idx').on(table.assessmentDate),
  ]
);

export const grades = pgTable(
  'grades',
  {
    id: serial('id').primaryKey(),
    assessmentId: integer('assessment_id')
      .references(() => assessments.id, { onDelete: 'cascade' })
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    score: numeric('score', { precision: 6, scale: 2 }),
    isAbsent: boolean('is_absent').notNull().default(false),
    comment: text('comment').notNull().default(''),
    gradedByUserId: integer('graded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('grades_assessment_student_uidx').on(table.assessmentId, table.studentId),
    index('grades_student_idx').on(table.studentId),
  ]
);

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  classSubject: one(classSubjects, {
    fields: [assessments.classSubjectId],
    references: [classSubjects.id],
  }),
  term: one(terms, {
    fields: [assessments.termId],
    references: [terms.id],
  }),
  createdBy: one(users, {
    fields: [assessments.createdByUserId],
    references: [users.id],
  }),
  grades: many(grades),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  assessment: one(assessments, {
    fields: [grades.assessmentId],
    references: [assessments.id],
  }),
  student: one(students, {
    fields: [grades.studentId],
    references: [students.id],
  }),
  gradedBy: one(users, {
    fields: [grades.gradedByUserId],
    references: [users.id],
  }),
}));

// ==========================================
// PHASE 2 — MODULE 9 : BULLETINS SCOLAIRES & PDF
// ==========================================

export const reportCards = pgTable(
  'report_cards',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    classId: integer('class_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),
    termId: integer('term_id')
      .references(() => terms.id, { onDelete: 'restrict' })
      .notNull(),
    generalAverage: numeric('general_average', { precision: 5, scale: 2 }),
    classAverage: numeric('class_average', { precision: 5, scale: 2 }),
    rank: integer('rank'),
    totalStudents: integer('total_students').notNull().default(0),
    absencesCount: integer('absences_count').notNull().default(0),
    latesCount: integer('lates_count').notNull().default(0),
    honorMention: text('honor_mention').notNull().default(''),
    councilRemark: text('council_remark').notNull().default(''),
    status: text('status').notNull().default('DRAFT'), // DRAFT | VALIDATED
    validatedByUserId: integer('validated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    validatedAt: timestamp('validated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('report_cards_student_term_uidx').on(table.studentId, table.termId),
    index('report_cards_class_term_idx').on(table.classId, table.termId),
  ]
);

export const reportCardSubjectRemarks = pgTable(
  'report_card_subject_remarks',
  {
    id: serial('id').primaryKey(),
    reportCardId: integer('report_card_id')
      .references(() => reportCards.id, { onDelete: 'cascade' })
      .notNull(),
    classSubjectId: integer('class_subject_id')
      .references(() => classSubjects.id, { onDelete: 'cascade' })
      .notNull(),
    subjectAverage: numeric('subject_average', { precision: 5, scale: 2 }),
    classSubjectAverage: numeric('class_subject_average', { precision: 5, scale: 2 }),
    coefficient: numeric('coefficient', { precision: 4, scale: 1 }).notNull().default('1.0'),
    teacherRemark: text('teacher_remark').notNull().default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('report_card_remarks_card_cs_uidx').on(
      table.reportCardId,
      table.classSubjectId
    ),
  ]
);

export const reportCardsRelations = relations(reportCards, ({ one, many }) => ({
  student: one(students, {
    fields: [reportCards.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [reportCards.classId],
    references: [classes.id],
  }),
  term: one(terms, {
    fields: [reportCards.termId],
    references: [terms.id],
  }),
  validatedBy: one(users, {
    fields: [reportCards.validatedByUserId],
    references: [users.id],
  }),
  subjectRemarks: many(reportCardSubjectRemarks),
}));

export const reportCardSubjectRemarksRelations = relations(
  reportCardSubjectRemarks,
  ({ one }) => ({
    reportCard: one(reportCards, {
      fields: [reportCardSubjectRemarks.reportCardId],
      references: [reportCards.id],
    }),
    classSubject: one(classSubjects, {
      fields: [reportCardSubjectRemarks.classSubjectId],
      references: [classSubjects.id],
    }),
  })
);




