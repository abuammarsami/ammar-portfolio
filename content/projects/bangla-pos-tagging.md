---
title: Bangla POS Tagging with Knowledge Distillation
date: 2024-06
tags: [nlp, bert, knowledge-distillation, pytorch]
featured: true
category: research
links:
  github: null
  live: null
status: draft
---

# Bangla Parts-of-Speech Tagging with Knowledge Distillation

**Summary:** Supervised Bangla POS tagger that distills a decision-tree teacher into a
neural student to fight data imbalance.

**Problem:** Bangla is low-resource: POS-tagged corpora are small and heavily imbalanced
across tag classes, so plain neural taggers overfit the majority tags.

**Approach:** Trained a decision-tree teacher model whose knowledge was distilled into a
neural-network student, transferring the teacher's robustness on rare tags. Built on
PyTorch, Scikit-learn, and Hugging Face BERT representations.

**Impact:** Improved tagging accuracy and efficiency versus the direct neural baseline,
particularly on under-represented tag classes.

**Tech stack:** Python, PyTorch, Scikit-learn, Hugging Face, BERT

**Links:** _TODO: add repo/paper link_

**Media:**
