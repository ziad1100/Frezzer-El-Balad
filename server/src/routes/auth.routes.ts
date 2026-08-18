import { Router } from 'express';
import passport from '../config/passport';
import * as auth from '../controllers/auth.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { zodBody } from '../middlewares/zod';
import {
  changeEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas';
import env from '../config/env';

const router = Router();

router.post('/register', authLimiter, zodBody(registerSchema), auth.register);
router.post('/login', authLimiter, zodBody(loginSchema), auth.login);
router.post('/logout', auth.logout);
router.post('/refresh', auth.refresh);
router.get('/verify-email', auth.verifyEmail);
router.post('/forgot-password', authLimiter, zodBody(forgotPasswordSchema), auth.forgotPassword);
router.post('/reset-password', authLimiter, zodBody(resetPasswordSchema), auth.resetPassword);
router.post('/change-password', authLimiter, requireAuth, zodBody(changePasswordSchema), auth.changePassword);
router.post('/change-email', authLimiter, requireAuth, requireRole('admin'), zodBody(changeEmailSchema), auth.changeEmail);
router.get('/verify-email-change', authLimiter, auth.verifyEmailChange);
router.get('/me', requireAuth, auth.me);

if (env.googleClientId) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
  );
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.clientUrl}/login?error=google` }),
    auth.socialAuthCallback('google'),
  );
}

if (env.facebookClientId) {
  router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
  router.get(
    '/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: `${env.clientUrl}/login?error=facebook` }),
    auth.socialAuthCallback('facebook'),
  );
}

router.get('/providers', (_req, res) => {
  res.json({
    google: Boolean(env.googleClientId),
    facebook: Boolean(env.facebookClientId),
  });
});

export default router;