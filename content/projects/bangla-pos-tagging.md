---
title: Bangla POS Tagging with Knowledge Distillation
date: 2022-08
tags: [nlp, bangla, bert, knowledge-distillation, pytorch]
featured: true
category: research
links:
  github: null
  live: null
status: active
---

# Bangla Parts-of-Speech Tagging with Knowledge Distillation

**Summary:** Directed research (CSE498, North South University, supervised by
Dr. Nabeel Mohammed): fighting severe class imbalance in Bangla POS tagging by
distilling a decision tree's leaf-node "dark knowledge" into a neural student —
the reverse of the usual distillation direction.

**Problem:** Bangla is low-resource: the main benchmark (Microsoft IL-POST, 102,933
hand-annotated tags) is heavily imbalanced across its 30 tag classes, so plain neural
taggers overfit the majority tags and ignore the rare ones.

**Approach:** Extracted contextual embeddings from three Bangla BERT models and probed
all 12 layers with a self-built polysemy dataset to pick the most semantic layer per
model. Observed that a decision-tree tagger degrades less on rare tags than a neural
network, then treated the class distributions in the tree's terminal nodes as soft
targets — distilling tree → network. PyTorch, scikit-learn, Hugging Face.

**Impact:** Best student reached **0.69 macro-F1 / 0.79 accuracy**, with two transferable
findings: tree and network performance move in *opposite* directions across BERT depth,
and the last BERT layer is not always the most semantic. The distillation idea carried
into later work on network-intrusion detection. Distilled write-up at
[/research/bangla-pos-tagging](/research/bangla-pos-tagging).

**Tech stack:** Python, PyTorch, Scikit-learn, Hugging Face, BERT

**Links:** [thesis PDF](/papers/bangla-pos-tagging.pdf)

**Media:**
