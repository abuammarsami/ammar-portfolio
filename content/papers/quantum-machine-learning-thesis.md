---
title: "Machine Learning In The Realm Of Quantum: The State-Of-The-Art, Challenges, Future Vision and Applications Of It"
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
  writeup: quantum-machine-learning
featured: true
status: active
---

# Machine Learning In The Realm Of Quantum

**Abstract:** A comprehensive review of the state of the art in quantum machine
learning, paired with hands-on classification experiments: two first-generation
hybrid quantum-classical models — a quanvolutional neural network on a gate-based
simulator and a continuous-variable quantum neural network on a photonic
simulator — trained on MNIST and compared head-to-head against classical
baselines of comparable size on accuracy and convergence. Both hybrids trail
their baselines; the margins, and where each model loses, are the contribution.

**In plain words:** Can today's quantum computers learn to read handwritten
digits? Not "will quantum one day change ML" — that's a keynote question. This
one is small and testable: take MNIST, run part of the classifier on a quantum
circuit, measure the gap against an ordinary network. My thesis partner and I
built two deliberately different quantum learners to find out. The first
slides a tiny 4-qubit circuit across each image the way a convolutional filter
would — a *quanvolution*. The second encodes images into beams of light
(squeezers, beamsplitters, Kerr gates) following Xanadu's continuous-variable
recipe, the Kerr gate playing the role of the activation function, and trains
the way a normal neural network does: gradients flow through the quantum circuit
via the parameter-shift rule — evaluate the same circuit at θ±π/2, subtract, and
you have an exact analytic derivative — the same mathematics running live in
this site's [hero](/) and in [lesson 6 of /learn](/learn#06-quanvolution).

**Method:** PennyLane with the Keras plugin, 10-class MNIST, simulators only —
no real qubits, so no decoherence: the easy setting. Model 1 (quanvolutional,
after Henderson et al. 2019): 2×2 patches angle-encoded via RY rotations into
4 qubits — the pixel *is* the rotation angle — a random variational layer, and
Pauli-Z expectations giving 4 feature channels, turning each 28×28 image into a
14×14×4 stack for a classical dense head; 6,000 training and 1,000 test images
on `default.qubit`. One point I want stated plainly: Model 1's quantum circuit
is a *fixed, random* feature extractor — drawn once, frozen, never trained;
only the classical head learns. Model 2 (CV-QNN, after Killoran et al.) is the
one that actually trains quantum weights: dense classical layers compress each
image to 14 parameters driving a 2-qumode photonic circuit — squeezing,
interferometers, displacement, Kerr nonlinearity — with 4 quantum layers (56
quantum parameters, 111,334 end-to-end), trained on a 700-sample subset with
cutoff dimension 4, because simulating photonic circuits in Fock space is
expensive enough that a bigger run wasn't practical.

**Results:** The classical baselines won — and the margins are the finding. The
quanvolutional model reached **92%** test accuracy against a **96%** classical
CNN, and converged to its optimum *loss* faster than the classical model, even
though the classical model hit peak accuracy first — a quantum-preprocessed
feature stack was at least not obviously worse to optimize. The CV-QNN reached
**72%** against an **88%** classical baseline, its validation curve sitting
below the classical one for the whole run, noisier and slower to settle:
training 56 parameters through a truncated photonic simulation was simply
harder than training the equivalent classical weights. No quantum advantage is
claimed, and none was observed — but the gate-based approach got within four
points: the honest state of the NISQ era, measured directly, and closer than
either the hype or the cynicism predicts.

**Looking back:** The thesis taught me that the interesting question isn't
"is quantum faster?" but "where does the encoding bottleneck bite?" A neural
network eats a vector; a quantum circuit eats a quantum state, and getting
classical pixels *into* that state — the angle rotations, the 14-number
compression, the choice of squeezers and Kerr gates — dominated every design
decision in both models. If I picked the thread back up I'd start there:
trainable data encodings instead of Model 1's frozen random feature map. The
full story — the two distinct failure modes, derivations, and run-notes — lives
in [the writeup](/deep-dives/quantum-machine-learning). That lesson also shaped
this site: the interactive curriculum at [/learn](/learn) exists because the
encoding intuition took me months and a 68-page thesis to build, and a visitor
can now get it in six scroll-stops.

**BibTeX:**

```bibtex
@thesis{ammar2022qml,
  author      = {Ammar, Md. Abu and Tamanna, Sadia Afrin},
  title       = {Machine Learning In The Realm Of Quantum: The
                 State-Of-The-Art, Challenges, Future Vision and
                 Applications Of It},
  type        = {Bachelor's thesis},
  institution = {North South University},
  address     = {Dhaka, Bangladesh},
  year        = {2022},
  note        = {Supervised by Dr. Mahdy Rahman Chowdhury}
}
```
