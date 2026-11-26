import express from 'express';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.ts';
import { academicYearsRouter } from './modules/academic-years/academic-year.routes.ts';
import { attendanceRouter } from './modules/attendance/attendance.routes.ts';
import { auditRouter } from './modules/audit/audit.routes.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { classesRouter } from './modules/classes/class.routes.ts';
import { docsRouter } from './modules/docs/openapi.ts';
import { eventsRouter } from './modules/events/event.routes.ts';
import { gradesRouter } from './modules/grades/grade.routes.ts';
import { guardiansRouter } from './modules/guardians/guardian.routes.ts';
import { reportCardsRouter } from './modules/report-cards/report-card.routes.ts';
import { settingsRouter } from './modules/settings/settings.routes.ts';
import { studentsRouter } from './modules/students/student.routes.ts';
import { subjectsRouter } from './modules/subjects/subject.routes.ts';
import { teachersRouter } from './modules/teachers/teacher.routes.ts';
import { rolesRouter, usersRouter } from './modules/users/user.routes.ts';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Trop de requêtes effectuées. Veuillez patienter un instant.',
      },
    },
  });

  app.use('/api/v1', apiLimiter);

  app.use('/api/v1/docs', docsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/audit-logs', auditRouter);
  app.use('/api/v1/academic-years', academicYearsRouter);
  app.use('/api/v1/classes', classesRouter);
  app.use('/api/v1/students', studentsRouter);
  app.use('/api/v1/teachers', teachersRouter);
  app.use('/api/v1/guardians', guardiansRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/events', eventsRouter);
  app.use('/api/v1/subjects', subjectsRouter);
  app.use('/api/v1/grades', gradesRouter);
  app.use('/api/v1/report-cards', reportCardsRouter);

  app.use('/api/v1', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: 'Point de terminaison API introuvable.',
      },
    });
  });

  app.use(errorHandler);
  return app;
}
