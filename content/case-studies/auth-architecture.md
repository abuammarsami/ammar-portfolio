---
name: auth-architecture
title: "Authentication Architecture"
type: case-study
status: active
updated: 2026-07-13
headings:
  problem: "One login, four code paths, and a session nobody could kill"
  bigIdea: "Auth is one decision, many transports — and revocation is what separates good from top-1%"
  howItWorks: "One core decides; each edge gets the artifact safest for its medium"
  followAJob: "Follow one web Google login through the converged path"
  decisions: "Where the security thinking went"
  warStoryKicker: "The war story · the login that fought back"
  warStory: "The bug that logged you in, then told you that you were already logged in"
  impact: "A shipped hardening floor and a decided path to top-1%"
---

## Tagline

One authentication core that decides *who you are*, two transport edges that each receive the session artifact safest for their medium, and the one design goal that separates a good auth system from a top-1% one: every session — cookie or token, web or mobile — must be revocable and enumerable server-side.

## Role

Sole engineer of Partners.com.bd — I design, build, and run the whole platform. This is the authentication slice: decided across two ADRs after a four-stream R&D review, with the single-core convergence and a full Critical/High hardening set **shipped and under 832 tests**, and the revocable-session and JWKS pillars **sequenced next — decided, honestly, not yet built.**

## In one minute

When you log in, something has to decide *who you are* and then hand your client a *session artifact* — a cookie or a token. Most systems make two mistakes. They scatter that decision across every login path — web password, web Google, mobile, admin — so the same bug has to be fixed four times. And they issue a session the server keeps no record of, so once it's out, nobody can kill it.

This project makes the decision singular: one MediatR core over ASP.NET Core Identity, and every surface routes through it. And — by design — it makes the session revocable on both edges: a SQL-backed server-side store for the web cookie, and refresh-token reuse-detection with family-revocation for mobile — unified into one "Active Sessions & Devices" list, the way GitHub shows you every logged-in device. The core convergence and a full Critical/High hardening set are shipped and tested; the revocable-session store and the JWKS signing pivot are decided in two ADRs and sequenced next — which the honest version of this story keeps clearly separate from what already runs.

## Stats

- 3 → 1 | user logins now on one core (admin is Step 1.5, next)
- 2 + 6 | Criticals + Highs closed in the hardening set
- 832 | tests green across app + infra
- 2 | accepted ADRs after a 4-stream R&D review
- 0 | ways to revoke a web session today — the gap this design closes

## The problem

The product ships two clients over one system: a server-rendered ASP.NET Core **MVC web app** (cookie auth) and a **Flutter mobile app** on a JWT + refresh-token API, with admin logging in on the web too. The authentication *decision* had drifted apart across them. Mobile and the web password login already routed through the shared core — but the **web Google login still ran through the legacy `OnlineShop.Repository.GoogleSignUp`**, and admin login was still legacy. A fix made in one place didn't reach the others.

Worse is the session itself. The web session is a **stateless, self-contained cookie**: the entire Identity authentication ticket is serialized *into* the cookie, Data-Protection-encrypted, with a 7-day sliding expiry and no absolute timeout — and the server keeps **no record of it**. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) calls server-side invalidation the "most relevant and mandatory" part of session management, and it is exactly the property this session lacks.

## Incidents

### A stolen web cookie could not be killed

*symptom → cause*

Because the whole ticket lives in the cookie and the server stores nothing, a stolen cookie is valid until it expires and there is no way to revoke it. "Log out everywhere" is impossible — there's nothing server-side to delete. An admin can't terminate a compromised account's live sessions, a password change can't invalidate other sessions, and the user can't be shown their own active devices, because no such list exists.

### The email-verification "token" was the user's primary key

*symptom → cause*

The legacy partner email-verification link used the user's **primary key** as its "token" — no entropy, no expiry, guessable. Anyone could activate any inbox by walking IDs. It was one of the two Criticals the auth review confirmed; the fix replaces it with a real, single-use, SecurityStamp-bound Identity email-confirmation token validated through `ConfirmEmailAsync`.

### Reset links trusted the attacker's Host header

*symptom → cause*

Password-reset and verification links were built from the attacker-controllable `Request.Host` with `AllowedHosts` set to `"*"` — a classic reset-poisoning vector (and the API's link even pointed at a 404 route). The fix builds every link server-side from a per-country configuration via an `IAppUrlBuilder`, and pins `AllowedHosts` to real domains.

## The big idea

Any framework hands you a login form and a token library. What they don't hand you is the property that actually separates a good auth system from a top-1% one: **every session must be revocable and enumerable server-side.** That, plus refusing to scatter the login decision, is the whole thesis.

So the design is three moves. **One core decides who you are** — credential verification, Google-token validation, lockout, account-creation policy, token issuance — all in `Partners.Application` MediatR handlers over ASP.NET Identity, with every surface routing through it. **Each edge gets the artifact safest for its medium** — an HttpOnly cookie for the server-rendered browser, a bearer JWT + rotating refresh for native mobile. And **every session is revocable on both edges** — a SQL-backed server-side store for the web cookie, reuse-detection with family-revocation for mobile — unified into one session model. The sharpest corollary: *"same artifact everywhere" is the anti-pattern — the decision is what must be single, not the wire format.*

## The wrapper

- One decision core | Every auth decision lives in `Partners.Application` MediatR handlers over ASP.NET Identity — credential verify, Google-token validation, lockout, creation policy, issuance. A bug fixed in a handler fixes web and mobile at once. No decision logic left in `OnlineShop.Repository`.
- Two transport edges | Browser → HttpOnly + Secure + SameSite cookie; a server-rendered app has no browser-JS token store, so it already has the security property a Backend-for-Frontend gives a SPA. Native mobile → bearer JWT access + rotating refresh (RFC 8252 public client). The edge translates the core's one decision into the right artifact.
- Revocable web sessions | A custom `ITicketStore` moves the ticket server-side; the cookie then carries only an opaque 64-bit session key, and `dbo.UserSession` is the SQL store of record. Delete a row → instant revocation; delete every row for a `UserId` → log-out-everywhere, admin account-kill, kill-on-password-change. (ADR-0015 — decided, not yet built.)
- Revocable mobile sessions | Refresh tokens carry a `FamilyId`; presenting an already-rotated token outside a small grace window revokes the whole family plus active access tokens. Rotation without reuse-detection buys little. (Roadmap Step 2 — sequenced.)
- One unified session model | Web sessions (`dbo.UserSession`) and mobile refresh-token *families* become a single enumerable "Active Sessions & Devices" screen — the GitHub/Google experience across both edges.
- JWKS issuer boundary | Move token trust from a shared symmetric secret / shared `dbo.DataProtectionKeys` to asymmetric ES256/RS256 signing plus a `.well-known/jwks.json` discovery endpoint; each app validates with the issuer's *public* key. Decouples the hosts and turns a future OIDC server into a config change, not a rewrite. (Step 5 — the architectural pivot, sequenced.)
- Shipped hardening floor | A Critical/High set already landed: real Identity email-confirmation tokens, `email_verified`-gated Google auto-link, server-side per-country reset URLs, the rate-limiter reordered after authentication so user-partitioned limiters don't collapse to the IP bucket, and enumeration-safe admin logins with a PBKDF2 timing-equalizer — all under 832 tests.

## How it works

At the center is one rule: no controller decides *who you are*. Every login — web password, web Google, mobile, admin — becomes a MediatR command (`LoginCommand`, `GoogleLoginCommand`) that verifies the credential or validates the Google token, checks account state and lockout, applies the account-creation policy, and returns a single decision. The controller at each *edge* then translates that decision into its medium's artifact: `SignInWithCookieAsync` establishes the HttpOnly cookie for the browser; the mobile response carries a JWT and a rotating refresh token. Because the decision is singular, the same `email_verified` gate, the same find-or-create, and the same issuance policy apply everywhere — and the JWKS boundary (once built) lets each host validate a token by the issuer's published public key instead of a shared secret, so trust stops depending on who minted it.

## Follow a job

### 1. The browser obtains a Google access token

*browser edge*

The web Google button uses the implicit flow, which yields an **access token** — not an ID token. (The mobile app, by contrast, gets an ID token.) The two clients arrive at the same core carrying two different Google artifacts.

### 2. The callback hits one shared handler

*one core*

`HomeController.GoogleCallback` now sends `_mediator.Send(GoogleLoginCommand)` — the very same handler the mobile API uses. `GoogleLoginCommand.IdToken` is optional and an optional `AccessToken` was added, so the handler validates whichever artifact the edge supplied.

### 3. The token is validated *and* audience-checked

*verified*

For the web access token, `ValidateAccessTokenAsync` calls Google's `tokeninfo` and **checks the audience** against the web client ID — a check the legacy `userinfo`-only path lacked, which closes an access-token substitution / confused-deputy vector — then reads the profile. `email_verified` must be `true` before any account match or create.

### 4. Find-or-create runs, shared and unchanged

*shared*

Everything downstream — the verified-email gate, find-or-create, token issuance — is the code every edge already shares. There is no second Google path to keep in sync.

### 5. The edge issues the cookie

*web artifact*

The callback ignores the JWT and refresh token in the command's response (that's the mobile edge's artifact) and establishes the HttpOnly cookie via `SignInWithCookieAsync`. The front-end button and redirect are unchanged — only the server moved — which is the smallest possible blast radius for a live login path.

## Architect decisions

### One decision core, not one source of truth per client

*chose: every surface routes through the same MediatR handlers · over: each client keeping its own login logic*

Scattered login logic means the same bug is fixed four times and usually isn't. Centralizing the *decision* means a fix in a handler protects web and mobile at once — which is exactly why the live Google bug was closed by convergence, not by a patch to the broken path.

### Two edges by medium — cookie for web, token for mobile

*chose: the artifact safest for each medium · over: "same artifact everywhere" (all JWT, or all cookie)*

A JWT sitting in browser JavaScript is an XSS token-theft target; a cookie in a native app is the wrong medium. A server-rendered browser app already keeps no token in JS, so it has the BFF security property for free. The decision must be singular — the wire format must not be.

### SQL as the session store of record, Redis deferred

*chose: `dbo.UserSession` on the SQL + Dapper stack we already run · over: requiring Redis now*

Redis is currently off and the Plesk host can't guarantee it, so blocking a security-critical feature on infrastructure outside our control is the wrong dependency. SQL is durable, enumerable, and already here; an indexed single-row lookup keeps revocation always-instant. Redis later is a config-only flip (fill the connection string → HybridCache L1+L2), not a redesign.

### Keep the IdP in-house; build the JWKS seam, defer the IdP

*chose: asymmetric + JWKS now, OpenIddict later on the same `AspNetUsers` store · over: a managed cloud IdP*

No managed provider has a Bangladesh region — a hard collision with BD data-localization — Auth0/Cognito hit a six-figure cost cliff at millions of MAU, and Entra can't import ASP.NET Identity password hashes, forcing a mass reset. Building the JWKS boundary now keeps the IdP a drop-in later without paying for it, or migrating users, today.

## The war story

The most dangerous bug in the whole system wasn't a crash — it was a login that *succeeded and then denied it*. On the web Google path, the legacy `UserRepository.GoogleSignUp` signed the user in — it set the auth cookie — and *then* threw, on an unregistered `"Cookies"` scheme plus an EF duplicate-tracking `_db.Update`. The throw was swallowed, the method returned `Success=false`, and the callback redirected the now-signed-in user back to a login page — which saw the fresh cookie and announced "A user is already logged in this browser." A user who did everything correctly was trapped in a loop, simultaneously logged in and told they couldn't log in.

The root cause was structural, not a typo: the web Google login was the one remaining *user* auth path still running through the legacy repository instead of the shared core — the same bug family as an earlier tracking-collision hotfix that had covered eight other actions but missed this one. So the fix wasn't to catch the swallow; it was to converge. `GoogleCallback` now delegates to the shared `GoogleLoginCommand` handler, validates the browser's access token with an audience check the legacy path never did, and issues the cookie cleanly at the edge — closing the whole family at once. Then a second, adversarial review of the hardening set caught a regression of *exactly this shape*: a reorder that put `PasswordSignInAsync` before the role check, so an exception in the role lookup could return "Login Failed" **with a live auth cookie still set**. The fix made `await SignOutAsync()` the first line of every login `catch` block across all six admin controllers — a no-op if no sign-in happened, a guarantee otherwise. The same lesson, twice: a login that half-succeeds is worse than one that cleanly fails.

## Impact

What's shipped is the foundation, and it's real. The user logins are converging on one core — mobile and web-password were already there, and the web Google path, the last un-migrated one, now is too, which is what fixed the "already logged in this browser" bug by construction. On top of it, a full Critical/High hardening set landed: two Criticals and six Highs plus twelve review findings, closing the PK-as-verification-token hole, gating Google on `email_verified`, moving reset URLs server-side per country, reordering the rate-limiter after authentication so user-partitioned limiters stop collapsing to the IP bucket, making the admin logins enumeration-safe with a PBKDF2 timing-equalizer and a sign-out-on-any-failure guard, and unifying the Data-Protection key ring so cross-app token flows stop silently failing — all under 832 automated tests.

The honest part is the boundary between decided and built. The revocable web-session store (ADR-0015) is designed to the table and stored-procedure level but has **no code written yet — deferred**. Refresh-token reuse-detection with family revocation, the JWKS ES256 pivot, the NIST-800-63B password model, step-up MFA, and the unified Active-Sessions screen are **sequenced, not built**. Even inside the shipped set there are open gates: admin login still has one legacy path to converge (Step 1.5), the per-country reset URL resolves to BD until a `CountryCode` user signal lands, the `dbo.DataProtectionKeys` migration is "apply + smoke pending," and the live Google browser round-trip can't be exercised in CI. So the deliverable is precise: a *decided* architecture — two ADRs after a four-stream R&D review — sitting on a *shipped* hardening floor, with the top-1% session-revocation pillars scheduled next, and nothing about the unbuilt parts dressed up as done.

## Going deeper

The thinking is written down, not just held: two ADRs (the authentication architecture; the server-side revocable session store), a roadmap that sequences Steps 1–6 by security ROI, and a hardening change-set doc that lists every fix with its file and severity. The design is deliberately boring where security lives — one decision core, two edges by medium, one store of record, one unified session model — and the roadmap is explicit about what is shipped, what is decided, and what is deferred behind a real trigger (Redis when we scale to multiple web instances, OpenIddict when SSO or B2B federation arrives, BFF only if the web becomes a browser-JS SPA, DPoP only once tokens cross real trust boundaries). It's grounded in RFC 8252 / 9700 / 9449, NIST SP 800-63B Rev. 4, and the OWASP session and authentication cheat sheets. The next moves are the ones with the highest security ROI: refresh-token reuse-detection first, then the `ITicketStore` session store, then the JWKS pivot — before any service is split out of the monolith or the API is opened to third parties.
