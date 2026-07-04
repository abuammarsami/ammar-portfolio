---
title: "Machine Learning in the Realm of Quantum (B.Sc. Thesis)"
date: 2022-08
tags: [quantum-ml, pennylane, quanvolution, cvqnn, mnist]
featured: true
category: research
links:
  github: https://github.com/abuammarsami/CSE499.06-QML-
  live: null
status: active
---

# Machine Learning in the Realm of Quantum

**Summary:** Undergraduate thesis (CSE499, North South University, supervised by
Dr. Mahdy Rahman Chowdhury): a state-of-the-art review of quantum machine learning plus
head-to-head MNIST experiments — a 4-qubit quanvolutional network and a continuous-variable
photonic QNN against classical baselines.

**Problem:** Classical ML hits scaling walls that quantum computing may sidestep — but
which QML models actually work today, how do you get classical data *into* a quantum
circuit, and where do hybrid models genuinely help? The literature was fragmented and
the honest baselines were missing.

**Approach:** Built and trained two first-generation hybrid models in PennyLane + Keras
on MNIST: a quanvolutional network (2×2 patches angle-encoded into 4 qubits via RY
rotations, random variational layer, Pauli-Z readout as feature channels) and a
continuous-variable QNN on a photonic simulator (squeezers, interferometers,
displacement, Kerr gates; 4 quantum layers, 56 quantum parameters) — each against an
equivalized classical network, comparing accuracy and convergence speed.

**Impact:** Quanvolution reached **92%** test accuracy vs **96%** classical (and converged
to optimum loss faster); the CV-QNN reached **72%** vs **88%**. An honest, measured
picture of the NISQ era — and the foundation for this site: the same parameter-shift
mathematics now trains live in the [hero](/) and teaches visitors in [/learn](/learn).
The full thesis is distilled at [/research/quantum-machine-learning-thesis](/research/quantum-machine-learning-thesis).

**Tech stack:** Python, PennyLane, TensorFlow/Keras, Strawberry Fields, Jupyter

**Links:** [GitHub](https://github.com/abuammarsami/CSE499.06-QML-) · [thesis PDF](/papers/quantum-machine-learning-thesis.pdf)

**Media:** _TODO: circuit diagrams + loss curves from the repo notebooks_
