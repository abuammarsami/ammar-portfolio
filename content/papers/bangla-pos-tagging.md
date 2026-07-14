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
  writeup: bangla-pos-tagging
featured: true
status: active
---

# Bangla POS Tagging Using Supervised Learning and Knowledge Distillation

**Abstract:** Part-of-speech tagging for Bangla — a low-resource language whose
main benchmark, Microsoft IL-POST, is severely class-imbalanced — using
contextual embeddings from three Bangla BERT models. On macro-F1, which weights
all 30 classes equally, a neural network beats a decision tree overall but wins
by feasting on the majority classes; the tree scores lower yet spreads its
errors more evenly across the tagset. That asymmetry motivates an inverted
distillation: read the class counts in the tree's leaf nodes as a probability
distribution and distill that "dark knowledge" *from the tree into the neural
student* — a de-biasing signal rather than a compression trick.

**In plain words:** Bangla is the world's 7th most spoken language, yet its
best public POS dataset squeezes 100k+ tags into 32 classes where one tag —
Common Noun, about 31% of all tokens — is more than twice as frequent as the
runner-up and the long tail sits at fractions of a percent. A network trained
on it learns to be confidently, uselessly good: it aces the common tags and
quietly ignores the rare ones, and because the test set is skewed the same
way, accuracy hides the blindness. We noticed that a humble decision tree,
while weaker overall, degraded *less* on rare tags — so instead of the usual
big-teacher-small-student distillation, we flipped it: let the tree teach the
network what balanced judgment looks like, rather than oversampling the rare
classes, which invents data. Along the way we probed all 12 layers of three
Bangla BERT models with a self-built dataset of polysemous sentence pairs to
find which layer actually understands word context.

**Method:** Microsoft IL-POST Bengali (7,168 sentences, 102,933 hand-annotated
tags, 30 classes after merging the rare VA auxiliary tag into VAUX),
60:20:20 sentence-level splits with every class present in each partition.
768-dim contextual embeddings from BERT-Multilingual, Sagorsarker Bangla-BERT,
and Kowsher Bangla-BERT; layer choice ranked by cosine similarity of a target
word's embedding across 30 same-word/different-meaning sentence pairs — low
similarity means the layer separates senses, and it fell from roughly 0.90 in
the early layers toward 0.70 by layer 12. Teacher: scikit-learn decision tree.
Student: PyTorch dense network, 768 → 1024 → 30 with ReLU and heavy dropout
(p = 0.8) against majority-class overfitting; Adam, early stopping, and model
selection by validation macro-F1, since a checkpoint that maximizes accuracy
is precisely the one that leaned hardest into the majority class.
Distillation signal: the tree's normalized leaf-node class distributions as
soft targets in a standard Hinton temperature-softened KL + cross-entropy
loss.

**Results:** The best student reached **0.69 macro-F1 / 0.79 accuracy** on test
(Sagorsarker, layer 7); the best tree reached 0.46 / 0.60 — at layer 1 of the
same model. Two findings stand out. First, the tree's performance *falls*
monotonically with deeper BERT layers (down to 0.24 on Sagorsarker's layer 12,
0.18 on multilingual) while the network's *rises* (0.59 at layer 1 up to
0.69) — the same embedding geometry, consumed in opposite directions, so the
"best layer" is a property of the model that eats it, not of the data.
Second, layer probing showed the last layer is not always the most semantic:
Kowsher's best layer was 11, not 12. The honest gap: the submitted abstract
claims the distilled student gains 13% overall plus a literal unfilled "y%"
placeholder on the minor classes — the full distilled-student evaluation was
left incomplete when the semester ended, so this manuscript deliberately
claims the method, not a headline number.

**Looking back:** This project is where I learned that class imbalance is a
*knowledge representation* problem, not just a sampling problem — an idea I
reused a year later distilling network-intrusion detectors. It also taught me
to respect negative space in a results table: what we didn't get to measure
shaped the follow-up questions more than what we did. If I picked it up again
I'd sweep temperature and alpha rather than fixing them, and compare the
tree-teacher against a cost-sensitive loss to isolate what distillation itself
buys. The full story, including the layer-probe tables and the loss code,
lives in [the writeup](/deep-dives/bangla-pos-tagging).

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
