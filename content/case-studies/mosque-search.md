---
name: mosque-search
title: "Mosque Search"
type: case-study
status: active
updated: 2026-07-18
headings:
  problem: "Substring matching isn't search"
  bigIdea: "Semantic behavior, no semantic model"
  howItWorks: "One score per mosque, decided by its strongest field"
  followAJob: "Follow one query — \"ICCR\""
  decisions: "Where the real thinking went"
  warStoryKicker: "The war story · the exact name search hid"
  warStory: "When an exact-name search buried the mosque"
  impact: "Relevance you can read line by line"
---

## Tagline

A mosque-finder that understands how people actually type — the acronym, the nickname, the typo — and ranks the right masjid first, with zero machine learning: no embeddings, no model, just classical information retrieval done carefully.

## Role

Engineer on the Masjid Solutions platform — donation and community apps used across 60+ U.S. mosques. I built the mosque-discovery search end to end: the API endpoint, the relevance scoring model, and the blob-backed caching layer that serves it. This is the search box a congregant uses to find their own masjid, so "close enough" isn't good enough — the right one has to come back, and it has to come back first.

## In one minute

Think about how you search for a place you already know. You type its initials. Or the name everyone actually calls it, not its legal name. Or you fat-finger a letter. A good search engine shrugs all of that off and still puts the thing you meant at the top. A naive one — the kind most apps ship — matches only the exact letters you typed, in order, and returns everything or nothing, in no particular order.

This project is the good kind, built without any AI. It reads a query, scores every mosque against it across several fields (name, nickname, slug, city, state, ZIP), tolerates typos and word-order and punctuation, and then — the part that's easy to skip — *ranks* them so the most relevant one wins. The interesting engineering isn't "find matches." It's "decide which match matters most," and do it with a deterministic algorithm you can read and test instead of a model you have to trust.

## Stats

- 0 | models, embeddings, or vector stores
- 3 | FuzzySharp algorithms maxed per field
- 6 | weighted fields scored per mosque
- ≥ 60 | relevance floor before the top 10
- exact-first | a word-boundary hit always floats up

## The problem

The old lookup was substring matching — `LIKE '%term%'` — with no notion of relevance. That fails the three ways people really search. **Acronyms:** typing "ICCR" for *Islamic Center of Cedar Rapids* matched nothing, because those four letters never appear consecutively. **Nicknames and slugs:** the name a community uses, or the hyphenated URL slug, isn't the legal name in the `Name` column. **Typos:** one wrong letter and substring matching returns an empty list. And even when many mosques *did* match, there was no ranking — so the result you wanted could sit tenth, or drop off a capped list entirely. On a "find your mosque" screen, an empty result and a wrong-first result are the same bug to the user: the app looks broken.

## Incidents

### The acronym that found nothing

*query → empty result*

A user in Iowa typed "ICCR" to find the Islamic Center of Cedar Rapids — exactly the mental shortcut everyone uses. Substring search looked for the literal string "iccr", found it in no mosque name, and returned nothing. The mosque was right there in the database; the search just couldn't think in initials.

### One wrong letter, zero results

*typo → empty result*

"Masjid Al-Rahmah" typed as "Masjid Al-Rahma" — a dropped letter — returned an empty list, because substring matching has no concept of "almost." A search that punishes a single typo with nothing at all trains users to stop trusting it.

### A fuzzy ZIP could match three states away

*near-miss → wrong geography*

The tempting fix — make *everything* fuzzy — has its own trap. Run Levenshtein distance on ZIP codes and `52402` is "close" to `52403`, `52412`, `62402`… codes that are geographically nowhere near each other. A fuzzy ZIP match would happily surface a mosque three states away as a near-hit. Distance between ZIP *strings* has nothing to do with distance on the map.

## The big idea

You can buy semantic search off the shelf now: embed the query, embed every record, rank by cosine similarity. It's the obvious 2026 answer, and for this problem it's the wrong one. This catalog is a bounded list of mosques with structured fields — names, nicknames, slugs, ZIPs. The "meaning" a user encodes is an acronym, an abbreviation, a typo, a word out of order. **All of that is recoverable with string algorithms — deterministically, explainably, and for free** — without a model to train, a vector index to host, or an inference call on every keystroke.

So the thesis is: *get semantic-quality relevance from classical IR.* Two moves make it work. First, score each mosque per field with fuzzy matching that already understands typos, partial hits, and token reordering — and take the **strongest** field rather than muddling them together. Second, borrow the **DisMax** (disjunction-max) rule that Elasticsearch and Solr use for exactly this: the best-matching single field decides the score, and the other fields only nudge ties. The result behaves like it understands intent, but every point of every score is a number you can trace back to a line of code.

## The wrapper

- Weighted fields | Each mosque is scored across `Slug` (5.5), `Name` (5.4), `NickName` (5.2), and `City`/`State`/`Zipcode` (3.5) — the weights encode which field is the stronger signal of "this is the one."
- Triple-algorithm max | Per field the score is the **max** of `Fuzz.PartialRatio`, `TokenSetRatio`, and `Ratio` — one catches substrings, one shrugs off word order, one measures whole-string closeness; taking the max means whichever *way* the query resembles the field, it counts.
- Separator normalization | Every comparison runs on both the raw term and a variant with `-`, `_`, `/` folded to spaces (`NormalizeForFlexibleMatching`), so a slug like `al-rahmah` and a typed `al rahmah` are the same query.
- Ultra-forgiving slug/nickname | Slug and nickname get a ladder — exact, then substring, then strip-all-non-alphanumeric, then prefix, then boosted fuzzy — because that's where the acronyms and shorthands live.
- ZIP as geography, not text | ZIP skips fuzzy entirely: exact, prefix, or first-3-digit "sectional center" regional grouping — matching by *place*, never by string distance.
- DisMax aggregation | `finalScore = maxFieldScore + (normalized weighted sum of the other fields × 0.1)`, capped at 100 — strongest field decides, the rest break ties.
- Exact-match float | An exact word-boundary hit on any field is ranked ahead of everything else regardless of score ties — the non-negotiable rule of any real search engine.
- Cache-aside serving | The whole mosque list lives in `IMemoryCache` (1-hour absolute, 30-minute sliding), hydrated from an Azure Blob JSON snapshot — so a search is in-memory string math, not a DB query per keystroke.

## How it works

`GET /mosque/find-mosque/{find}` lands in `MosqueController.FindMosqueAsync`, which calls `MosqueService.FindAsync`. The service pulls the full mosque catalog — from `IMemoryCache` on a warm path, or from an Azure Blob JSON snapshot it then caches — and hands it, with the query, to `FuzzySearchHelper`. There, `CalculateMosqueScore` scores every mosque: each field is reduced to a single number (the max of three FuzzySharp algorithms over normalized and raw text), and those field scores are combined by the DisMax rule so the mosque's *best* field sets its score and the others only settle ties. The list is filtered to `Score >= 60`, ordered exact-match-first then by score, and cut to the top 10. Because the catalog is bounded and cached, this is all fast in-memory arithmetic — no index server, no network hop, no model.

## Follow a job

### 1. The query is normalized

*fold the noise*

"ICCR" (or "cedar rapids", or a typo'd name) is lowercased and separator-normalized so punctuation and spacing stop mattering. The same normalization is applied to the fields it'll be compared against, so the match is on meaning-bearing characters, not formatting.

### 2. Every mosque is scored, field by field

*max of three*

For each mosque, each field gets the best of `PartialRatio` / `TokenSetRatio` / `Ratio` on both raw and normalized text — with slug and nickname running the extra exact→substring→strip→prefix→fuzzy ladder that lets "ICCR" resolve to *Islamic Center of Cedar Rapids*. ZIP is scored by regional grouping, never by string distance.

### 3. DisMax decides, exacts float, top 10 returns

*strongest field wins*

The field scores collapse via DisMax — strongest field plus a 0.1× tie-breaker from the rest, capped at 100. Anything under 60 is dropped. Then the crucial ordering: exact word-boundary hits first, then by score, then take ten. The mosque you meant comes back on top.

## Architect decisions

### DisMax, not a naive weighted sum

*chose: max-field + 0.1× the rest · over: adding all field scores together*

Summing every field's score rewards mosques that match *weakly everywhere* over the one that matches *perfectly somewhere* — the opposite of relevance. DisMax makes the single best field decide, which is why a dead-on nickname beats a mosque that fuzzily half-matches on five fields. It's the same reasoning Lucene-based engines use, implemented directly.

### ZIP matches geography, not string distance

*chose: exact / prefix / 3-digit sectional-center grouping · over: Levenshtein on the ZIP string*

Fuzzy-matching ZIPs is a bug generator: numerically adjacent codes are geographically unrelated. Grouping by the first three digits (the postal "sectional center") matches *nearby* mosques and refuses to surface one three states away as a near-hit. Some fields want fuzz; this one wants a map.

### Exact matches float, by word boundary

*chose: exact word-boundary hit ranks first, always · over: trusting the numeric score alone*

When several mosques legitimately score 100, the numeric tie is meaningless and an exact name can lose. A regex word-boundary check (`IsExactMatchInAnyField` / `ContainsExactWord`) promotes a true exact hit above the pack — the one rule every user expects and no fuzzy score guarantees.

### Cache-aside over a DB hit per keystroke

*chose: in-memory catalog from a Blob snapshot · over: a SQL query on every search*

The catalog is small, read-heavy, and changes rarely — the textbook cache-aside case. Holding it in `IMemoryCache`, refreshed from a Blob JSON snapshot that invalidates the cache on rewrite, turns each search into pure in-memory math and keeps the scoring logic free to be as thorough as it needs to be.

### Classical IR, not embeddings — on purpose

*chose: deterministic fuzzy + DisMax · over: a vector/embedding semantic search*

Embeddings would add a model to train and version, an index to host, an inference cost per query, and a failure mode ("why did it rank that?") you can't step through in a debugger. For a bounded catalog whose "semantics" are acronyms, nicknames, and typos, string algorithms recover the same intent with none of that — and every score is explainable to the line.

## The war story

The subtle bug wasn't "no results" — it was a *wrong* result on the easiest possible query. Searching the full, exact name **"Islamic Center of Cedar Rapids"** didn't return that mosque near the top. Debugging it, I isolated the mosque and saw its score was a perfect 100 — so it *was* matching. The problem was that several *other* mosques also scored 100, and with the results ordered by score alone, the exact match wasn't guaranteed a seat in the capped top 10. A user typing a mosque's exact name and not finding it is the one failure a search engine is never allowed to have.

The fix was to encode the rule everyone assumes is already there: an exact hit outranks a fuzzy one, even when the numbers tie. I added word-boundary exact-match detection across every field (`IsExactMatchInAnyField` / `ContainsExactWord`, regex-anchored so "rah" doesn't count as an exact hit on "Rahmah") and made it the *primary* sort key — `OrderByDescending(IsExactMatch).ThenByDescending(Score)` — ahead of the numeric score. Now an exact name, nickname, or acronym match floats to the top by construction, and only genuine ties fall back to the DisMax score. The lesson stuck: fuzzy relevance is the right default, but a search engine must still honor certainty when it has it.

## Impact

Congregants find their mosque the first way they think to type it — the initials, the nickname, the misspelling — and the right one comes back first. The three failure modes of the old search (acronyms found nothing, one typo returned nothing, matches came back unranked) are gone, and the exact-name ranking bug is closed by construction rather than patched. Most of all, the relevance is a deterministic algorithm: no model to drift, no training set to curate, no vector index to operate, no inference bill — every point of every score traces to a line you can unit-test. It's semantic-quality search that a reviewer can read top to bottom and understand completely.

## Going deeper

To be exact about the claim: this is **not** embedding or vector search, and that's a deliberate design choice, not a limitation I'm hiding. The behavior *is* semantic — it recovers what the user meant across acronyms, nicknames, punctuation, and typos — but the mechanism is classical IR: weighted multi-field fuzzy matching (`FuzzySharp`, Levenshtein) aggregated by a DisMax relevance model, the same shape Elasticsearch and Solr expose. The honest trade: embeddings would help with true *synonymy and paraphrase* ("house of worship" → "masjid"), which a bounded, structured mosque catalog rarely needs; classical IR wins on determinism, explainability, zero training data, and zero inference cost, which this problem values far more. Knowing where each approach earns its keep — and picking the boring one on purpose — is the point.
