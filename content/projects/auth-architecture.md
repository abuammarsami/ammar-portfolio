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
revocable and enumerable server-side. Architected across two accepted ADRs after a four-stream R&D
review: one decision core, two transport edges, revocable sessions on both, and a JWKS issuer
boundary — with the single-core convergence of the user logins and a full Critical/High hardening
set under 832 tests.

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
session key; `dbo.UserSession` on SQL Server is the store of record — durable, enumerable, and
already in the stack, with Redis staying a config-flip for the day we scale to multiple web
instances), and mobile refresh tokens carry a `FamilyId` so a reused token revokes the whole family —
unified into one enumerable "Active Sessions & Devices" model. And a JWKS issuer boundary — move
token trust from a shared symmetric secret to asymmetric ES256/RS256 + a `.well-known/jwks.json`
endpoint, so a future OIDC drop-in (OpenIddict on the same `AspNetUsers` store) is a config change,
not a rewrite. The IdP stays in-house: no managed provider has a BD region (data residency), and
Entra can't import ASP.NET password hashes without a mass reset.

**Impact:** The user logins converge on one core (mobile + web-password already there, web Google now
too — the last un-migrated *user* path, which fixed the "already logged in this browser" bug by
construction), plus a full Critical/High hardening set — two Criticals and six Highs plus twelve
review findings, closing the PK-as-verification-token hole, gating Google on `email_verified`, moving
reset URLs server-side per country, reordering the rate-limiter after auth, making admin logins
enumeration-safe with a PBKDF2 timing-equalizer and a sign-out-on-any-failure guard, and unifying the
Data-Protection key ring — all under 832 tests. And the architecture around it is the part that ages
well: revocation is a first-class property on both edges, not something bolted on after a breach; the
JWKS boundary means a dedicated OIDC server (OpenIddict on the same `AspNetUsers` store) is a config
change rather than a rewrite; and keeping the IdP in-house is what keeps the whole thing free of a
data-residency problem, a per-MAU cost cliff, and a forced ASP.NET password-hash migration. It's a
security design that reaches for the top-1% property — every session killable, server-side — and
builds the seams that let the rest arrive without a rebuild.

**Tech stack:** .NET, ASP.NET Core, C#, ASP.NET Core Identity, MediatR, FluentValidation, Dapper +
stored procedures, SQL Server, JWT / refresh tokens, JWKS (ES256/RS256), HybridCache, OAuth 2.0 / OIDC

**Links:** (sole-engineer architecture for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — one core, two edges: a single MediatR-over-Identity decision core sits in the middle; the browser edge translates its decision into an HttpOnly Secure SameSite cookie while the native mobile edge gets a bearer JWT plus a rotating refresh token, and a JWKS issuer boundary (asymmetric ES256 signing plus a .well-known/jwks.json discovery endpoint) lets each host validate tokens by the issuer's public key instead of a shared secret — so a drop-in OIDC server later is a config change, not a rewrite](/figures/auth-core-two-edges.svg)
![Fig. 2 — the converged Google login: the web implicit flow yields an access token and mobile yields an ID token, but both reach the one shared GoogleLoginCommand handler, which validates whichever artifact was supplied (the web access token is audience-checked via Google tokeninfo, closing a substitution vector the legacy userinfo path lacked), gates on email_verified, runs the shared find-or-create, then lets each edge issue its own artifact — a cookie for web, a JWT for mobile](/figures/auth-google-converged.svg)
![Fig. 3 — the login that fought back: the legacy GoogleSignUp set the auth cookie, then threw on an unregistered Cookies scheme and an EF duplicate-tracking _db.Update; the throw was swallowed, the method returned Success false, and the callback redirected the now-signed-in user back to a login page that saw the fresh cookie and said A user is already logged in this browser — a loop, fixed by converging the path onto the shared core](/figures/auth-login-loop-bug.svg)
![Fig. 4 — the architecture at a glance, in three groups: the foundation (one decision core every login routes through, and the Critical/High hardening set under 832 tests); the session and trust pillars (admin convergence, refresh-token reuse-detection with family revocation, the revocable session store via ITicketStore + dbo.UserSession, the NIST password model, step-up MFA, and the JWKS ES256 trust pivot); and what it defers by design, each adopted only on a real trigger — Redis, a dedicated OpenIddict IdP, a Duende BFF, and DPoP](/figures/auth-roadmap-status.svg)
