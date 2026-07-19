---
title: The qubit
order: 1
status: active
---

# The qubit

## Hook
A bit is a light switch: on or off. A qubit is a point on a sphere — and that
difference is the whole story.

## Explain
A classical bit is either 0 or 1. A qubit's state is written α|0⟩ + β|1⟩ — a
mixture of both possibilities at once, where α and β are numbers called
amplitudes. Squaring an amplitude gives the probability of finding the qubit in
that state when you look: P(0) = |α|², P(1) = |β|².

Every possible qubit state maps to a point on a sphere — the Bloch sphere.
North pole is |0⟩, south pole is |1⟩, and everywhere in between is a genuine
quantum state. Two dials move the arrow: θ tilts it between the poles (changing
the probabilities), φ spins it around the axis (changing something subtler —
you'll meet it in the next lesson).

## Try it
On a desktop, **grab the arrow's tip and drag it** to point the qubit anywhere on
the sphere — or drag the empty space to orbit and look around. Either way (or with
the θ and φ sliders) the amplitudes α and β update live and the probability bars
follow |α|² and |β|². Notice: tilting θ shifts probability between 0 and 1;
spinning φ doesn't move the bars at all.

## Takeaway
A qubit isn't "0 and 1 at the same time" — it's an arrow on a sphere. Where the
arrow points decides the odds of what you'll see when you measure.

## Deeper
The two dials are exactly the two rotation gates in this site's simulator: RY(θ)
tilts, RZ(φ) spins. The state is stored as two complex amplitudes, and the arrow
you're steering is computed from them — about 200 lines of dependency-free code,
the same engine that trains the classifier on the homepage.
