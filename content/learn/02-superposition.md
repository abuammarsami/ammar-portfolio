---
title: Superposition
order: 2
status: active
---

# Superposition

## Hook
"Both at once" has a precise meaning: the arrow sits on the equator.

## Explain
Press the H (Hadamard) gate on a fresh |0⟩ qubit and the arrow swings from the
north pole to the equator. Now P(0) = P(1) = ½ — a perfect coin toss. That's
superposition: not magic, just a definite arrow pointing sideways.

But here's the part most explanations skip. Once on the equator, the arrow can
still spin around the axis — that angle is called phase. Spin it anywhere you
like: the probabilities refuse to move. Phase is invisible to a single
measurement — yet it's the fuel of every quantum algorithm, because gates can
convert hidden phase differences back into visible probability differences.

## Try it
Press H and watch the swing. Then drag the phase slider: the arrow orbits the
equator, the probability bars stay frozen at 50/50. You are changing the state
without changing the odds.

## Takeaway
Superposition is an equator arrow; phase is its hidden direction. Quantum
algorithms work by choreographing phases you can't see until the final step.

## Deeper
Mathematically the equator state is (|0⟩ + e^{iφ}|1⟩)/√2. The e^{iφ} factor
cancels when you square amplitudes for probabilities — that's why the bars
freeze — but interference between paths depends on it completely.
