---
title: Authentication Architecture — One Core, Two Edges, Every Session Revocable
date: 2026-07
tags: [dotnet, security, identity, oauth, sqlserver]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Authentication Architecture — One Core, Two Edges, Every Session Revocable

**Summary:** Designed the authentication architecture for the Partners.com.bd marketplace (ASP.NET
Core Identity, MediatR, SQL Server) around three principles: one core decides *who you are*, each
client edge gets the session artifact safest for its medium (HttpOnly cookie for the server-rendered
web, bearer JWT + rotating refresh for native mobile), and every session — web or mobile — must be
revocable and enumerable server-side. Decided across two accepted ADRs after a four-stream R&D
review. The single-core convergence of the user logins and a full Critical/High hardening set are
shipped and under 832 tests; the revocable-session store and the JWKS signing pivot are sequenced
next — decided, not yet built.

**Problem:** Two clients run on one system — a server-rendered MVC web app (cookie auth) and a
Flutter mobile app on a JWT + refresh API, plus admin on the web — and the auth *decision* had
drifted apart. Mobile and web-password login were on the shared core, but web Google login still ran
through the legacy `OnlineShop.Repository.GoogleSignUp` and admin was still legacy, so a fix in one
place didn't reach the others. Worse, the web session is a stateless self-contained cookie: the whole
Identity ticket is serialized into the cookie, 7-day sliding, no absolute timeout, and the server
keeps **no record** — so it cannot be revoked. A stolen cookie can't be killed, "log out everywhere"
is impossible, an admin can't terminate a compromised account, and there's no active-devices list.
OWASP treats server-side invalidation as mandatory.

**Approach:** One decision core — all auth decisions (credential verify, Google-token validation,
lockout, creation policy, issuance) in `Partners.Application` MediatR handlers over ASP.NET Identity,
every surface routing through it. Two transport edges — the browser gets an HttpOnly + Secure +
SameSite cookie (a server-rendered app has no browser-JS token store, so it already has the BFF
security property), native mobile gets a bearer JWT + rotating refresh (RFC 8252 public client); the
edge translates the core's one decision into the right artifact. Revocable sessions on both edges — a
custom `ITicketStore` moves the web ticket server-side (the cookie carries only an opaque 64-bit
session key; `dbo.UserSession` on SQL Server is the store of record, Redis deferred to a config-only
flip), and mobile refresh tokens carry a `FamilyId` so a reused token revokes the whole family —
unified into one enumerable "Active Sessions & Devices" model. And a JWKS issuer boundary — move
token trust from a shared symmetric secret to asymmetric ES256/RS256 + a `.well-known/jwks.json`
endpoint, so a future OIDC drop-in (OpenIddict on the same `AspNetUsers` store) is a config change,
not a rewrite. The IdP stays in-house: no managed provider has a BD region (data residency), and
Entra can't import ASP.NET password hashes without a mass reset.

**Impact:** Shipped: the user logins converge on one core (mobile + web-password already there, web
Google now too — the last un-migrated path, which fixed the "already logged in this browser" bug by
construction), plus a full Critical/High hardening set — two Criticals and six Highs plus twelve
review findings, closing the PK-as-verification-token hole, gating Google on `email_verified`, moving
reset URLs server-side per country, reordering the rate-limiter after auth, making admin logins
enumeration-safe with a PBKDF2 timing-equalizer and a sign-out-on-any-failure guard, and unifying the
Data-Protection key ring — all under 832 tests. Decided and sequenced, **not built**: the revocable
web-session store (ADR-0015, "no code written yet"), refresh-token reuse-detection + family
revocation, the JWKS ES256 pivot, the NIST-800-63B password model, step-up MFA, and the unified
Active-Sessions screen. Honest gates: admin login still has one legacy path, the per-country reset URL
resolves to BD until a `CountryCode` user signal lands, the `dbo.DataProtectionKeys` migration is
apply-and-smoke-pending, and the live Google browser round-trip can't run in CI. The deliverable is a
decided architecture on a shipped hardening floor, with the top-1% session-revocation pillars next.

**Tech stack:** .NET, ASP.NET Core, C#, ASP.NET Core Identity, MediatR, FluentValidation, Dapper +
stored procedures, SQL Server, JWT / refresh tokens, HybridCache, OAuth 2.0 / OIDC, JWKS
(ES256/RS256 — planned)

**Links:** (sole-engineer architecture for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — one core, two edges: a single MediatR-over-Identity decision core sits in the middle; the browser edge translates its decision into an HttpOnly Secure SameSite cookie while the native mobile edge gets a bearer JWT plus a rotating refresh token, and a JWKS issuer boundary (asymmetric ES256 signing plus a .well-known/jwks.json endpoint, decided but not yet built) lets each host validate tokens by the issuer's public key instead of a shared secret](/figures/auth-core-two-edges.svg)
![Fig. 2 — the converged Google login: the web implicit flow yields an access token and mobile yields an ID token, but both reach the one shared GoogleLoginCommand handler, which validates whichever artifact was supplied (the web access token is audience-checked via Google tokeninfo, closing a substitution vector the legacy userinfo path lacked), gates on email_verified, runs the shared find-or-create, then lets each edge issue its own artifact — a cookie for web, a JWT for mobile](/figures/auth-google-converged.svg)
![Fig. 3 — the login that fought back: the legacy GoogleSignUp set the auth cookie, then threw on an unregistered Cookies scheme and an EF duplicate-tracking _db.Update; the throw was swallowed, the method returned Success false, and the callback redirected the now-signed-in user back to a login page that saw the fresh cookie and said A user is already logged in this browser — a loop, fixed by converging the path onto the shared core](/figures/auth-login-loop-bug.svg)
![Fig. 4 — the roadmap, honestly: the auth work as ordered steps by status — web Google convergence and the Critical/High hardening set shipped; admin convergence, refresh-token reuse-detection, the revocable session store, the NIST password model, step-up MFA, and the JWKS pivot decided and sequenced but not built; Redis, a dedicated OpenIddict IdP, BFF, and DPoP deferred behind real triggers](/figures/auth-roadmap-status.svg)
