---
title: Training a quantum circuit
order: 5
status: active
---

# Training a quantum circuit

## Hook
Put dials on a quantum circuit and it becomes a machine-learning model. This is
quantum machine learning — and it's what runs on this site's homepage.

## Explain
A variational circuit is a circuit whose rotation angles are trainable
parameters — the quantum cousin of a neural network's weights. To classify a
data point: encode it as a rotation, pass it through the parameterized gates,
measure ⟨Z⟩, and read the sign as the predicted class.

Training needs gradients, and quantum circuits have a beautiful trick: the
parameter-shift rule. Evaluate the circuit twice — once with a dial turned
+π/2, once −π/2 — and half the difference is the exact gradient:
∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)] / 2. No approximation. Then it's ordinary
gradient descent, just like any ML model.

## Try it
This is the parameter-shift rule itself, live. Pick a dial (θ0–θ3) and slide it:
the curve is ⟨Z⟩ as that one angle sweeps. The two coloured dots are the circuit
evaluated at θ+π/2 and θ−π/2 — their half-difference is the exact gradient,
drawn as the tangent touching the curve. Press **descend** to take one downhill
step, or **run** to let the dial roll into the trough where the gradient vanishes.

## Takeaway
Quantum ML = circuits as models, parameter-shift for gradients, descent for
training. The physics does the forward pass; calculus stays classical.

## Deeper
This widget runs on the same simulator as the homepage hero — the same
parameter-shift gradients, unit-tested against finite differences. My thesis
benchmarked these models (CVQNN, quanvolutional networks) on MNIST with
PennyLane and IBM's real quantum hardware.
