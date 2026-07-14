---
title: "Exploring New Attack Patterns in Computer Networks through Anomaly Detection and Knowledge Distillation"
authors: [Md. Abu Ammar, Sadia Afrin Tamanna]
venue: "Graduate research report, North South University"
year: 2023
kind: report
supervisor: null
pdf: false
tags: [network-security, anomaly-detection, knowledge-distillation, cicids2017]
related:
  project: null
  lesson: null
  writeup: network-anomaly-detection
featured: false
status: active
---

# Exploring New Attack Patterns through Anomaly Detection and Knowledge Distillation

**Abstract:** Signature-based intrusion detection can't see attacks it has no
signature for; its coverage of unseen attacks is zero by construction. This
work reframes intrusion detection as anomaly detection — learn the shape of
normal traffic so well that anything abnormal announces itself — and uses
knowledge distillation to compress that capability toward something
deployable. On the CICIDS2017 benchmark we train four classical supervised
models, select the strongest (a decision tree) as a teacher, and distill it
into a neural student. The teacher performs near-ceiling; the student loses
roughly 22 macro-F1 points in the transfer. We report the failure and its
mechanism as the main finding: a decision tree makes an excellent classifier
and a poor teacher, for the same structural reason.

**In plain words:** A traditional intrusion detector works like a bouncer with
a photo book — fast and precise against attacks someone has already seen,
named, and written a signature for, and blind to a face that's never been
photographed. The reframe: stop enumerating bad things and instead learn what
*normal* looks like, so a brand-new attack gets flagged for being unusual, not
for matching a list. Then let the model that's very good at recognizing
*known* attacks teach a second, lighter model a softer, more general sense of
"attack-like." The data is CICIDS2017 — five days (Monday–Friday) of real
captured network flows covering DDoS, port scans, web attacks, brute-forcing,
botnets, Heartbleed, and infiltration.

**Method:** Each CICIDS2017 row is a network flow — source/destination IPs and
ports, protocol, packet size, flow statistics — preprocessed (missing values,
categorical encoding, standardization) after exploratory analysis of attack
types, per-day volumes, and sources. The defining property of the data is
imbalance: benign traffic is 80.3% of all flows, DoS Hulk about 8.2%, port
scanning 5.6%, DDoS 4.5%, and everything else fractions of a percent down to
a few ten-thousandths. That rules out accuracy as a selection metric — a model
that predicts "benign" for everything scores 80.3% while catching zero
attacks — so the four baselines (logistic regression, decision tree, KNN,
naive Bayes) were selected on **macro-F1**, which weights the rare Heartbleed
class equally with the massive benign one. The winning decision tree then
served as teacher for a neural-network student trained via knowledge
distillation.

**Results:** The teacher was excellent: **0.97 test macro-F1 / 0.98 accuracy**
(KNN close behind at 0.96; logistic regression at 0.74 and naive Bayes at
0.67 confirm the boundary isn't linear). The distilled student managed only
**0.75 / 0.79** — a negative result we report as the finding it is.
Distillation runs on soft targets, the teacher's calibrated runner-up
probabilities ("this port scan looks 9% like a DDoS and nothing like benign"),
and a decision tree barely has any: its leaf "probability" is just the class
frequency of training samples that landed there, often a hard 1.0/0.0, with
no logits and no temperature-tunable smoothness. Soften a one-hot spike and
you get a one-hot spike — so the distillation loss quietly collapses into
ordinary supervised training on a weaker signal, and the tree's crisp
axis-aligned splits don't survive the trip through a softmax. Two honest
caveats: the report doesn't publish the distillation temperature, loss
weights, or student architecture, and the planned unsupervised
anomaly-detection stage — the actual open-world detector — stayed
aspirational; what we measured end-to-end is the supervised
tree-to-student transfer.

**Looking back:** Publishing the number that disappointed us matters more to me
than the one that didn't. This report closed the loop on the distillation idea
from my Bangla POS work: same trick, different domain, and this time a full
measurement of the student — which is exactly how I learned where the
technique's boundary is. The best classifier is not automatically the best
teacher; distillation transfers knowledge only as well as the teacher can
express it in soft probabilities, so the obvious next experiment is a
calibrated probabilistic teacher rather than a hyperparameter sweep. The full
story — the class-imbalance analysis, the distillation math, and the failure
modes macro-F1 hides — lives in [the writeup](/deep-dives/network-anomaly-detection).
The manuscript needs an editing pass before public posting; it's available on
request.
