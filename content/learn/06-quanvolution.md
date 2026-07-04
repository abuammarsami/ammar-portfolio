---
title: "Quanvolution: QML on images"
order: 6
status: active
---

# Quanvolution: QML on images

## Hook
A convolution slides a filter across an image. A quanvolution slides a quantum
circuit. This was my thesis.

## Explain
In a classical CNN, a small filter sweeps the image, computing one number per
patch — stacked filters produce feature maps that reveal edges, textures,
shapes. A quanvolutional layer keeps the sweep but replaces the filter's
arithmetic with a 2-qubit circuit: the four pixels of each 2×2 patch become
four RY rotation angles, a CNOT entangles the qubits, and the measured ⟨Z⟩ is
the output pixel. Four different rotation offsets give four channels — four
quantum feature maps from one drawing.

Why bother? The quantum filter computes a nonlinear, entanglement-mixed
function of the patch that classical filters don't naturally express — and
exploring where that helps is an open research question.

## Try it
Draw on the grid. Watch a patch lift into the circuit, transform, and land in
the four feature maps — each channel seeing your sketch differently. Every
value is a real ⟨Z⟩ from the same simulator you've used all page.

## Takeaway
Quantum layers can drop into classical ML architectures. Encoding data into
rotations, entangling, and measuring — the three moves you learned in lessons
1–4 — compose into a working image-processing layer.

## Deeper
My undergraduate thesis — "Machine learning in the realm of quantum" — compared
quanvolutional networks and CVQNNs against classical CNN baselines on MNIST,
across angle and amplitude encodings, on PennyLane simulators and IBMQ
hardware. The full case study is on this site.
