---
title: "Will This Startup Make It? Ensemble Classification on Startup Data"
series: ml-research
order: 6
summary: "Predicting startup success from funding, milestones, and firmographics — and why an ensemble of models beats any single one. What features actually carried signal, which ensemble method won, and how honest the accuracy really is on a noisy, imbalanced problem."
readingMinutes: 11
date: 2026-07
tags: [machine-learning, ensemble-methods, classification, data-science, research]
status: active
---

## The question, and why it resists a clean answer

Point at a young company and ask the only question that matters to a founder or an investor: *does this one make it?* By "make it" I mean the outcome the data can actually observe — the startup gets **acquired** or reaches an **IPO** (success), versus it **closes** (failure). Everything in between — the zombies, the pivots, the still-private-and-uncertain — the dataset collapses into one of those two buckets.

The reason this is hard has nothing to do with which classifier you reach for. It's that startup outcomes are driven by a hundred weak, interacting signals — funding, timing, market, team, luck — and no single one of them is decisive. A company can raise four rounds and die; another can raise once and get acquired. The signal is real but diffuse, smeared across features that only matter in combination. That's exactly the regime where a single model underfits: a linear boundary is too rigid to catch the interactions, and one deep tree memorizes the training set instead of learning the pattern. This write-up is the honest account of building an **ensemble** on this problem — what carried signal, which ensemble method won, and how much of the headline accuracy I actually believe.

![Ensemble classification — several diverse base models each make an imperfect prediction on the startup, and combining their votes cancels out individual errors, yielding a more accurate and stable success/failure call than any single model.](/figures/research-startups.svg)

## The data

The dataset is a Crunchbase-style table of **923 startups described by 49 columns** — one row per company, the kind of firmographic snapshot you'd assemble from a startup database. The target lives in two mirrored columns: `status` reads `acquired` or `closed`, and `labels` encodes the same thing as `1` (success) or `0` (failure). Every model in the notebook trains against `labels`.

The features fall into a few natural families:

- **Funding.** `funding_rounds`, `funding_total_usd`, and a set of binary flags for *what kind* of money came in — `has_VC`, `has_angel`, and `has_roundA` through `has_roundD` — plus `avg_participants` (how many investors joined rounds on average).
- **Timing / maturity.** `age_first_funding_year`, `age_last_funding_year`, `age_first_milestone_year`, `age_last_milestone_year` — all measured in years relative to founding — and the raw dates `founded_at`, `closed_at`, `first_funding_at`, `last_funding_at`.
- **Traction.** `relationships` (business relationships / connections), `milestones` (count of notable achievements), and `is_top500`.
- **Geography.** One-hot state flags `is_CA`, `is_NY`, `is_MA`, `is_TX`, `is_otherstate`, plus raw `state_code`, `city`, `zip_code`, `latitude`, `longitude`.
- **Sector.** `category_code` and its one-hot expansion — `is_software`, `is_web`, `is_mobile`, `is_enterprise`, `is_advertising`, `is_gamesvideo`, `is_ecommerce`, `is_biotech`, `is_consulting`, `is_othercategory`.

**The imbalance is worth naming up front, because it runs the opposite way from most failure-prediction problems.** After cleaning, the split is **551 acquired (success) against 287 closed (failure)** — success is the *majority* class at roughly 66% to 34%. That's not because startups usually succeed; it's a curation artifact. This is a dataset of companies notable enough to be tracked with funding histories and milestones, so the base rate is nothing like the real world's, where most startups quietly die. I'll come back to this — it's the single biggest reason to distrust the headline number.

### Preprocessing: the missing-value archaeology

The raw table carries **1,386 missing values**, and the cleanup is more forensic than mechanical because each gap *means* something:

- **`closed_at` was 63.7% missing (588 rows)** — and that's not noise, it's signal. A company with no close date is one that *hadn't closed*. The notebook fills it with `31/12/2013`, treating the end of the dataset's observation window as "still alive as of the snapshot."
- **`Unnamed: 6` was 53.4% missing.** Inspection showed it was a concatenation of `city`, `state_code`, and `zip_code`, so it's rebuilt from those columns rather than imputed.
- **`age_first_milestone_year` and `age_last_milestone_year` were each 16.5% missing (152 rows).** These are null precisely when `milestones = 0` — a company with no milestones has no milestone dates — so they're filled with `0`.
- **`state_code.1`** turned out to be a duplicate of `state_code` and got dropped.

Then feature engineering: an `age` column is derived as `last_date − founded_at` in years, and rows with negative ages (data-entry impossibilities) are dropped, which is what takes the working set down to **838 rows**. Skewed monetary and time features get tamed two ways — a `MinMaxScaler` normalization producing `norm_relationships`, `norm_age_first_funding_year`, `norm_funding_total_usd`, and a `log1p` transform on the funding total and the four age-year columns to pull in their long right tails. The final design matrix `X` uses **32 features**, and `y` is `labels`.

## The EDA that actually told me something

Before any model, the exploratory pass surfaced three relationships that are worth stating as plain business insight, because they're the human-legible version of what the models later exploit:

- **Age.** Startups that survive **more than four years** succeed at over **52%** — longevity itself is a signal.
- **Milestones.** A startup with **at least one milestone** succeeds at over **60%**. Zero milestones is a strong negative.
- **Relationships.** More than one business relationship pushes success past **61%**.

And a sobering counterweight: the average *closed* startup in this data lived about **six years** before shutting down. Failure here isn't fast; it's a slow fade, which is part of why it's hard to call early.

## The base models

The strategy was deliberately plural: train a diverse bench of classifiers, measure each one honestly, and only then think about combining them. The pipeline before modeling matters — a **70/30 train/test split** (`random_state=42`), then **`RandomOverSampler`** applied to the *training set* to balance the classes, then a `MinMaxScaler` fit on the training folds. Feature selection cross-checked redundancy three ways: a `VarianceThreshold` to kill constant columns, a Pearson-correlation filter at threshold 0.9, and mutual-information (information-gain) ranking.

Here's how the individual classifiers did on the **held-out test set** (n = 252: 100 closed, 152 acquired). These are the numbers I trust most, because they're measured on data no model touched during training:

| Model | Test accuracy | Precision (success) | Recall (success) | F1 (success) | ROC-AUC |
|---|---|---|---|---|---|
| **LightGBM** | **0.857** | 0.84 | 0.94 | **0.89** | 0.835 |
| Random Forest | 0.849 | 0.82 | 0.96 | 0.88 | 0.820 |
| XGBoost | 0.849 | 0.84 | 0.93 | 0.88 | 0.829 |
| Logistic Regression | 0.837 | 0.89 | 0.84 | 0.86 | **0.838** |
| AdaBoost | 0.833 | 0.85 | 0.88 | 0.86 | 0.821 |
| Gradient Boosting | 0.829 | 0.82 | 0.91 | 0.87 | 0.807 |
| SVM (RBF) | 0.762 | 0.78 | 0.84 | 0.81 | 0.741 |

Two things jump out. **The gradient-boosted trees and the random forest cluster at the top (~0.85), the SVM trails badly (0.76), and — tellingly — logistic regression posts the single best ROC-AUC (0.838) despite a middling accuracy.** That last fact is a hint the boundary has a strong near-linear component that a well-calibrated linear model separates cleanly, even as the tree ensembles win on raw accuracy by capturing the nonlinear corners.

The other thing, visible only if you look at training scores: **LightGBM, Random Forest, and Gradient Boosting all hit 1.0 training accuracy.** They memorized the training set perfectly. Logistic regression, by contrast, scored 0.77 on train and 0.84 on test — it isn't overfitting at all. The trees are riding right at the edge of overfitting, and holding them there is precisely the job an ensemble does well.

I also ran a **10-fold stratified cross-validation** across a wider bench, which reorders things interestingly — ExtraTrees (0.927) and Random Forest (0.921) lead, LightGBM follows (0.916), and the linear/naive models (Logistic Regression 0.747, KNN 0.684, ComplementNB 0.668) sit at the bottom. But hold that CV framing loosely; I'll explain in the limits why those numbers are rosier than the holdout.

## Ensembling from first principles

Why combine models at all? The clean way to see it is the **bias–variance decomposition** of a model's error. A single deep decision tree has *low bias* (it can fit almost any shape) but *high variance* (shuffle the training data and it grows a very different tree). A single logistic regression is the reverse — *high bias, low variance*. Neither is what you want alone.

The ensemble insight is that **variance averages away when you combine diverse predictors, while bias does not get worse.** Imagine six classifiers that are each right 80% of the time and — crucially — wrong on *different* examples. When they vote, a mistake by one gets outvoted by the five that got it right. The errors have to be *uncorrelated* for this to work: six copies of the same overfit tree just reproduce the same mistakes six times and buy you nothing. That's why the bench was built to be *diverse* — a linear model, an RBF-kernel SVM, and several structurally different tree ensembles make errors in different regions of feature space, so their failures partially cancel when pooled.

There are a few ways to do the combining, and the notebook's choice is deliberate:

- **Bagging** (Random Forest, ExtraTrees) trains many models on bootstrap resamples and averages — pure variance reduction, already in play inside the base models.
- **Boosting** (AdaBoost, gradient boosting, LightGBM, XGBoost) trains models sequentially, each fixing the last one's mistakes — a bias reducer, also already represented.
- **Stacking** trains a meta-model to learn how to weight the base predictions — powerful but easy to overfit on 838 rows.
- **Voting** simply pools the base predictions — hard voting takes the majority class, soft voting averages probabilities.

The final model is a **hard-voting `VotingClassifier`** over six tuned base learners: `AdaBoost` (grid-searched), `SVC` (grid-searched), `GradientBoosting` (grid-searched), `RandomForest`, `ExtraTrees`, and `LightGBM`. The three grid searches (over AdaBoost's tree depth and learning rate, SVC's `C` and `gamma`, and gradient boosting's depth/estimators/learning rate) sharpen the individual members before they vote. Hard voting — majority rule — is the conservative pick here: with a small, noisy dataset, averaging soft probabilities can let one overconfident member dominate, whereas a majority vote is robust to any single model's miscalibration. Given that the trees were sitting at 1.0 training accuracy, robustness over cleverness was the right call.

## Results: does the ensemble actually win?

On the **held-out test set, the voting ensemble scores 0.845 accuracy.** Look back at the table: that's *right in the pack* — a hair below LightGBM's 0.857 and level with Random Forest and XGBoost. On this single split, the ensemble did **not** beat the best individual model; it matched the leaders.

That is not a disappointing result, and it's worth being precise about why. The ensemble's win isn't a higher point score on one lucky split — it's **lower variance across splits.** Under 10-fold cross-validation the voting classifier scores **0.922 ± 0.041**, and the thing to watch is that standard deviation: the ensemble delivers top-tier accuracy *with a tighter spread* than a lone overfit tree that swings with the training data. When you can't tell in advance which single model will happen to fit the next batch of startups best, the ensemble is the bet that doesn't require you to guess right. The notebook's own conclusion lands exactly there: after all the comparison, "Voting Classification of Ensemble Classifier is the best model for this problem" — best not because it topped every column, but because it's the most *stable* strong performer.

As for **what predicted success**: the EDA and the mutual-information ranking agree. **Maturity and traction dominate** — `relationships`, `milestones`, `is_top500`, `funding_rounds`, and the milestone-age features carry the most signal, exactly the human-legible story from the EDA (survive four years, hit a milestone, build more than one relationship). The individual funding-round flags (`has_roundB`, `has_roundC`, `has_roundD`) matter less on their own than the *count* of rounds and the presence of milestones. Raising money is table stakes; *doing things with it* — shipping milestones, building relationships, surviving — is what separates the acquired from the closed.

## Honest limits

I'd tell you all of this at a whiteboard before I'd let you act on the number:

- **The cross-validated 0.922 is optimistic, and I trust the 0.845 holdout more.** The oversampling with `RandomOverSampler` was applied to the training set *before* `cross_val_score` ran over it. `RandomOverSampler` duplicates minority rows, so the same startup can land in both a training fold and its validation fold — the model has effectively seen the answer. That inflates every CV score in this write-up. The 0.845 measured on a clean, never-touched test split is the honest headline; the right fix is to oversample *inside* each fold via a pipeline, and I'd expect the CV number to come down toward the holdout if I did.
- **There's a subtle leakage risk in `age`.** It's computed as `last_date − founded_at`, where `last_date` is the *close date* for failures but the dataset's end-of-window (`31/12/2013`) for survivors. That means the feature's construction is partly a function of the label — a closed company's age is literally "time until it died." The model may be reading survival time as a proxy for the outcome, which won't be available for a live company you're actually trying to score.
- **The base rate is wrong for the real world.** Success is the majority class here (66%) only because this is a dataset of *trackable* companies. In reality, most startups fail and never accumulate the funding-and-milestone history that makes a row like these. A model calibrated to a 66% success base rate will be wildly overconfident when pointed at a random new company.
- **Survivorship and era.** The snapshot ends around 2013 and is heavily US-weighted (the `is_CA`/`is_NY`/`is_MA`/`is_TX` flags exist because those states dominate). A model that learned 2013-era, Silicon-Valley-shaped success has not been shown to hold for a different decade, geography, or funding climate. Generalization beyond the dataset era is asserted, not proven.
- **1.0 training accuracy is a standing warning.** The tree members memorized the training set. The ensemble and the held-out test are what keep that honest — but it's a reminder that on 838 rows, the gap between "learned the pattern" and "learned the training set" is thin.

## What I took from it

The lesson here isn't "ensembles win." On this dataset, the best single model matched the ensemble on a point score. The lesson is subtler and more useful: **the ensemble wins on the axis you can't see from one number — stability.** When your data is noisy and small and your best trees are one step from overfitting, you don't want the model that scores highest on a lucky split; you want the one that scores *reliably* high across splits, because that's the one that'll behave when the next batch of startups looks a little different. Hard voting over a deliberately diverse bench buys exactly that.

The other lesson is that the honest number is smaller than the notebook's happiest number, and knowing *why* — the oversampling-before-CV leak, the label-correlated `age`, the curated base rate — is worth more than the extra accuracy points would have been. That's the version of a result I trust: the one that tells you where it's soft.

For the notebook, the dataset, and the full comparison, see the [GitHub repo](https://github.com/abuammarsami/Startups-Success-Prediction-using-Ensemble-Classification) and the [project entry](/work/startup-success-prediction).
