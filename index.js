// index.js
// Express demo application showing the OpenID Connect (OIDC) login flow with Google
// using Passport.js and persisting user data with Prisma and SQLite.

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
const log = require('./logger');
const prisma = require('./prismaClient');

dotenv.config();

const app = express();

/**
 * Environment variables used:
 *
 * PORT           - HTTP port (e.g., 3000)
 * BASE_URL       - base URL for the app (e.g., http://localhost:3000 or https://mydomain.com)
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET - Google OAuth / OIDC credentials
 * DATABASE_URL   - used by Prisma (configured in schema.prisma)
 * SESSION_SECRET - secret for express-session
 * LOG_LEVEL      - logger level (debug | info | warn | error)
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(
  /\/$/,
  '',
);

// View engine configuration (Pug templates in ./views).
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

// Session configuration.
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      'set_the_code_on_fire_and_watch_it_burn', // demo-only fallback
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  }),
);

// Session logging for observability.
app.use((req, res, next) => {
  log.session('New HTTP request', {
    method: req.method,
    path: req.path,
    sessionId: req.sessionID,
    isAuthenticated:
      typeof req.isAuthenticated === 'function' && req.isAuthenticated(),
  });
  next();
});

// Passport initialization (handles authentication state on top of the session).
app.use(passport.initialize());
app.use(passport.session());

// Expose user and dev-login flag to all views (always true now).
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.showDevLogin = true;
  next();
});

// Passport Google OAuth 2.0 / OpenID Connect Strategy.
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      log.auth('Received profile from Google', {
        googleProfileId: profile.id,
      });

      const userData = {
        googleId: profile.id,
        email: profile.emails && profile.emails[0]?.value,
        name: profile.displayName,
        picture: profile.photos && profile.photos[0]?.value,
      };

      log.auth('Mapped Google profile to local user data', { userData });

      try {
        const user = await prisma.user.upsert({
          where: { googleId: userData.googleId },
          update: {
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
          },
          create: userData,
        });

        log.auth('User stored in database (Prisma upsert)', {
          userId: user.id,
          email: user.email,
        });
        return done(null, user);
      } catch (err) {
        log.error('Failed to store user in database', { error: err });
        return done(err);
      }
    },
  ),
);

// Serialize only the user id into the session.
passport.serializeUser((user, done) => {
  log.session('Saving user reference into session', { userId: user.id });
  done(null, user.id);
});

// On each request with a session, load the full user record.
passport.deserializeUser(async (id, done) => {
  log.session('Loading user from session', { userId: id });
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    return done(null, user);
  } catch (err) {
    log.error('Error loading user from database during deserializeUser', {
      error: err,
    });
    return done(err);
  }
});

// Route guard for protected endpoints.
function ensureAuthenticated(req, res, next) {
  const isAuth =
    typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  log.auth('Checking if user can access protected route', {
    path: req.originalUrl,
    isAuthenticated: isAuth,
  });

  if (isAuth) {
    log.auth('Access granted to protected route', {
      path: req.originalUrl,
      userId: req.user?.id,
      email: req.user?.email,
    });
    return next();
  }

  log.warn('Access denied, redirecting user to /login', {
    path: req.originalUrl,
  });
  return res.redirect('/login');
}

// Home page.
app.get('/', (req, res) => {
  log.route('Rendering home page (/) for user', {
    userId: req.user?.id,
    email: req.user?.email,
  });
  res.render('index', {
    title: 'OpenID Connect Demo',
  });
});

// Login page.
app.get('/login', (req, res) => {
  log.route('Rendering login page (/login)', {
    userId: req.user?.id,
    email: req.user?.email,
  });
  res.render('login', {
    title: 'Login',
  });
});

// Start the OpenID Connect flow with Google.
app.get(
  '/auth/google',
  (req, res, next) => {
    log.route('Starting Google OpenID Connect flow', {
      path: '/auth/google',
      redirectUri: `${BASE_URL}/auth/google/callback`,
    });
    next();
  },
  passport.authenticate('google', {
    scope: ['openid', 'email', 'profile'],
  }),
);

// Callback endpoint: Google redirects here after user authenticates.
app.get(
  '/auth/google/callback',
  (req, res, next) => {
    log.route('User returned from Google, handling callback', {
      path: '/auth/google/callback',
    });
    next();
  },
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res, next) => {
    log.auth('Google login succeeded, preparing to open session', {
      userId: req.user?.id,
      email: req.user?.email,
    });

    // Guarantee that the session is stored before redirecting.
    req.session.save(err => {
      if (err) {
        log.error('Failed to persist session after Google login', {
          error: err,
        });
        return next(err);
      }
      log.auth('Session saved, redirecting user to dashboard', {
        sessionId: req.sessionID,
      });
      res.redirect('/dashboard');
    });
  },
);

// Protected dashboard.
app.get('/dashboard', ensureAuthenticated, async (req, res, next) => {
  log.route('Rendering protected dashboard', {
    userId: req.user?.id,
    email: req.user?.email,
  });

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.render('dashboard', {
      title: 'Dashboard',
      users,
    });
  } catch (err) {
    log.error('Failed to load users for dashboard', { error: err });
    next(err);
  }
});

// Local logout (RP session only).
app.get('/logout', (req, res, next) => {
  log.route('User requested logout', {
    userId: req.user?.id,
    email: req.user?.email,
  });
  req.logout(err => {
    if (err) {
      log.error('Error while logging user out', { error: err });
      return next(err);
    }
    log.auth('User session closed successfully, redirecting to home', {});
    res.redirect('/');
  });
});

// Dev login always enabled now.
app.get('/dev-login', async (req, res, next) => {
  log.route('Dev login endpoint called (/dev-login)', {});
  const testUser = {
    googleId: 'dev-google-123',
    email: 'dev@example.com',
    name: 'Dev Tester',
    picture: '',
  };
  try {
    const user = await prisma.user.upsert({
      where: { googleId: testUser.googleId },
      update: testUser,
      create: testUser,
    });

    req.login(user, err => {
      if (err) return next(err);
      log.auth('Dev user logged in successfully', {
        userId: user.id,
        email: user.email,
      });
      return res.redirect('/dashboard');
    });
  } catch (err) {
    log.error('Error during dev login', { error: err });
    next(err);
  }
});

// Global error handler.
app.use((err, req, res, next) => {
  log.error('Unhandled error while processing request', {
    path: req.path,
    error: err,
  });

  const status = err.status || 500;
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(status).json({
      status: 'error',
      message: status === 500 ? 'Internal server error' : err.message,
    });
  }

  res.status(status);
  res.render('error', {
    title: 'Erro',
    message: status === 500 ? 'Ocorreu um erro inesperado.' : err.message,
  });
});

// Start HTTP server only when running this file directly.
if (require.main === module) {
  const server = app.listen(PORT, () => {
    log.info(`Server listening on ${BASE_URL}`, {});
    log.info(
      'Login flow ready: /auth/google → /auth/google/callback → /dashboard',
      {},
    );
  });

  const shutdown = async () => {
    log.info('Shutting down server gracefully', {});
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
