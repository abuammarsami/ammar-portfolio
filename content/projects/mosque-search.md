---
title: Mosque Search — Semantic-Quality Relevance Without a Model
date: 2026-02
tags: [dotnet, search, information-retrieval, fuzzy-matching, azure]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Mosque Search — Semantic-Quality Relevance Without a Model

**Summary:** Built the mosque-discovery search for the Masjid Solutions community app — the box a
congregant uses to find their masjid by name, nickname, slug, city, or ZIP, tolerating typos and
partial and middle-word hits, and *ranking* the results the way a real search engine
does. It reads like semantic search, but there is **no ML anywhere**: no embeddings, no vector
store, no model to train or serve. It is classical information retrieval done carefully — weighted
multi-field fuzzy matching (`FuzzySharp`) aggregated by a **Solr/Lucene-style DisMax** relevance
model — so relevance is deterministic, explainable, and free to run.

**Problem:** The old lookup was substring `LIKE` matching with no ranking. It missed the way people
actually search: the nickname or short code a community uses — stored as a slug or nickname, not the
legal `Name` — never matched; a single typo returned nothing; and when many mosques *did* match,
nothing decided which was most relevant — so the one you wanted could sit below ten you didn't, or
fall off the list entirely. On a discovery screen, "no results" and "wrong first result" both read
as "the app is broken."

**Approach:** `GET /mosque/find-mosque/{find}` → `MosqueService.FindAsync` → `FuzzySearchHelper`.
Each mosque is scored across weighted fields — `Slug` (5.5), `Name` (5.4), `NickName` (5.2), and
location `City`/`State`/`Zipcode` (3.5). Per field, the score is the **max** of three `FuzzySharp`
algorithms (`Fuzz.PartialRatio`, `TokenSetRatio`, `Ratio`), each run on both the raw term and a
separator-normalized variant (`NormalizeForFlexibleMatching` folds `-`, `_`, `/` to spaces), with
an "ultra-forgiving" ladder for slug/nickname (exact → substring → strip-non-alphanumeric → prefix
→ boosted fuzzy). ZIP is deliberately *not* fuzzy-matched — instead exact / prefix / first-3-digit
"sectional center" regional grouping, so a typo'd ZIP never yields a mosque three states away. The
per-field scores are aggregated with a real **DisMax** rule (borrowed from Elasticsearch/Solr):
`finalScore = maxFieldScore + (normalized weighted sum of the other fields × 0.1)`, capped at 100 —
so the strongest single field decides the match and the rest only break ties. Results filter to
`Score >= 60`, then order by exact-match first, then score, then take the top 10. The catalog is
served **cache-aside**: `FindAsync` caches the full mosque list in `IMemoryCache` (1-hour absolute,
30-minute sliding), materialized from an Azure Blob JSON snapshot that a refresh job rewrites and
invalidates — so a search is in-memory string math, not a database round-trip per keystroke.
`FluentResults` throughout; Dapper + SQL Server underneath.

**Impact:** Congregants now find their mosque the first way they think to type it — the nickname, a
fragment of the name, the misspelling — and the right one comes back on top. A reported ranking bug, where an
*exact* full-name search buried the mosque under other 100-scoring rows, is fixed by construction:
an exact word-boundary hit on any field always floats to the top, the way search is supposed to
work. And the whole thing stays a deterministic algorithm you can read, unit-test, and reason about
line by line — semantic-quality results with zero model risk, zero training data, and zero
inference cost.

**Tech stack:** .NET 9, ASP.NET Core, C#, FuzzySharp (Levenshtein), DisMax relevance model,
Dapper + SQL Server, Azure Blob Storage, `IMemoryCache`, FluentResults

**Links:** (private/work project — ask me for a walkthrough)

**Media:**
![Fig. 1 — how a search is served: the find-mosque endpoint calls MosqueService.FindAsync, which reads the catalog from IMemoryCache (1-hour absolute, 30-minute sliding) and hydrates from an Azure Blob JSON snapshot on a miss; a refresh job rewrites the snapshot and invalidates the cache — so a search is in-memory string math, not a DB round-trip per keystroke](/figures/mosque-search-serving.svg)
![Fig. 2 — the scoring pipeline: a query is normalized, scored per weighted field as the max of three FuzzySharp algorithms, aggregated by the DisMax rule (strongest field + 0.1 × the weighted rest, capped at 100), filtered at score ≥ 60, then ordered exact-match-first before the top 10](/figures/mosque-search-dismax.svg)
![Fig. 3 — the exact-match ranking bug and its fix: before, several mosques all scored 100 and the exact name fell outside the top 10; after, a word-boundary exact hit on any field floats to the top regardless of score ties](/figures/mosque-search-exact-bug.svg)
