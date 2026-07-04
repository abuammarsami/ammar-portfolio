---
title: Age, Gender & Race Estimation with a Multi-Output CNN
date: 2025-09
tags: [computer-vision, cnn, tensorflow, multi-task]
featured: false
category: research
links:
  github: https://github.com/abuammarsami/Age-Gender-and-Race-Estimation-with-Multi-Output-CNN-Architecture
  live: null
status: draft
---

# Age, Gender & Race Estimation with a Multi-Output CNN

**Summary:** One shared feature extractor, three specialized heads — simultaneous
demographic estimation from facial images on UTKFace.

**Problem:** Age, gender, and race manifest as subtle, entangled variations in facial
features — harder than standard object classification, and training three separate
models wastes shared structure.

**Approach:** Multi-output CNN on UTKFace (20k+ images): shared convolutional trunk with
separable convolutions, batch norm, and dropout; three output branches (age regression,
gender and race classification); data augmentation throughout. Model kept to ~15 MB.

**Impact:** Age MAE ≈ **6.8 years** (R² = 0.814), gender accuracy ≈ **94.2%**, race
accuracy ≈ **87.1%** — production-quality multi-task results in a deployable model size.

**Tech stack:** Python, TensorFlow/Keras, CNNs, UTKFace

**Links:** [GitHub](https://github.com/abuammarsami/Age-Gender-and-Race-Estimation-with-Multi-Output-CNN-Architecture)

**Media:** _TODO: architecture figure (trunk + 3 heads) — becomes the neural-figure on this page_
