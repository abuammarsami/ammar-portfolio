---
title: "Pending User Actions — paper fixes, domain, Scholar, testimonials"
type: guide
status: active
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [guide, launch, papers, content, todo]
related:
  - launch-checklist.md
  - ../architecture/decisions/adr-0008-research-library.md
  - ../architecture/decisions/adr-0012-self-hosted-svg-figures.md
---

# Pending user actions

Everything left after the 2026-07-06 wave (PRs #21–#25 merged) needs input
only the author has. Ordered by dependency: **1 → 2** unblocks Google
Scholar; **3** must precede **4**.

## 1. Fix the two course-paper PDFs

Source files live in the untracked `papers/` archive. Both `.md` pages are
already live and numerically faithful — only the PDFs are held back
(`pdf: false`). Editorial defect review from 2026-07-06:

### `papers/CSE583_Blood_Cell_Detection.pdf` — 3 targeted fixes

**Must fix:**

1. **Page 6, Conclusion (right column, bullet list)** — delete/rewrite:
   *"This model outperforms existing methods in blood cell detection"*.
   Contradicted by the paper's own Table II (RetinaNet 0.876 vs YOLOv5x
   0.923, YOLOv7 0.896, CST-YOLO 0.927) and by the Discussion on the same
   page ("could not outperform other existing methods"). This is the
   early-draft sentence the site's "Looking back" section admits to.
2. **Page 1, Abstract + Introduction (twice)** — *"an mAP of 88% at 0.50
   IoU"* is wrong: 88% is the **accuracy** figure; mAP@0.5 is **0.876**
   (Table I, page 5). Change "mAP" → "accuracy" or use 0.876.
3. **Page 5, §V.A.1** — broken text *"The model reaches the best mAP of
   58The mAP here is at IoU 0.50:0.95."* The orphan "58" appears nowhere
   else (real values: 0.876 @0.5, 55.25% @0.50:0.95); missing space too.

**Nice to have:** references [6], [8]–[12] have no author names; the
"lightweight variant of RetinaNet" claim (page 2 + conclusion) is never
implemented — the method is standard torchvision RetinaNet with transfer
learning; loose in-text citation placement on pages 1–2.

### `papers/Exploring_New_Attack_Patterns_….pdf` — needs real surgery

**Must fix:**

1. **Pages 1–2 — spliced content from an unrelated paper.** The end of
   page 1 into page 2 contains a mobile-IP paper's introduction: PMIPv6
   handover latency, "SEMO6", "Proxy-SEMO6 architecture … timing diagram
   … cost analysis". None of it relates to anomaly detection or knowledge
   distillation. Delete all of it.
2. **Page 2** — bare *"[1] [2] [3] [4] [5]"* printed as body text next to
   Fig. 1 (placeholder citation dump).
3. **Page 1, Abstract** — *"zero false negative rate, ensuring that no
   listed attacks go undetected"* contradicts the paper's actual (honest,
   negative) result: the student model reached only 0.75 F1 and "could not
   enrich the black box knowledge … as we expected" (page 4). Rewrite the
   abstract to match the reported outcome.
4. **Page 2** — *"Fig. 4 shows the architecture"* should be **Fig. 1**;
   Fig. 1 itself has an arrow labeled literally **"Text."** — fill it in.
5. **Page 4, Table I** — student test macro-F1 typo **"0..75"** → 0.75.

**Nice to have:** "MD. Abu Ammar" → "Md." (matches the other paper);
unify author-year citations ("Tanjim Dipon et al. (2020)" etc.) with the
numbered reference list; grammar: "architecture-1", "improvise the
important feature".

## 2. Publish the fixed PDFs (tell Claude — becomes PR "publish course papers")

Once the fixed PDFs are in `papers/`, say so; the steps are mechanical:

1. Verify the fixes above landed (re-read the PDFs).
2. Copy curated copies to `public/papers/blood-cell-detection.pdf` and
   `public/papers/network-anomaly-detection.pdf` (ADR-0008 naming: file =
   slug).
3. Flip `pdf: true` in `content/papers/blood-cell-detection.md` and
   `content/papers/network-anomaly-detection.md`; rewrite their
   "available on request" / "needs editing pass" sentences in "Looking
   back"; re-check every number in the md against the corrected PDFs.
4. Gates + verify: `[pdf ↓]` link renders, `citation_pdf_url` meta and
   JSON-LD `encoding` appear on both `/research/<slug>` pages.

## 3. Custom domain

Follow [launch-checklist.md](launch-checklist.md) §1–§3 (buy domain →
Vercel Domains → `NEXT_PUBLIC_SITE_URL` → redeploy → verify every
SITE_URL consumer → Search Console). **Do this before step 4** — Scholar
treats moved PDFs as new documents.

## 4. Google Scholar

Follow [launch-checklist.md](launch-checklist.md) §4. Prerequisites are
now all code-side complete; it needs steps 1–3 done first, plus creating
the profile (a manual, logged-in action).

## 5. Testimonials (whenever quotes arrive)

Paste real quotes into `content/testimonials.md` in the documented format
(one blockquote per testimonial, last line `— Name, Title, Company`).
The /about section appears automatically; no code change. Quotes must be
verbatim from their authors — never paraphrased or invented.

## 6. Exact stats (optional)

`content/stats.md` figures are deliberately rounded down (policy comment
in the file). If exact audited numbers ever become preferable, update the
ranges — never add precision that can't be defended in an interview.

## 7. Also parked earlier (from wave 3)

- Calendly/Stripe/Gumroad links into `content/hire.md` + `colophon.md`
  (CTAs are mailto placeholders until then).
- Template repo extraction (separate project; waitlist is live).
- Replace the two thesis PDFs in `public/papers/` with correctly
  2022-dated recompiles (current copies are stamped July 2026 on the
  title/approval pages; decided 2026-07-04 to ship-then-replace).
- Voice-mode microphone round-trip needs one human test.
