---
title: "Will This Startup Make It? Ensemble Classification on Startup Data"
series: ml-research
order: 6
summary: "Predicting startup success from funding, milestones, and firmographics — and why an ensemble of models beats any single one. What features actually carried signal, which ensemble method won, and how honest the accuracy really is on a noisy, imbalanced problem."
readingMinutes: 16
date: 2026-07
tags: [machine-learning, ensemble-methods, classification, data-science, research]
status: active
---

## The question, and why it resists a clean answer

Point at a young company and ask the only question that matters to a founder or an investor: *does this one make it?* By "make it" I mean the outcome the data can actually observe — the startup gets **acquired** (or reaches an IPO), versus it **closes**. Everything in between — the zombies, the pivots, the still-private-and-uncertain — the dataset collapses into one of those two buckets: `acquired = 1`, `closed = 0`.

The reason this is hard has nothing to do with which classifier you reach for. It's that startup outcomes are driven by a hundred weak, interacting signals — funding, timing, market, team, luck — and no single one of them is decisive. A company can raise four rounds and die; another can raise once and get acquired. The signal is real but diffuse, smeared across features that only matter in combination. That's exactly the regime where a single model struggles: a linear boundary is too rigid to catch the interactions, and one deep tree memorizes the training set instead of learning the pattern. This write-up is the honest account of building an **ensemble** on this problem — what carried signal, which ensemble method won, and how much of the headline accuracy I actually believe.

This is the machine-learning half of a paper I co-authored at North South University, *"Startups Success Prediction Using Ensemble Learning."* The narrative below is the whiteboard version; the derivations, the full ablation table, and the hyperparameters live in the professor lens.

:::aside
Reading as an academic? Flip the ⟨lens| in the top nav to **professor** to reveal the derivations, ablation tables, and hyperparameters inline.
:::

![The tuned voting ensemble — a startup's 32 features fan out to six diverse base learners, five vote success and the SVM dissents, and a hard majority vote returns one stable call.](/figures/research-startup-ensemble.svg)

## The data

The dataset is a Crunchbase-style table of **923 startups described by 49 columns** — one row per company, the kind of firmographic snapshot you'd assemble from a startup database. It was obtained from a vendor on a trial basis and is scoped to companies operating between roughly **2005 and 2012**, each already resolved to *acquired* or *closed* within that window — which is what makes supervised learning possible at all, and also, as I'll argue at the end, what makes the numbers softer than they look. The target lives in two mirrored columns: `status` reads `acquired` or `closed`, and `labels` encodes the same thing as `1` (success) or `0` (failure). Every model trains against `labels`.

The features fall into a few natural families:

- **Funding.** `funding_rounds`, `funding_total_usd`, and a set of binary flags for *what kind* of money came in — `has_VC`, `has_angel`, and `has_roundA` through `has_roundD` — plus `avg_participants` (how many investors joined rounds on average).
- **Timing / maturity.** `age_first_funding_year`, `age_last_funding_year`, `age_first_milestone_year`, `age_last_milestone_year` — all measured in years relative to founding — and the raw dates `founded_at`, `closed_at`, `first_funding_at`, `last_funding_at`.
- **Traction.** `relationships` (business connections), `milestones` (count of notable achievements), and `is_top500`.
- **Geography.** One-hot state flags `is_CA`, `is_NY`, `is_MA`, `is_TX`, `is_otherstate`, plus raw `state_code`, `city`, `zip_code`, `latitude`, `longitude`.
- **Sector.** `category_code` and its one-hot expansion — `is_software`, `is_web`, `is_mobile`, `is_enterprise`, `is_advertising`, `is_gamesvideo`, `is_ecommerce`, `is_biotech`, `is_consulting`, `is_othercategory`.

**The imbalance is worth naming up front, because it runs the opposite way from most failure-prediction problems.** In the raw table the split is **597 acquired against 326 closed**, and after cleaning it settles at **551 acquired to 287 closed** — roughly **66% to 34%**. Success is the *majority* class. That's not because startups usually succeed; it's a curation artifact. This is a dataset of companies notable enough to be tracked with funding histories and milestones, so the base rate is nothing like the real world's, where most startups quietly die. I'll come back to this — it's the single biggest reason to distrust the headline number.

### Preprocessing: the missing-value archaeology

The raw table carries **1,386 missing values**, and the cleanup is more forensic than mechanical because each gap *means* something:

- **`closed_at` was 63.7% missing (588 rows)** — and that's not noise, it's signal. A company with no close date is one that *hadn't closed*. It's filled with `31/12/2013`, treating the end of the observation window as "still alive as of the snapshot."
- **`Unnamed: 6` was 53.4% missing (493 rows).** Inspection showed it was a concatenation of `city`, `state_code`, and `zip_code`, so it's rebuilt from those columns rather than imputed.
- **`age_first_milestone_year` and `age_last_milestone_year` were each 16.5% missing (152 rows).** These are null precisely when `milestones = 0` — a company with no milestones has no milestone dates — so they're filled with `0`.
- **`state_code.1`** turned out to be a duplicate of `state_code` and got dropped.

Then feature engineering: an `age` column is derived as `last_date − founded_at` in years, and rows with negative ages (data-entry impossibilities) are dropped, which is what takes the working set down to **838 rows**. Skewed monetary and time features get tamed two ways — a `MinMaxScaler` normalization producing `norm_relationships`, `norm_age_first_funding_year`, `norm_funding_total_usd`, and a `log1p` transform on the four age-year columns to pull in their long right tails. The final design matrix `X` uses **32 features**, and `y` is `labels`.

## The EDA that actually told me something

Before any model, the exploratory pass surfaced three relationships worth stating as plain business insight, because they're the human-legible version of what the models later exploit:

- **Age.** Startups that survive **more than four years** succeed at over **52%** — longevity itself is a signal.
- **Milestones.** A startup with **at least one milestone** succeeds at over **60%**. Zero milestones is a strong negative.
- **Relationships.** More than one business relationship pushes success past **61%**.

And a sobering counterweight: the average *closed* startup in this data lived about **six years** (2,184 days) before shutting down. Failure here isn't fast; it's a slow fade, which is part of why it's hard to call early.

## The base models

The strategy was deliberately plural: train a diverse bench of classifiers, measure each one honestly, and only then think about combining them. The pipeline before modeling matters — a **70/30 train/test split** (`random_state=42`), then **`RandomOverSampler`** applied to the *training set* to balance the classes (which grows the training set to 798 rows), then a `MinMaxScaler` fit on the training folds. Feature selection cross-checked redundancy three ways: a `VarianceThreshold` (which dropped nothing — no constant columns survived cleaning), a Pearson-correlation filter at 0.9 (which also dropped nothing — **zero** pairs cleared the threshold), and mutual-information ranking, which is where the real feature story comes from.

Here's how the individual classifiers did on the **held-out test set** — n = 252, of which 100 closed and 152 acquired. These are the numbers I trust most, because they're measured on data no model touched during training:

| Model | Test accuracy | Precision (success) | Recall (success) | F1 (success) |
|---|---|---|---|---|
| **LightGBM** | **0.857** | 0.84 | 0.94 | **0.89** |
| Random Forest | 0.849 | 0.82 | 0.96 | 0.88 |
| XGBoost | 0.849 | 0.84 | 0.93 | 0.88 |
| Logistic Regression | 0.837 | 0.89 | 0.84 | 0.86 |
| AdaBoost | 0.833 | 0.85 | 0.88 | 0.86 |
| Gradient Boosting | 0.829 | 0.82 | 0.91 | 0.87 |
| SVM (RBF) | 0.762 | 0.78 | 0.84 | 0.81 |

Two things jump out. **The gradient-boosted trees and the random forest cluster at the top (~0.85), and the RBF SVM trails badly (0.76).** And notice the recall column: every tree model has *high recall on success and lower recall on failure* — they're biased toward calling "acquired," which is exactly what you'd expect from a 66%-success training set even after oversampling. Logistic regression is the mirror image: the best *precision* on success (0.89) and the most balanced profile, a hint that the decision boundary has a strong near-linear component.

The other thing, visible only if you look at training scores: **LightGBM, Random Forest, and Gradient Boosting all hit 1.0 training accuracy.** They memorized the training set perfectly. Logistic regression, by contrast, scored 0.77 on train and 0.84 on test — it isn't overfitting at all. The trees are riding right at the edge of overfitting, and holding them there is precisely the job an ensemble does well.

:::professor
**The full per-model bench, including training accuracy and a balanced-accuracy proxy.** The last column is what the notebook labels "ROC-AUC," but it was computed by feeding *thresholded* class predictions (not probabilities) to `roc_curve`. That collapses the curve to a single operating point, so the number is really **balanced accuracy** $\tfrac{1}{2}(\mathrm{TPR}+\mathrm{TNR})$ — I've relabeled it honestly. (Check: LightGBM's success-recall is 0.94 and its failure-recall 0.73; their mean is 0.835, exactly the reported figure.)

| Model | Train acc | Test acc | Prec (1) | Rec (1) | F1 (1) | Bal. acc |
|---|---|---|---|---|---|---|
| LightGBM | 1.000 | 0.857 | 0.84 | 0.94 | 0.89 | 0.835 |
| Random Forest | 1.000 | 0.849 | 0.82 | 0.96 | 0.88 | 0.820 |
| XGBoost | 0.949 | 0.849 | 0.84 | 0.93 | 0.88 | 0.829 |
| Logistic Regression | 0.768 | 0.837 | 0.89 | 0.84 | 0.86 | **0.838** |
| AdaBoost | 0.877 | 0.833 | 0.85 | 0.88 | 0.86 | 0.821 |
| Gradient Boosting | 1.000 | 0.829 | 0.82 | 0.91 | 0.87 | 0.807 |
| SVM (RBF) | 0.851 | 0.762 | 0.78 | 0.84 | 0.81 | 0.741 |
| **Voting (hard)** | — | **0.845** | — | — | — | — |

Read the train/test gap as an overfitting gauge: the three 1.000-train models have gaps of 0.14–0.17, while logistic regression has a *negative* gap (test > train) — it's underfit if anything. The standalone Gradient Boosting here was hand-set to `learning_rate=0.02, max_depth=4, n_estimators=1000` (a slow, shallow, many-tree configuration) and still hit 1.0 on train, which tells you how separable the *training* set is once it's oversampled.
:::

I also ran a **10-fold stratified cross-validation** across a wider bench, which reorders things: ExtraTrees (0.927) and Random Forest (0.921) lead, LightGBM follows (0.916), and the linear / naive models sit at the bottom (Logistic Regression 0.747, KNN 0.684, ComplementNB 0.668). But hold that CV framing loosely — I'll explain in the limits why those numbers are rosier than the holdout.

## Ensembling from first principles

Why combine models at all? The clean way to see it is the **bias–variance decomposition** of a model's error. A single deep decision tree has *low bias* (it can fit almost any shape) but *high variance* (shuffle the training data and it grows a very different tree). A single logistic regression is the reverse — *high bias, low variance*. Neither is what you want alone.

The ensemble insight is that **variance averages away when you combine diverse predictors, while bias does not get worse.** Imagine six classifiers that are each right ~80% of the time and — crucially — wrong on *different* examples. When they vote, a mistake by one gets outvoted by the five that got it right. The errors have to be *uncorrelated* for this to work: six copies of the same overfit tree just reproduce the same mistakes six times and buy you nothing. That's why the bench was built to be *diverse* — a linear model, an RBF-kernel SVM, and several structurally different tree ensembles make errors in different regions of feature space, so their failures partially cancel when pooled.

:::professor
**Why decorrelation, specifically, is the lever.** Take $M$ base predictors, each with error variance $\sigma^2$ and average pairwise correlation $\rho$. The variance of their average is

$$
\operatorname{Var}\!\left(\frac{1}{M}\sum_{i=1}^{M} h_i\right) \;=\; \rho\,\sigma^2 \;+\; \frac{1-\rho}{M}\,\sigma^2 .
$$

The second term is killed by adding more models ($M\to\infty$), but the first term does **not** depend on $M$ — the variance floor is $\rho\sigma^2$. So once you have enough learners, the only way to keep reducing variance is to **lower $\rho$**: make the members disagree. Bagging lowers $\rho$ by resampling rows; random forests lower it further by also sampling features at each split; a heterogeneous bench (SVM + linear + boosted trees) lowers it most because the members aren't even the same *kind* of function.

For hard voting the classification analogue is **Condorcet's jury theorem**. If $M$ *independent* classifiers are each correct with probability $p > \tfrac12$, the majority vote is correct with probability

$$
P_{\text{maj}} \;=\; \sum_{k=\lceil M/2\rceil}^{M} \binom{M}{k}\, p^{k}\,(1-p)^{M-k} \;\xrightarrow[M\to\infty]{}\; 1 .
$$

The hard prediction is just $\hat{y} = \operatorname{mode}\{h_1(x),\dots,h_M(x)\}$. The catch is the word *independent*: correlated errors break the theorem exactly the way $\rho > 0$ raises the variance floor above. The whole game is engineering disagreement.
:::

There are a few ways to do the combining, and the notebook's choice is deliberate:

- **Bagging** (Random Forest, ExtraTrees) trains many models on bootstrap resamples and averages — pure variance reduction, already in play inside the base models.
- **Boosting** (AdaBoost, gradient boosting, LightGBM, XGBoost) trains models sequentially, each fixing the last one's mistakes — a bias reducer, also already represented.
- **Stacking** trains a meta-model to learn how to weight the base predictions — powerful but easy to overfit on 838 rows.
- **Voting** simply pools the base predictions — hard voting takes the majority class, soft voting averages probabilities.

The final model is a **hard-voting `VotingClassifier`** over six base learners: a grid-searched `AdaBoost`, a grid-searched RBF `SVC`, a grid-searched `GradientBoosting`, plus `RandomForest`, `ExtraTrees`, and `LightGBM`. Hard voting — majority rule — is the conservative pick here: with a small, noisy dataset, averaging soft probabilities lets one overconfident member dominate, whereas a majority vote is robust to any single model's miscalibration. Given that three of the members sit at 1.0 training accuracy, robustness over cleverness was the right call.

:::professor
**The tuning, in full.** Three of the six members were grid-searched under the same 10-fold stratified CV before being frozen into the vote:

| Member | Search grid | Best CV |
|---|---|---|
| AdaBoost (Decision-Tree base) | `criterion` ∈ {gini, entropy}, `splitter` ∈ {best, random}, `algorithm` ∈ {SAMME, SAMME.R}, `n_estimators` ∈ {1, 2}, `learning_rate` ∈ {0.0001 … 1.5} | 0.874 |
| SVC (RBF) | `gamma` ∈ {0.001, 0.01, 0.1, 1}, `C` ∈ {1, 10, 50, 100, 200, 300, 1000} | 0.867 |
| Gradient Boosting | `loss` = deviance, `n_estimators` ∈ {100, 200, 1000}, `learning_rate` ∈ {0.001, 0.01, 0.05, 0.1, 1, 10}, `max_depth` ∈ {4, 8}, `min_samples_leaf` ∈ {100, 150}, `max_features` ∈ {0.3, 0.1} | 0.901 |

The remaining three (`RandomForest`, `ExtraTrees`, `LightGBM`) went in at library defaults with a fixed `random_state`. The vote is `voting='hard'`, `n_jobs=-1`. Note the AdaBoost grid caps `n_estimators` at 2 — it's a deliberately weak, high-bias member, there for *diversity* rather than solo strength, which is exactly the right reason to include a model in a vote.
:::

## Results: does the ensemble actually win?

On the **held-out test set, the voting ensemble scores 0.845 accuracy.** Look back at the table: that's *right in the pack* — a hair below LightGBM's 0.857 and level with Random Forest and XGBoost. On this single split, the ensemble did **not** beat the best individual model; it matched the leaders.

That is not a disappointing result, and it's worth being precise about why. The ensemble's win isn't a higher point score on one lucky split — it's **lower variance across splits.** Under 10-fold cross-validation the voting classifier scores **0.922 ± 0.041**, and the number to watch is that standard deviation: the ensemble delivers top-tier accuracy *with a tighter spread* than a lone overfit tree that swings with the training data. When you can't tell in advance which single model will happen to fit the next batch of startups best, the ensemble is the bet that doesn't require you to guess right.

![Held-out test accuracy for every base model against the voting ensemble — the ensemble (teal) lands among the leaders at 0.845, LightGBM tops out at 0.857, and the RBF SVM is the outlier at 0.762.](/figures/research-startup-model-comparison.svg)

:::professor
**The 10-fold stratified CV bench**, mean accuracy ± std on the oversampled training set. This is where the ensemble's *stability* argument is actually visible — look at the std column, not just the mean:

| Model | CV mean | CV std |
|---|---|---|
| ExtraTrees | 0.927 | 0.056 |
| **Voting (hard)** | **0.922** | **0.041** |
| Random Forest | 0.921 | 0.047 |
| LightGBM | 0.916 | 0.048 |
| Gradient Boosting | 0.897 | 0.030 |
| XGBoost | 0.879 | 0.044 |
| Decision Tree | 0.871 | 0.047 |
| AdaBoost | 0.870 | 0.056 |
| LDA | 0.777 | 0.034 |
| SVC | 0.776 | 0.059 |
| SGD | 0.771 | 0.033 |
| Logistic Regression | 0.747 | 0.036 |
| KNN | 0.684 | 0.060 |
| ComplementNB | 0.668 | 0.044 |

ExtraTrees edges the vote on the mean (0.927 vs 0.922) but with a *wider* spread (0.056 vs 0.041). The ensemble buys the third-best mean for the second-tightest deviation among the strong models — the classic "give up a fraction of a point of peak for a meaningful cut in variance" trade. That is the entire case for shipping the vote over the single best tree, and it's why the paper concludes the voting classifier is "the best model for this problem" — best on *reliability*, not on any single column.
:::

## What actually predicted success

Here the mutual-information ranking corrects a tempting but wrong intuition. It would be natural to guess that *raw counts* — `relationships`, `milestones`, `is_top500` — carry the most signal, because that's the story the EDA tells in plain English. But mutual information on the modeled features says the strongest predictors are **maturity and money-in**: the age of the last milestone, the age of the last funding round, the age of the first milestone, and the (normalized) total funding raised all outrank the raw counts. Longevity and the *timeline* of achievement matter more than the achievement tally itself.

![Top features by mutual information with the success label — milestone-timing, funding-timing, and total funding dominate, while sector and geography one-hots score near zero.](/figures/research-startup-features.svg)

The human-legible version still holds — survive four years, hit a milestone, raise money — but the model reads it through *when* those things happened, not just whether they did. And the flip side is just as telling: nearly all the one-hot **sector and geography flags score essentially zero** mutual information. Being a software company, or being in California, tells the model almost nothing about the outcome once you know the funding-and-milestone timeline. Raising money is table stakes; *doing things over time* — shipping milestones, building relationships, surviving — is what separates the acquired from the closed.

:::professor
**Mutual information $I(X_j; y)$ per feature**, top of the ranked list (computed on the oversampled training design matrix, 32 features):

| Feature | MI |
|---|---|
| age_last_milestone_year | 0.200 |
| age_last_funding_year | 0.183 |
| age_first_milestone_year | 0.152 |
| norm_funding_total_usd | 0.146 |
| age | 0.141 |
| norm_age_first_funding_year | 0.131 |
| norm_relationships | 0.107 |
| avg_participants | 0.064 |
| is_consulting | 0.048 |
| funding_rounds | 0.048 |
| milestones | 0.047 |
| has_roundC | 0.038 |
| is_top500 | 0.033 |

…and a long tail that decays to **exactly 0.000** for `is_MA`, `is_TX`, `is_ecommerce`, `is_othercategory`, `has_VC`, `has_angel`, and `is_otherstate`. Two cautions on reading this. First, MI is a *marginal, univariate* score — it can't see the interactions the trees actually exploit, so a flag at MI ≈ 0 isn't necessarily worthless *in combination*. Second, the top of this list is dominated by exactly the age/timing features implicated in the leakage risk below, so treat "maturity predicts success" as partly an artifact of how the labels and the timeline were constructed, not a clean causal claim.
:::

## Honest limits

I'd tell you all of this at a whiteboard before I'd let you act on the number:

- **The cross-validated 0.922 is optimistic, and I trust the 0.845 holdout more.** The oversampling with `RandomOverSampler` was applied to the training set *before* `cross_val_score` ran over it. `RandomOverSampler` duplicates minority rows, so the same startup can land in both a training fold and its validation fold — the model has effectively seen the answer. That inflates every CV number in this write-up. The 0.845 measured on a clean, never-touched test split is the honest headline; the right fix is to oversample *inside* each fold via an imblearn `Pipeline`, and I'd expect the CV number to fall toward the holdout if I did.
- **There's a subtle leakage risk in `age` (and its cousins at the top of the MI table).** `age` is `last_date − founded_at`, where `last_date` is the *close date* for failures but the dataset's end-of-window (`31/12/2013`) for survivors. So the feature's construction is partly a function of the label — a closed company's age is literally "time until it died." That the milestone- and funding-age features top the mutual-information ranking is not entirely reassuring: the model may be reading survival time as a proxy for the outcome, and that proxy won't exist for a live company you're actually trying to score.
- **The base rate is wrong for the real world.** Success is the majority class here (66%) only because this is a dataset of *trackable* companies. In reality most startups fail and never accumulate the funding-and-milestone history that makes a row like these. A model calibrated to a 66% success base rate will be wildly overconfident when pointed at a random new company.
- **Survivorship and era.** The snapshot covers ~2005–2012 and is heavily US-weighted (the `is_CA`/`is_NY`/`is_MA`/`is_TX` flags exist because those states dominate). A model that learned 2012-era, Silicon-Valley-shaped success has not been shown to hold for a different decade, geography, or funding climate. Generalization beyond the dataset era is asserted, not proven.
- **1.0 training accuracy is a standing warning.** Three of the six ensemble members memorized the training set. The vote and the held-out test are what keep that honest — but on 838 rows, the gap between "learned the pattern" and "learned the training set" is thin.

:::professor
**If I were to take this to publication-grade, the fix list, in priority order:** (1) wrap the oversampler in an `imblearn.pipeline.Pipeline` so resampling happens *inside* each CV fold — this is the single change that would most move the reported numbers, and downward. (2) Drop or re-derive `age`/`closed_at`-dependent features and re-measure; if accuracy collapses, that quantifies the leakage. (3) Replace accuracy with a threshold-free metric on **predicted probabilities** — a true ROC-AUC and a precision-recall AUC — and re-weight for the real-world base rate rather than the curated 66%. (4) Report a calibration curve; a model this confident on a curated base rate is almost certainly miscalibrated for deployment. (5) Do a temporal split (train on the earlier cohort, test on the later) instead of a random split, since the deployment task is inherently forward-in-time. None of these would likely change the *ranking* of models — the vote would still be the stable choice — but they'd bring the *level* down to something you could honestly put in front of an investor.
:::

## What I took from it

The lesson here isn't "ensembles win." On this dataset, the best single model matched the ensemble on a point score. The lesson is subtler and more useful: **the ensemble wins on the axis you can't see from one number — stability.** When your data is noisy and small and your best trees are one step from overfitting, you don't want the model that scores highest on a lucky split; you want the one that scores *reliably* high across splits, because that's the one that'll behave when the next batch of startups looks a little different. Hard voting over a deliberately diverse bench buys exactly that.

The other lesson is that the honest number is smaller than the notebook's happiest number, and knowing *why* — the oversampling-before-CV leak, the label-correlated `age`, the curated base rate — is worth more than the extra accuracy points would have been. That's the version of a result I trust: the one that tells you where it's soft.

For the notebook, the dataset, and the full comparison, see the [GitHub repo](https://github.com/abuammarsami/Startups-Success-Prediction-using-Ensemble-Classification) and the [project entry](/work/startup-success-prediction).
