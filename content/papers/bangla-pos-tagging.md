---
title: "Bangla POS Tagging Using Supervised Learning and Knowledge Distillation"
authors: [Md. Abu Ammar, Sadia Afrin Tamanna]
venue: "Directed research (CSE498), North South University"
year: 2022
kind: thesis
supervisor: "Dr. Nabeel Mohammed"
pdf: true
tags: [nlp, bangla, bert, knowledge-distillation, class-imbalance]
related:
  project: bangla-pos-tagging
  lesson: null
featured: true
status: active
---

# Bangla POS Tagging Using Supervised Learning and Knowledge Distillation

**Abstract:** Part-of-speech tagging for Bangla — a low-resource language whose
main benchmark, Microsoft IL-POST, is severely class-imbalanced — using
contextual embeddings from three Bangla BERT models. A decision tree proves
less biased by the imbalance than a neural network, motivating an unusual
distillation direction: treat the class counts in the tree's leaf nodes as a
probability distribution and distill that "dark knowledge" *from the tree into
the neural student*.

**In plain words:** Bangla is the world's 7th most spoken language, yet its
best public POS dataset squeezes 100k+ tags into 32 classes where a handful of
common tags drown out the rest. Neural networks trained on it learn the
majority and ignore the minority. We noticed that a humble decision tree,
while weaker overall, degraded *less* on rare tags — so instead of the usual
big-teacher-small-student distillation, we flipped it: let the tree teach the
network what balanced judgment looks like. Along the way we probed all 12
layers of three Bangla BERT models with a self-built dataset of polysemous
sentence pairs to find which layer actually understands word context.

**Method:** Microsoft IL-POST Bengali (7,168 sentences, 102,933 hand-annotated
tags, 30 classes after merging), 60:20:20 sentence-level splits. 768-dim
contextual embeddings from BERT-Multilingual, Sagorsarker Bangla-BERT, and
Kowsher Bangla-BERT; layer choice ranked by cosine similarity of a target
word's embedding across 30 same-word/different-meaning sentence pairs.
Teacher: scikit-learn decision tree. Student: PyTorch dense network (Adam,
early stopping, model selection by validation macro-F1). Distillation signal:
leaf-node class distributions as soft targets.

**Results:** The best student reached **0.69 macro-F1 / 0.79 accuracy** on test
(Sagorsarker, layer 7); the best tree reached 0.46 / 0.60. Two findings stand
out: the tree's performance *falls* with deeper BERT layers while the
network's *rises* — evidence they consume the embedding geometry differently —
and layer probing showed the last layer is not always the most semantic. The
full distilled-student evaluation was left incomplete when the semester ended,
so this manuscript deliberately claims the method, not a headline number.

**Looking back:** This project is where I learned that class imbalance is a
*knowledge representation* problem, not just a sampling problem — an idea I
reused a year later distilling network-intrusion detectors. It also taught me
to respect negative space in a results table: what we didn't get to measure
shaped the follow-up questions more than what we did.

**BibTeX:**

```bibtex
@thesis{ammar2022banglapos,
  author      = {Ammar, Md. Abu and Tamanna, Sadia Afrin},
  title       = {Bangla POS Tagging Using Supervised Learning and Knowledge
                 Distillation},
  type        = {Bachelor's directed research (CSE498)},
  institution = {North South University},
  address     = {Dhaka, Bangladesh},
  year        = {2022},
  note        = {Supervised by Dr. Nabeel Mohammed}
}
```
