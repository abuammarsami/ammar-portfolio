---
title: "Finding Attacks You've Never Seen: Network Anomaly Detection with Knowledge Distillation"
series: ml-research
order: 3
summary: "Signature-based defenses only catch attacks they already know. This is how you frame intrusion detection as anomaly detection — learning 'normal' so well that novel attacks stand out — and use knowledge distillation to make it deployable."
readingMinutes: 12
date: 2026-07
tags: [security, anomaly-detection, knowledge-distillation, intrusion-detection, research, deep-learning]
status: active
---

## The blind spot in every signature-based defense

A traditional intrusion detection system works like a bouncer with a photo book. It has a list of known-bad patterns — this byte sequence is the SQL Slammer worm, that packet shape is a known port-scan tool — and it flags traffic that matches. This is fast, it's precise, and it has one fatal property: **it can only catch attacks someone has already seen, named, and written a signature for.**

The moment an attacker changes their tooling, mutates a payload, or invents something genuinely new, the photo book is useless. There's no entry for a face that's never been photographed. That gap — between the attacks we've catalogued and the attacks that haven't happened yet — is exactly where zero-day intrusions live.

This was the problem my research partner and I set out to explore at North South University, in a report titled *Exploring New Attack Patterns in Computer Networks through Anomaly Detection and Knowledge Distillation*. The premise is a reframe that sounds almost too simple: **stop trying to enumerate every possible attack, and instead learn what normal looks like so well that anything abnormal announces itself.** Then — because the models good enough to do that tend to be too heavy to deploy on a network appliance — use knowledge distillation to compress the detector into something you can actually run.

This is the honest walkthrough of that idea: what worked, what didn't, and the negative result I think is the most valuable thing in the whole report.

![Anomaly detection for intrusion — a model learns the shape of normal traffic so tightly that novel attack patterns fall outside it, and knowledge distillation compresses that detector into a smaller, deployable student.](/figures/research-anomaly.svg)

## The reframe: from "match the attack" to "model the normal"

Signature detection asks a closed-world question: *is this traffic one of the bad things I know about?* Anomaly detection asks an open-world one: *is this traffic unlike the normal I've learned?*

The difference matters because of what each one generalizes to. A signature model's knowledge is a finite list; its coverage of unseen attacks is exactly zero by construction. An anomaly model's knowledge is a *shape* — a learned boundary around the region of feature space where benign traffic lives. Anything that falls outside that boundary is flagged, whether or not anyone has ever named it. A brand-new attack doesn't need to match a catalogued pattern; it just needs to look different from normal, and attacks almost always do — they scan too many ports, they open too many half-connections, they move data in shapes normal sessions don't.

The catch is that "normal" on a real network is enormous, noisy, and varied. Learning it tightly enough that novel attacks reliably fall outside it — without flagging every legitimate-but-unusual burst of traffic — is the entire difficulty. That's what makes this a machine-learning problem and not a rules problem.

## The dataset: CICIDS2017

You can't study this on toy data, and you can't ethically study it on a live network. We used **CICIDS2017**, a benchmark that has become a standard in intrusion-detection research precisely because it's realistic. It's a collection of network-traffic captures recorded across five days — Monday through Friday — as a set of CSV files, each representing a different day and a different mix of activity.

Each row is a network *flow*, described by attributes the paper enumerates directly: source and destination IP addresses, source and destination port numbers, protocol type, packet size, and network-flow statistics, plus a target variable, `Label`, marking the flow as normal or malicious. The attack coverage is broad and deliberately diverse — the labels span **DDoS, port scanning, web attacks (broken out into brute force, XSS, and SQL injection), infiltration, FTP-Patator and SSH-Patator brute-forcing, several DoS variants (slowloris, Slowhttptest, Hulk, GoldenEye), Heartbleed, and botnet traffic** — alongside the dominant `BENIGN` class.

That word *dominant* is the thing to internalize before looking at any result. In our exploratory analysis, **`BENIGN` traffic made up 80.3% of the data.** The next largest class, DoS Hulk, was roughly 8.8%; port scanning about 4.5%; and everything else trailed off into fractions of a percent — some attack types, like Heartbleed, were thousandths of a percent of the total. This is not a quirk. It's the *defining* feature of intrusion detection: the interesting events are rare. Normal traffic drowns out attacks by an order of magnitude or more, and that imbalance dictates almost every methodological choice that follows.

We also did the per-day breakdown the dataset invites — attacks are not evenly distributed across the week, with Friday carrying the heaviest total attack volume of the five days — which is useful context for understanding attack trends and sources, though the modelling was done on the combined data.

## Why accuracy is a trap here, and what we used instead

Here's the trap the class imbalance sets. If 80.3% of your traffic is benign, a model that does nothing but predict "benign" for every single flow scores 80.3% accuracy. It has caught zero attacks — it is worse than useless, actively dangerous — and it still posts a number that looks like a passing grade. Accuracy, on imbalanced data, rewards the model for ignoring exactly the thing you built it to find.

So we didn't select on accuracy. The report's model-selection criterion is **macro-F1** — the F1 score computed per class and then averaged with equal weight across classes, so the rare Heartbleed class counts as much as the massive BENIGN one. The paper writes it out explicitly as a macro-averaged F1 built from macro-precision and macro-recall, with the β parameter set to 1 (the balanced case, weighting precision and recall equally). Because macro-averaging refuses to let the majority class carry the score, a model can only earn a high macro-F1 by actually getting the small attack classes right. We still tracked plain accuracy alongside it — mostly as a check on over- or under-fitting — but macro-F1 on the validation set was the basis for choosing between models.

That one decision is what makes the numbers in the next section meaningful rather than flattering.

## The approach: pick a strong teacher, then distill

The architecture in the report has a clear shape: **Dataset → data pre-processing and feature engineering → a supervised learning model → (distill knowledge) → an unsupervised anomaly-detection stage → performance evaluation.** Preprocessing handled the usual realities — missing values, dropping irrelevant features, standardizing the data so no single feature dominated by scale alone.

The idea binding the two model stages together is knowledge distillation. The plan was to train a strong *supervised* model on the labelled attacks — that's the model that can recognize known attack patterns accurately — and then transfer what it had learned into a model meant to generalize toward the *unseen*. A strong supervised classifier learns a rich decision boundary; distillation is the mechanism for handing that boundary to a second, simpler model that you can actually deploy.

But "the supervised model" isn't one thing — you have to pick it. So we trained four classical baselines and let macro-F1 choose the teacher:

| Model | Val macro-F1 | Val Acc | Test macro-F1 | Test Acc |
|---|---|---|---|---|
| Logistic Regression | 0.76 | 0.87 | 0.74 | 0.85 |
| **Decision Tree (Teacher)** | **0.98** | **0.99** | **0.97** | **0.98** |
| KNN | 0.98 | 0.99 | 0.96 | 0.98 |
| Naive Bayes | 0.67 | 0.80 | 0.67 | 0.79 |
| Student (Neural Network) | 0.78 | 0.80 | 0.75 | 0.79 |

The **Decision Tree won cleanly** — 0.97 test macro-F1 and 0.98 test accuracy — with KNN a close second at 0.96 macro-F1. Logistic Regression and Naive Bayes were well behind (0.74 and 0.67 macro-F1), which itself is informative: the attack/benign boundary in this feature space isn't something a linear model or a strong independence assumption captures well. The tree, which carves feature space into axis-aligned regions, fit it almost perfectly. That made it the teacher.

## Knowledge distillation from first principles

Since distillation is the load-bearing idea, it's worth building up from scratch — because understanding it correctly is exactly what explains our result.

When you train a classifier normally, you show it **hard labels**: this flow is attack (1), that one is benign (0). Those labels carry one bit of information each. But a *trained* model knows more than the label — its output probabilities encode how confident it is and, crucially, how it relates the classes. A model looking at a port scan might output 0.88 "port scan," 0.09 "DDoS," 0.03 "benign." Those runner-up probabilities are what Geoffrey Hinton called **dark knowledge**: the model is quietly telling you that a port scan looks a little like a DDoS and nothing like benign traffic. That relational structure is far richer than the single hard label "port scan."

Knowledge distillation is the trick of training a smaller **student** model to match the teacher's full probability distribution — its **soft targets** — instead of the hard labels. You do it by softening the teacher's outputs with a **temperature** parameter T: dividing the logits by T before the softmax spreads the probability mass out, so those small but meaningful runner-up probabilities become large enough to actually teach from. The student learns not just *what* the answer is but *the shape of the teacher's uncertainty around it* — a much denser training signal per example. In security terms, the hope is that a student trained on that softened boundary inherits a smoother, more general sense of "attack-like" rather than the teacher's crisp, brittle, memorized cutoffs — which is precisely the property you'd want when facing an attack the teacher never saw.

That's the theory. It's the theory that motivated the whole report. Here's what actually happened.

## The result I'm proudest of, because it disappointed us

We distilled the Decision Tree teacher into a neural-network student. The student landed at **0.78 validation macro-F1 / 0.80 accuracy, and 0.75 test macro-F1 / 0.79 test accuracy.**

Set that against the teacher's 0.97 test macro-F1. The student recovered a little over three-quarters of the way there, and lost roughly **22 macro-F1 points** in the transfer. The knowledge did not distill cleanly. As the report puts it plainly, the student "could not enrich the black-box knowledge from the decision tree that much as we expected."

I want to be clear that we published that number rather than bury it, because the *reason* it happened is the real finding — and it traces straight back to the first-principles view of distillation above.

**Distillation runs on soft targets, and a decision tree barely has any.** The dark knowledge that makes distillation work is a calibrated probability distribution — the smooth 0.88 / 0.09 / 0.03 that encodes how classes relate. A neural-network teacher produces exactly that. A decision tree does not. A tree's "probability" for a leaf is just the class frequency of the training samples that fell into that leaf — often a hard 1.0 / 0.0, or a coarse fraction. There's little relational structure and no temperature-tunable smoothness to soften. When your soft targets collapse toward hard labels, distillation quietly degrades into ordinary supervised training on a weaker signal — and you're asking a neural network to reproduce a function built from thousands of hard, axis-aligned splits, a shape it isn't naturally suited to represent. The decision boundaries a tree encodes as sharp splits simply don't survive the trip through a softmax.

That's the boundary of the technique, learned by hitting it: **distillation transfers a teacher's knowledge only as well as the teacher can express that knowledge in soft probabilities.** A tree wins the accuracy contest and then makes a poor teacher for exactly the same reason — its hard, discrete structure. The lesson generalizes cleanly: for distillation, pick a teacher whose knowledge is *soft* by nature, even if a harder-edged model scores a hair higher.

## Honest limits

Beyond the distillation result, a few things I'd flag before anyone treats this as deployable:

- **The abstract oversells.** It describes "a zero false negative rate, ensuring that no listed attacks go undetected." That's a claim about the strong *supervised* detector on this dataset, and it should be read against the 0.75-macro-F1 *student* that the same report measured. The headline detector and the deployable one are not the same model, and the gap between them is the story.
- **A benchmark is not a network.** CICIDS2017 is realistic for a captured dataset, but it's five days, one topology, a fixed menu of attacks. A model that separates benign from attack here has not been shown to hold up against traffic drift, a different network's baseline of "normal," or an attacker actively shaping traffic to look benign. Generalization to genuinely novel attacks is the whole premise — and it's asserted more than it's proven, because you can't measure detection of an attack that isn't in your labels.
- **False positives have a real cost in security.** An anomaly detector that flags too much unusual-but-benign traffic trains its operators to ignore it — alert fatigue is how good detectors get switched off. Macro-F1 keeps recall honest, but the precision half of that trade-off is where a deployed system lives or dies, and it deserves more weight than a single averaged number gives it.
- **The unsupervised anomaly-detection stage stayed aspirational.** The architecture diagram promises distillation *into* an unsupervised detector for catching the never-before-seen; what we actually measured end-to-end was a supervised-to-neural-student distillation on labelled classes. The full open-world claim is the direction, not the demonstrated result.

## What I took from it

This report closed a loop for me. I'd used knowledge distillation before, in a Bangla part-of-speech tagging project, and I'd walked away with a working student but never a full accounting of *where the technique breaks*. Here I got that accounting — same trick, different domain, and this time a complete measurement of the student against its teacher. The number that disappointed us taught me more than a clean success would have: it told me precisely what kind of teacher distillation needs, and why the best classifier is not automatically the best teacher.

That's the version of research I trust — the one that publishes the gap.

For the paper, the model table, and the full write-up, see [the research entry](/research/network-anomaly-detection).
