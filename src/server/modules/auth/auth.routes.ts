import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import { updateProfileSchema } from './auth.schema.ts';
import * as authService from './auth.service.ts';

export const authRouter = Router();

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.currentUser });
});

authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Données de profil invalides.', parsed.error.flatten());
    }
    const updated = await authService.updateOwnProfile(
      req.currentUser!.id,
      parsed.data,
      req.ip
    );
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/session-audit', requireAuth, async (req, res, next) => {
  try {
    const event = req.body?.event === 'AUTH_LOGOUT' ? 'AUTH_LOGOUT' : 'AUTH_LOGIN';
    await authService.logSessionEvent(req.currentUser!, event, req.ip);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
