---
title: "Finding Attacks You've Never Seen: Network Anomaly Detection with Knowledge Distillation"
series: ml-research
order: 3
summary: "Signature-based defenses only catch attacks they already know. This is how you frame intrusion detection as anomaly detection — learning 'normal' so well that novel attacks stand out — and use knowledge distillation to make it deployable."
readingMinutes: 16
date: 2026-07
tags: [security, anomaly-detection, knowledge-distillation, intrusion-detection, research, deep-learning]
status: active
---

## The blind spot in every signature-based defense

A traditional intrusion detection system works like a bouncer with a photo book. It has a list of known-bad patterns — this byte sequence is the SQL Slammer worm, that packet shape is a known port-scan tool — and it flags traffic that matches. This is fast, it's precise, and it has one fatal property: **it can only catch attacks someone has already seen, named, and written a signature for.**

The moment an attacker changes their tooling, mutates a payload, or invents something genuinely new, the photo book is useless. There's no entry for a face that's never been photographed. That gap — between the attacks we've catalogued and the attacks that haven't happened yet — is exactly where zero-day intrusions live.

This was the problem my research partner and I set out to explore at North South University, in a report titled *Exploring New Attack Patterns in Computer Networks through Anomaly Detection and Knowledge Distillation*. The premise is a reframe that sounds almost too simple: **stop trying to enumerate every possible attack, and instead learn what normal looks like so well that anything abnormal announces itself.** Then — because the models good enough to do that tend to be too heavy to deploy on a network appliance — use knowledge distillation to compress the detector into something you can actually run.

This is the honest walkthrough of that idea: what worked, what didn't, and the negative result I think is the most valuable thing in the whole report.

:::aside
Reading as an academic? Flip the ⟨lens| in the top nav to **professor** to reveal the derivations, ablation tables, and hyperparameters inline.
:::

![Fig. 1 — the pipeline: raw CICIDS2017 flows become standardized features, a model learns the shape of normal (80.3% benign), and each flow is scored so the rare attack trips an alert threshold.](/figures/research-anomaly-pipeline.svg)

## The reframe: from "match the attack" to "model the normal"

Signature detection asks a closed-world question: *is this traffic one of the bad things I know about?* Anomaly detection asks an open-world one: *is this traffic unlike the normal I've learned?*

The difference matters because of what each one generalizes to. A signature model's knowledge is a finite list; its coverage of unseen attacks is exactly zero by construction. An anomaly model's knowledge is a *shape* — a learned boundary around the region of feature space where benign traffic lives. Anything that falls outside that boundary is flagged, whether or not anyone has ever named it. A brand-new attack doesn't need to match a catalogued pattern; it just needs to look different from normal, and attacks almost always do — they scan too many ports, they open too many half-connections, they move data in shapes normal sessions don't.

The catch is that "normal" on a real network is enormous, noisy, and varied. Learning it tightly enough that novel attacks reliably fall outside it — without flagging every legitimate-but-unusual burst of traffic — is the entire difficulty. That's what makes this a machine-learning problem and not a rules problem.

## The dataset: CICIDS2017

You can't study this on toy data, and you can't ethically study it on a live network. We used **CICIDS2017**, a benchmark that has become a standard in intrusion-detection research precisely because it's realistic. It's a collection of network-traffic captures recorded across five days — Monday through Friday — as a set of CSV files, each representing a different day and a different mix of activity.

Each row is a network *flow*, described by attributes the paper enumerates directly: source and destination IP addresses, source and destination port numbers, protocol type, packet size, and network-flow statistics, plus a target variable, `Label`, marking the flow as normal or malicious. The attack coverage is broad and deliberately diverse — the labels span **DDoS, port scanning, web attacks (broken out into brute force, XSS, and SQL injection), infiltration, FTP-Patator and SSH-Patator brute-forcing, several DoS variants (slowloris, Slowhttptest, Hulk, GoldenEye), Heartbleed, and botnet traffic** — alongside the dominant `BENIGN` class.

That word *dominant* is the thing to internalize before looking at any result. In our exploratory analysis, **`BENIGN` traffic made up 80.3% of the data.** The next largest class, DoS Hulk, was about 8.2%; port scanning about 5.6%; DDoS about 4.5%; and everything else trailed off into fractions of a percent — DoS GoldenEye at 0.36%, the Patator brute-forcers around 0.2–0.3%, the botnet at 0.07%, the web attacks down in the hundredths (brute force 0.05%, XSS 0.02%), and infiltration, SQL injection, and Heartbleed rarest of all at a few ten-thousandths of a percent. This is not a quirk. It's the *defining* feature of intrusion detection: the interesting events are rare. Normal traffic drowns out attacks by an order of magnitude or more, and that imbalance dictates almost every methodological choice that follows.

We also did the per-day breakdown the dataset invites — traffic is not evenly distributed across the week, with **Friday carrying the heaviest daily volume** (roughly 700k flows), Wednesday close behind, and Tuesday the lightest — useful context for when activity clusters, though the modelling was done on the combined data. (The paper's own figure titles this "attacks by day," but the bars are really total flows per day.)

## Why accuracy is a trap here, and what we used instead

Here's the trap the class imbalance sets. If 80.3% of your traffic is benign, a model that does nothing but predict "benign" for every single flow scores 80.3% accuracy. It has caught zero attacks — it is worse than useless, actively dangerous — and it still posts a number that looks like a passing grade. Accuracy, on imbalanced data, rewards the model for ignoring exactly the thing you built it to find.

So we didn't select on accuracy. The report's model-selection criterion is **macro-F1** — the F1 score computed per class and then averaged with *equal weight* across classes, so the rare Heartbleed class counts as much as the massive BENIGN one. Because macro-averaging refuses to let the majority class carry the score, a model can only earn a high macro-F1 by actually getting the small attack classes right. We still tracked plain accuracy alongside it — mostly as a check on over- or under-fitting — but macro-F1 on the validation set was the basis for choosing between models.

That one decision is what makes the numbers later meaningful rather than flattering.

:::professor[The macro-F1 selection criterion]
The report selects models by macro-averaged $F_1$ with $\beta = 1$. Writing $l$ for the number of classes and $tp_i, fp_i, fn_i$ for the per-class confusion counts, macro-precision and macro-recall average the per-class rates with equal weight:

$$
\text{Precision}_{\text{macro}} = \frac{1}{l}\sum_{i=1}^{l} \frac{tp_i}{tp_i + fp_i}, \qquad
\text{Recall}_{\text{macro}} = \frac{1}{l}\sum_{i=1}^{l} \frac{tp_i}{tp_i + fn_i}
$$

$$
F1_{\text{macro}} = \frac{(\beta^2 + 1)\,\cdot\,\text{Precision}_{\text{macro}}\,\cdot\,\text{Recall}_{\text{macro}}}{\beta^2\,\cdot\,\text{Precision}_{\text{macro}} + \text{Recall}_{\text{macro}}}
$$

The equal $\tfrac{1}{l}$ weighting is the whole point: it decouples the score from the class prior. Under **micro**-averaging the counts would be pooled across classes first, and BENIGN's 80.3% mass would dominate — recovering exactly the accuracy trap. $\beta$ is a knob to bias the harmonic mean toward precision ($\beta < 1$) or recall ($\beta > 1$); the report fixes $\beta = 1$ for all runs, the balanced case. A companion accuracy $Acc = \tfrac{tp + tn}{tp + tn + fp + fn}$ is tracked only as an over-/under-fit sanity check, never as the selection target.
:::

## The approach: pick a strong teacher, then distill

The architecture in the report has a clear shape: **Dataset → data pre-processing and feature engineering → a supervised learning model → (distill knowledge) → an unsupervised anomaly-detection stage → performance evaluation.** Preprocessing handled the usual realities — missing values, dropping irrelevant features, encoding categoricals, and standardizing so no single feature dominated by scale alone.

The idea binding the two model stages together is knowledge distillation. The plan was to train a strong *supervised* model on the labelled attacks — the model that recognizes known attack patterns accurately — and then transfer what it had learned into a model meant to generalize toward the *unseen*. A strong supervised classifier learns a rich decision boundary; distillation is the mechanism for handing that boundary to a second, simpler model you can actually deploy.

But "the supervised model" isn't one thing — you have to pick it. So we trained four classical baselines and let macro-F1 choose the teacher. The **Decision Tree won cleanly** at 0.97 test macro-F1, with KNN a close second (0.96), and Logistic Regression and Naive Bayes well behind (0.74 and 0.67). That gap is itself informative: the attack/benign boundary in this feature space isn't something a linear model or a strong independence assumption captures well. The tree, which carves feature space into axis-aligned regions, fit it almost perfectly — so it became the teacher.

![Fig. 3 — test macro-F1 by model. The Decision Tree teacher tops the chart at 0.97; the distilled neural-net student lands at 0.75, down near the linear baselines and 22 points below the tree it learned from.](/figures/research-anomaly-results.svg)

:::professor[Model-selection table and training setup]
The full evaluation grid (report Table I), validation and test, macro-F1 and accuracy:

| Model | Val macro-F1 | Val Acc | Test macro-F1 | Test Acc |
|---|:--:|:--:|:--:|:--:|
| Logistic Regression | 0.76 | 0.87 | 0.74 | 0.85 |
| **Decision Tree — *teacher*** | **0.98** | **0.99** | **0.97** | **0.98** |
| KNN | 0.98 | 0.99 | 0.96 | 0.98 |
| Naive Bayes | 0.67 | 0.80 | 0.67 | 0.79 |
| Student (neural network) | 0.78 | 0.80 | 0.75 | 0.79 |

Read the columns together. Logistic Regression's 0.87/0.85 accuracy with only 0.76/0.74 macro-F1 is the imbalance signature — it is riding the BENIGN prior and quietly failing the rare classes; the macro metric exposes exactly what accuracy hides. The Decision Tree and KNN both post ~0.99 accuracy *and* ~0.97 macro-F1, so they are genuinely resolving the minority attack classes, not just the majority. The tree edges KNN on macro-F1 and is far cheaper at inference than a lazy $k$-NN over a multi-million-row flow table, which makes it the natural teacher.

**On hyperparameters and reproducibility:** the report is thin here, and I won't invent what it doesn't state. It does *not* publish the distillation temperature $T$, the loss-mixing weight $\alpha$, the student's layer widths, the optimizer/learning-rate schedule, or the exact train/val/test split ratio — only the four columns above and the architecture diagram. It also reports **no model-size or wall-clock latency numbers** for the teacher-vs-student trade-off; the abstract's "faster detection" is asserted, not measured. Treat every quantitative claim below as scoped to those five rows on CICIDS2017.
:::

## Knowledge distillation from first principles

Since distillation is the load-bearing idea, it's worth building up from scratch — because understanding it correctly is exactly what explains our result.

When you train a classifier normally, you show it **hard labels**: this flow is attack (1), that one is benign (0). Those labels carry one bit of information each. But a *trained* model knows more than the label — its output probabilities encode how confident it is and, crucially, how it relates the classes. A model looking at a port scan might output 0.88 "port scan," 0.09 "DDoS," 0.03 "benign." Those runner-up probabilities are what Geoffrey Hinton called **dark knowledge**: the model is quietly telling you that a port scan looks a little like a DDoS and nothing like benign traffic. That relational structure is far richer than the single hard label "port scan."

Knowledge distillation is the trick of training a smaller **student** to match the teacher's full probability distribution — its **soft targets** — instead of the hard labels. You soften the teacher's outputs with a **temperature** $T$: dividing the logits by $T$ before the softmax spreads the probability mass out, so those small but meaningful runner-up probabilities become large enough to actually teach from. The student learns not just *what* the answer is but *the shape of the teacher's uncertainty around it* — a much denser training signal per example. In security terms, the hope is that a student trained on that softened boundary inherits a smoother, more general sense of "attack-like" rather than the teacher's crisp, brittle, memorized cutoffs — precisely the property you'd want when facing an attack the teacher never saw.

:::professor[The distillation objective and the temperature]
Let $z_t$ and $z_s$ be the teacher and student logits. The **softened** distribution at temperature $T$ is a tempered softmax:

$$
p_i(z; T) = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}
$$

At $T = 1$ this is the ordinary softmax; as $T \to \infty$ it flattens toward uniform, exposing the runner-up mass ("dark knowledge") that a peaked $T=1$ distribution buries. The student minimizes a convex blend of a **soft** term (match the teacher) and a **hard** term (match the ground truth $y$):

$$
\mathcal{L} = (1 - \alpha)\,\underbrace{\mathrm{CE}\!\big(y,\, p(z_s; 1)\big)}_{\text{hard labels}} \;+\; \alpha\,T^2\,\underbrace{\mathrm{KL}\!\big(p(z_t; T)\,\|\,p(z_s; T)\big)}_{\text{soft targets}}
$$

The $T^2$ factor is not cosmetic: the gradients of the soft term scale as $1/T^2$, so multiplying by $T^2$ keeps the soft and hard gradients on comparable footing as $T$ varies. The KL term is what carries the teacher's inter-class geometry into the student.

Here is the crux for *this* project. That whole machinery **presupposes a teacher whose $p(z_t; T)$ actually has structure to soften.** A decision tree's class posterior at a leaf is just the empirical class frequency of the training samples that landed there — frequently a hard $1.0 / 0.0$, or a coarse fraction — and it has **no logits and no temperature-tunable smoothness**. Softening a distribution that is already a one-hot spike does nothing: $p(z_t; T)$ stays effectively one-hot for any $T$. So the KL term degenerates toward the hard cross-entropy, $\alpha$ stops buying you anything, and "distillation" quietly collapses into ordinary supervised training on a *weaker* label than you started with — you've thrown away the tree's exactness without gaining any dark knowledge in return.
:::

That's the theory. It's the theory that motivated the whole report. Here's what actually happened.

![Fig. 2 — the transfer: a decision-tree teacher (test macro-F1 0.97) whose leaves emit hard 1.0/0.0 posteriors is distilled into a neural-net student, which lands at 0.75 — roughly 22 macro-F1 points lost, because there was almost no dark knowledge to soften.](/figures/research-anomaly-distillation.svg)

## The result I'm proudest of, because it disappointed us

We distilled the Decision Tree teacher into a neural-network student. The student landed at **0.75 test macro-F1 / 0.79 accuracy** (0.78 / 0.80 on validation).

Set that against the teacher's 0.97 test macro-F1. The student recovered a little over three-quarters of the way there and lost roughly **22 macro-F1 points** in the transfer. The knowledge did not distill cleanly. As the report puts it plainly, the student "could not enrich the black-box knowledge from the decision tree that much as we expected."

I want to be clear that we published that number rather than bury it, because the *reason* it happened is the real finding — and it traces straight back to the first-principles view of distillation above.

**Distillation runs on soft targets, and a decision tree barely has any.** The dark knowledge that makes distillation work is a calibrated probability distribution — the smooth 0.88 / 0.09 / 0.03 that encodes how classes relate. A neural-network teacher produces exactly that. A decision tree does not. A tree's "probability" for a leaf is just the class frequency of the training samples that fell into it — often a hard 1.0 / 0.0. There's little relational structure and no temperature-tunable smoothness to soften. When your soft targets collapse toward hard labels, distillation quietly degrades into ordinary supervised training on a weaker signal — and you're asking a neural network to reproduce a function built from thousands of hard, axis-aligned splits, a shape it isn't naturally suited to represent. The sharp splits a tree encodes simply don't survive the trip through a softmax.

That's the boundary of the technique, learned by hitting it: **distillation transfers a teacher's knowledge only as well as the teacher can express that knowledge in soft probabilities.** A tree wins the accuracy contest and then makes a poor teacher for exactly the same reason — its hard, discrete structure. The lesson generalizes cleanly: for distillation, pick a teacher whose knowledge is *soft* by nature, even if a harder-edged model scores a hair higher.

## Honest limits

Beyond the distillation result, a few things I'd flag before anyone treats this as deployable:

- **The abstract oversells.** It describes "a zero false negative rate, ensuring that no listed attacks go undetected." That's a claim about the strong *supervised* detector on this dataset, and it should be read against the 0.75-macro-F1 *student* the same report measured. The headline detector and the deployable one are not the same model, and the gap between them is the story.
- **A benchmark is not a network.** CICIDS2017 is realistic for a captured dataset, but it's five days, one topology, a fixed menu of attacks. A model that separates benign from attack here has not been shown to hold up against traffic drift, a different network's baseline of "normal," or an attacker actively shaping traffic to look benign. Generalization to genuinely novel attacks is the whole premise — and it's asserted more than proven, because you can't measure detection of an attack that isn't in your labels.
- **The unsupervised anomaly-detection stage stayed aspirational.** The architecture diagram promises distillation *into* an unsupervised detector for catching the never-before-seen; what we actually measured end-to-end was a supervised-tree-to-neural-student distillation on labelled classes. The full open-world claim is the direction, not the demonstrated result.

:::professor[Failure modes, and why the metric hides some of them]
Four ways this system breaks that a single macro-F1 number won't tell you about:

1. **The false-positive economics are the real constraint.** Macro-F1 keeps recall honest, but a security operator lives on the *precision* half of the trade-off. With BENIGN at 80.3% of traffic, even a 1% false-positive rate on benign flows produces an alert stream that dwarfs the true attacks by base-rate arithmetic — the classic base-rate fallacy of intrusion detection. Alert fatigue is how good detectors get switched off. A deployed system should be tuned on a cost-weighted operating point (or a precision-at-fixed-recall target), not on the balanced $\beta = 1$ that model *selection* used.
2. **Concept drift dissolves "normal."** The learned boundary is a snapshot of one week's traffic. Real networks shift — new services, new user behaviour, seasonal load — and yesterday's normal becomes today's anomaly, spiking false positives with no attacker involved. Nothing here re-estimates the boundary online, so the detector's calibration decays silently after deployment.
3. **Unseen-attack generalization is unfalsifiable on this data.** The open-world promise — flag attacks nobody labelled — cannot be measured against a closed, fully-labelled benchmark. A leave-one-attack-class-out protocol (train with a class held out, test whether it still scores as anomalous) would have been the honest way to probe it; the report doesn't run one, so "detects novel attacks" remains a design intention rather than a demonstrated capability.
4. **The teacher choice caps the ceiling.** Because the tree teacher is a poor soft-target source, the *right* fix is architectural, not a hyperparameter sweep: distill from a probabilistic teacher (a calibrated neural net, or a gradient-boosted ensemble with temperature-scaled outputs) whose $p(z_t; T)$ carries genuine inter-class structure. That is the single change most likely to close the 22-point gap — and the concrete next experiment this negative result points to.
:::

## What I took from it

This report closed a loop for me. I'd used knowledge distillation before, in a Bangla part-of-speech tagging project, and walked away with a working student but never a full accounting of *where the technique breaks*. Here I got that accounting — same trick, different domain, and this time a complete measurement of the student against its teacher. The number that disappointed us taught me more than a clean success would have: it told me precisely what kind of teacher distillation needs, and why the best classifier is not automatically the best teacher.

That's the version of research I trust — the one that publishes the gap.

For the paper, the model table, and the full write-up, see [the research entry](/research/network-anomaly-detection).
