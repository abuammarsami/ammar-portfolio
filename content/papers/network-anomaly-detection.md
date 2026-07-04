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
featured: false
status: active
---

# Exploring New Attack Patterns through Anomaly Detection and Knowledge Distillation

**Abstract:** Signature-based intrusion detection can't see attacks it has no
signature for. This work trains four classical supervised models on the
CICIDS2017 network-traffic benchmark, selects the strongest (a decision tree)
as a teacher, and distills its knowledge into a neural student intended to
flag anomalous — potentially novel — traffic patterns without predefined
signatures.

**In plain words:** An intrusion detection system that memorizes yesterday's
attacks is blind to tomorrow's. The idea here: let a model that's very good at
recognizing *known* attacks teach a second model a softer, more general sense
of "what attack-like traffic looks like," so the student can raise its hand at
traffic that's merely *unusual*. The dataset is CICIDS2017 — days of real
captured network flows covering DDoS, port scans, web attacks, and
infiltration.

**Method:** CICIDS2017 flow features (IPs, ports, protocol, packet and flow
statistics) preprocessed and standardized; exploratory analysis of attack
types, per-day trends, and sources. Four supervised baselines — logistic
regression, decision tree, KNN, naive Bayes — evaluated on macro-F1 (chosen
for class imbalance). The decision-tree teacher's knowledge distilled into a
neural-network student.

**Results:** The teacher was excellent: **0.97 test macro-F1 / 0.98 accuracy**
(KNN close behind at 0.96). The distilled student managed only **0.75 / 0.79**
— a negative result we report as the finding it is. Tree-structured knowledge
did not transfer into the student the way soft-label distillation from a
neural teacher does; decision boundaries a tree encodes as hard axis-aligned
splits don't survive the trip through a softmax.

**Looking back:** Publishing the number that disappointed us matters more to me
than the one that didn't. This report closed the loop on the distillation idea
from my Bangla POS work: same trick, different domain, and this time a full
measurement of the student — which is exactly how I learned where the
technique's boundary is. The manuscript needs an editing pass before public
posting; it's available on request.
