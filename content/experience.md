---
status: active
---

# Experience

## Partners Online (Bangladesh & UK) — Operation Manager, Web & App Development
*March 2026 – Present · Dhaka, Bangladesh (Remote · part-time) · No Borders IT / Partners Online BD & UK Ltd*

- Own the platform behind **Partners.com.bd** — Bangladesh's marketplace + business-social
  platform expanding into the UK — end to end: backend architecture, database, cloud
  infrastructure, deployment, scalability, and security across BD and UK operations.
- Cut detail-page round trips from 3–4 to 1 (~70% fewer) by leading the legacy MVC → API
  strangler migration to a Clean Architecture .NET API — retiring the monolith with zero
  downtime while three Flutter apps (General, Executive, City) ship on top of it.
- Closed the double-settlement money-loss path **by construction**: one generic payment
  ledger serving every paid feature, a vendor-agnostic gateway abstraction with
  country-aware resolution, and a self-healing settlement coordinator backstopped by
  Hangfire reconciliation.
- Made background work crash-safe — no job silently lost or double-run — with a
  transactional SQL outbox, a dedicated Hangfire worker under a least-privilege SQL
  principal, a dead-letter queue, and idempotency keys.
- Bounded CDN storage cost structurally: an async image pipeline whose server-owned
  lifecycle guarantees every orphaned upload is swept without client cooperation; also
  open-sourced the team's document-driven agent workflow as the `d3` Claude Code skill.

## Masjid Solutions — Software Engineer
*December 2023 – May 2026 · Indianapolis, Indiana, USA (Remote)*

- On the team behind a donation platform moving **millions of dollars a year for
  20,000+ users**, built the wallet-payment stack end to end — **Apple Pay / Google Pay
  via Stripe Payment Intents**, tokenized flows that improved mobile donation
  conversion — plus **Authorize.Net ACH** one-time and recurring billing.
- Closed the loop on payment operations: reporting and alerting, an **automated
  failed-payment alert system** that surfaces silent recurring failures, and scheduled
  **donation summaries delivered to admins and configured roles**.
- Cut onboarding time for new schools and memberships by **60%** with automated
  data-import pipelines transforming raw Excel into validated SQL Server schemas, and
  built **custom membership-registration forms** organizations configure themselves.
- Architected CI/CD for **every product line** (Bitbucket, Jenkins, IIS): **7–8
  zero-downtime production deployments a week** (350+ a year), dev environments cycling
  20+ deploys weekly, all on rollback-ready backup strategies.
- Put **200+ donation kiosks across 60+ U.S. organizations** under intelligent watch by
  building KioskVisionAI — a distributed .NET 9 Aspire app on Azure (Blob Storage,
  Queues, Vision AI) with GitHub Actions continuous delivery.
- Improved support response time with a Remote Kiosk Device Management System: REST APIs
  for live health (battery, Wi-Fi, uptime) and remote control (reboot, screenshot).
- Eliminated manual CRM entry by building an automated Salesforce synchronization
  platform — daily jobs, custom field mappings, retries, and error recovery — and
  improved donor data quality by merging duplicates via Twilio Lookup enrichment.
- Engineered across .NET (MVC & Core), SQL Server, Dapper, LINQ, and Entity Framework;
  contributed to the monolith-to-microservices migration with Clean + Onion architecture
  and domain-driven principles.

## Masjid Solutions — SQA Engineer
*October 2023 – November 2023 · Remote*

- Reduced regression bugs by **30%** on a critical module by building a data-driven UI
  automation suite (C#, NUnit, Selenium, Serilog, Extent Reports) running in Jenkins CI —
  CSV-driven cases widened coverage without new code per scenario.

## A1QA — QA Automation Engineer
*November 2022 – July 2023 · Colorado, USA (Remote)*

- Shipped automated regression and priority-based test suites run on every build/release —
  TestNG + Maven + Selenium WebDriver with CSV-driven data testing.
