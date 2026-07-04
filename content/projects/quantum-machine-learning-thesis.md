---
title: "Machine Learning in the Realm of Quantum (Undergraduate Thesis)"
date: 2022-09
tags: [quantum-ml, pennylane, ibmq, cvqnn, quanvolutional]
featured: true
category: research
links:
  github: https://github.com/abuammarsami/CSE499.06-QML-
  live: null
status: active
---

# Machine Learning in the Realm of Quantum

**Summary:** State of the art, challenges, future vision, and applications of quantum
machine learning — with hands-on classification experiments across several encoding
methods.

**Problem:** Classical ML hits scaling walls that quantum computing may sidestep — but
which QML models actually work today, how do you get classical data *into* a quantum
circuit, and where do hybrid models genuinely help? The literature was fragmented.

**Approach:** Surveyed and reproduced recent QML models, then ran comparative
classification experiments on MNIST: Continuous Variable Quantum Neural Networks (CVQNN),
quanvolutional networks (quantum convolution filters), and hybrid classical-quantum
models — evaluating multiple data-encoding methods (angle, amplitude) on PennyLane
simulators and real IBMQ hardware, with classical CNN baselines.

**Impact:** Complete comparative analysis of quantum vs classical approaches with trained
model weights and training visualizations; the foundation for continuing MS research in
QML.

**Tech stack:** Python, PyTorch, PennyLane, IBMQ, TensorFlow/Keras, Jupyter

**Links:** [GitHub](https://github.com/abuammarsami/CSE499.06-QML-)

**Media:** _TODO: circuit diagrams + loss curves from the repo notebooks_
