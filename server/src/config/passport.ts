import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import env from './env';

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj as Express.User));

if (env.googleClientId && env.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl ?? 'http://localhost:5000/api/v1/auth/google/callback',
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile),
    ),
  );
}

if (env.facebookClientId && env.facebookClientSecret) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: env.facebookClientId,
        clientSecret: env.facebookClientSecret,
        callbackURL: env.facebookCallbackUrl ?? 'http://localhost:5000/api/v1/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile),
    ),
  );
}

export default passport;