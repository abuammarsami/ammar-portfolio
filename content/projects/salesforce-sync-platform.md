---
title: Salesforce Synchronization Platform
date: 2025-03
tags: [salesforce, integration, automation, dotnet]
featured: false
category: engineering
links:
  github: null
  live: null
status: active
---

# Salesforce Synchronization Platform

**Summary:** Automated integration platform keeping payment systems and Salesforce CRM in
sync — daily jobs, custom mappings, retries, and error recovery instead of manual entry.

**Problem:** Payment and donor data lived in the payment platform; the operations team
lived in Salesforce. Keeping them consistent meant daily manual data entry — slow,
error-prone, and unscalable.

**Approach:** Built an automated synchronization platform: scheduled daily jobs pull
transaction and donor data, apply custom field mappings and data transformations, and
push to Salesforce with retry handling and error recovery — data consistency managed
end-to-end rather than record-by-record.

**Impact:** Eliminated manual CRM entry, improved Salesforce accuracy, and turned a
recurring operations chore into an automated workflow.

**Tech stack:** .NET, Salesforce API, SQL Server, scheduled background services

**Links:** (private/work project — ask me for a walkthrough)

**Media:**
