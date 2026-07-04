---
status: active
---

# Explainers

## hero-classifier
This is a real 2-qubit **variational quantum classifier**, training live in your
browser. The RY boxes are rotation gates whose angles θ are learned parameters;
the vertical line is a CNOT entangling gate; the dials update by gradient
descent using the parameter-shift rule. Drag the two data points and it retrains
on the new problem. Every number comes from a 166-line, unit-tested quantum
simulator — [learn how it works, from zero](/learn).

## bloch-sphere
The **Bloch sphere** maps every possible qubit state to a point on a sphere:
north pole |0⟩, south pole |1⟩, equator = equal superposition. Arrow length
shows purity — entangled qubits have short arrows. [Full lesson](/learn).

## parameter-shift
The **parameter-shift rule** gives exact gradients of quantum circuits: evaluate
at θ+π/2 and θ−π/2, halve the difference. No finite-difference error — it's an
identity of rotation gates. [See it in action](/learn).

## quanvolution
A **quanvolution** slides a small quantum circuit across an image the way a CNN
slides a filter: each 2×2 patch's pixels become rotation angles, a CNOT
entangles the qubits, and measured ⟨Z⟩ values form quantum feature maps. From my
undergraduate thesis. [Interactive lesson](/learn).

## research-qml
**Quantum machine learning** uses parameterized quantum circuits as ML models —
trained by gradient descent like neural networks, but computing with
superposition and entanglement. [Learn it from zero](/learn).
