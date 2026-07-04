---
title: "Machine Learning in the Realm of Quantum: The State of the Art, Challenges, Future Vision and Applications"
authors: [Md. Abu Ammar, Sadia Afrin Tamanna]
venue: "B.Sc. thesis (CSE499), North South University"
year: 2022
kind: thesis
supervisor: "Dr. Mahdy Rahman Chowdhury"
pdf: true
tags: [quantum-ml, quanvolution, cvqnn, pennylane, mnist]
related:
  project: quantum-machine-learning-thesis
  lesson: 06-quanvolution
featured: true
status: active
---

# Machine Learning in the Realm of Quantum

**Abstract:** A comprehensive review of the state of the art in quantum machine
learning, paired with hands-on classification experiments: two first-generation
hybrid quantum-classical models — a quanvolutional neural network on a gate-based
simulator and a continuous-variable quantum neural network on a photonic
simulator — trained on MNIST and compared head-to-head against classical
baselines on accuracy and convergence.

**In plain words:** Can today's quantum computers learn to read handwritten
digits? This thesis builds two very different quantum learners to find out. The
first slides a tiny 4-qubit circuit across each image the way a convolutional
filter would — a *quanvolution*. The second encodes images into beams of light
(squeezers, beamsplitters, Kerr gates) following Xanadu's continuous-variable
recipe. Both are trained the same way a normal neural network is, with gradients
flowing through the quantum circuit via the parameter-shift rule — the same
mathematics running live in this site's [hero](/) and in
[lesson 6 of /learn](/learn#06-quanvolution).

**Method:** PennyLane with the Keras plugin, 10-class MNIST. Model 1
(quanvolutional, after Henderson et al. 2019): 2×2 patches angle-encoded via RY
rotations into 4 qubits, a random variational layer, Pauli-Z expectations giving
4 feature channels, then a softmax head. Model 2 (CV-QNN, after Killoran et
al.): dense classical layers compress each image to 14 parameters driving a
2-qumode photonic circuit — squeezing, interferometers, displacement, Kerr
nonlinearity — with 4 quantum layers (56 quantum parameters), trained on a
700-sample subset with cutoff dimension 4.

**Results:** The classical baselines won — and the margins are the finding. The
quanvolutional model reached **92%** test accuracy against a **96%** classical
CNN, and converged to its optimum *loss* faster than the classical model. The
CV-QNN reached **72%** against an **88%** classical baseline. First-generation
QML models trained on classical data did not beat optimized classical networks,
but the gate-based approach came close — the honest state of the NISQ era,
measured directly.

**Looking back:** The thesis taught me that the interesting question isn't
"is quantum faster?" but "where does the encoding bottleneck bite?" Getting
classical pixels *into* a quantum state dominated every design decision. That
lesson shaped this site: the interactive curriculum at [/learn](/learn) exists
because the encoding intuition took me months and a 68-page thesis to build,
and a visitor can now get it in six scroll-stops.

**BibTeX:**

```bibtex
@thesis{ammar2022qml,
  author      = {Ammar, Md. Abu and Tamanna, Sadia Afrin},
  title       = {Machine Learning in the Realm of Quantum: The State of the
                 Art, Challenges, Future Vision and Applications},
  type        = {Bachelor's thesis},
  institution = {North South University},
  address     = {Dhaka, Bangladesh},
  year        = {2022},
  note        = {Supervised by Dr. Mahdy Rahman Chowdhury}
}
```
