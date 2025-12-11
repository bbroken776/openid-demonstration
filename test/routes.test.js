// test/routes.test.js
// Basic integration tests validating route protection, dev login and main pages.

const request = require('supertest');
const { expect } = require('chai');
const app = require('../index');

describe('Auth & route protection', function () {
  it('GET /dashboard without login should redirect to /login', function (done) {
    request(app)
      .get('/dashboard')
      .expect(302)
      .expect('Location', '/login')
      .end(done);
  });

  it('GET / should render home page', function (done) {
    request(app)
      .get('/')
      .expect(200)
      .expect(res => {
        if (!res.text.includes('Visão geral do fluxo OpenID Connect')) {
          throw new Error('Home content not rendered as expected');
        }
      })
      .end(done);
  });

  it('GET /login should render login page', function (done) {
    request(app)
      .get('/login')
      .expect(200)
      .expect(res => {
        if (!res.text.includes('Iniciar sessão com Google')) {
          throw new Error('Login content not rendered as expected');
        }
      })
      .end(done);
  });

  it('Dev login should allow access to dashboard', function (done) {
    if (process.env.NODE_ENV === 'production') return this.skip();

    const agent = request.agent(app);
    agent
      .get('/dev-login')
      .expect(302)
      .expect('Location', '/dashboard')
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/dashboard')
          .expect(200)
          .end(function (err2, res) {
            if (err2) return done(err2);
            expect(res.text).to.include('Dashboard protegido');
            done();
          });
      });
  });

  it('Logout should clear session and re-protect /dashboard', function (done) {
    if (process.env.NODE_ENV === 'production') return this.skip();

    const agent = request.agent(app);

    agent
      .get('/dev-login')
      .expect(302)
      .end(err => {
        if (err) return done(err);

        agent
          .get('/dashboard')
          .expect(200)
          .end((err2) => {
            if (err2) return done(err2);

            agent
              .get('/logout')
              .expect(302)
              .expect('Location', '/')
              .end(err3 => {
                if (err3) return done(err3);

                agent
                  .get('/dashboard')
                  .expect(302)
                  .expect('Location', '/login')
                  .end(done);
              });
          });
      });
  });
});
