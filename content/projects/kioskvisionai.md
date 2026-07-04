---
title: KioskVisionAI
date: 2025-06
tags: [dotnet-aspire, azure, vision-ai, microservices, devops]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
---

# KioskVisionAI

**Summary:** Cloud-native distributed app that watches a fleet of donation kiosks with
Azure Vision AI — orchestrated by .NET Aspire, deployed by generated GitHub Actions.

**Problem:** Donation kiosks deployed across U.S. mosques fail silently — a frozen screen
or dead battery means lost donations until someone physically notices. Support needed
eyes on every device without anyone standing in front of it.

**Approach:** Built a distributed .NET 9 Aspire application: kiosk screenshots flow into
Azure Blob Storage, Queues fan out analysis work, and Azure Vision AI inspects each frame
for anomalies, enriching metadata and firing event-driven notifications. Aspire provides
orchestration, observability, and service discovery across the microservices. Provisioned
with Azure Developer CLI (azd), which then auto-generated the GitHub Actions workflows for
continuous delivery.

**Impact:** Streamlined DevOps pipeline with reduced manual configuration, faster
deployments, and full observability across services — intelligent monitoring for the
entire kiosk fleet.

**Tech stack:** .NET 9, .NET Aspire, Azure Blob Storage, Azure Queues, Azure Vision AI,
Azure Developer CLI (azd), GitHub Actions

**Links:** (private/work project — ask me for a walkthrough)

**Media:** _TODO: architecture figure (Aspire service graph)_
