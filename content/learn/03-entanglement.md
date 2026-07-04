---
title: Entanglement
order: 3
status: active
---

# Entanglement

## Hook
Two qubits can hold information that neither one carries alone. Watch each
sphere forget — while the pair remembers.

## Explain
Take two qubits. Put the first in superposition (H), then apply CNOT — a gate
that flips the second qubit only when the first is 1. The result is the Bell
state: (|00⟩ + |11⟩)/√2. Measured together, they only ever agree — both 0 or
both 1, never mixed.

The eerie part shows up on the spheres. Each qubit's own arrow shrinks to
nothing: ask either qubit alone "what state are you in?" and the honest answer
is "no state at all — 50/50, no direction." All the information has moved into
the correlation between them. The ⟨Z⊗Z⟩ meter reads +1: perfect agreement.

## Try it
Press H, then CNOT, and watch both arrows collapse toward the center while the
correlation meter climbs to +1 and the joint histogram empties out 01 and 10.
Reset and try CNOT without H — nothing interesting happens. The order matters.

## Takeaway
Entanglement moves information from individual qubits into their relationship.
That's the resource behind quantum teleportation, error correction — and the
reason quantum computers can't be simulated one qubit at a time.

## Deeper
The arrow's length is the qubit's purity. A lone qubit in the Bell pair is in a
"maximally mixed" state — its reduced density matrix is ½·I, which has zero
Bloch vector. This site's engine computes it by partial trace, exactly as a
textbook would.
