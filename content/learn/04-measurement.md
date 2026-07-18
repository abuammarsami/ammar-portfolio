---
title: Measurement
order: 4
status: active
---

# Measurement

## Hook
Looking at a qubit is not free. Measurement is a weighted dice roll — and it
destroys the state you rolled.

## Explain
Until you measure, the qubit is its arrow: definite, continuous, spinnable.
The moment you measure, two things happen at once. First, you get a plain
classical answer — 0 or 1 — drawn randomly with probabilities |α|² and |β|².
Second, the arrow snaps to the pole matching your answer. The superposition is
gone; measuring again just repeats the same answer.

That's why quantum algorithms are shaped the way they are: compute in
superposition, interfere phases, and only measure at the very end — one shot at
extracting an answer from an arrow you spent the whole circuit preparing.

## Try it
Prepare any state with the slider, then press measure — repeatedly. Each shot
swings the arrow to a pole and adds a tick to the tally. Watch the histogram of
your shots converge toward the theoretical bars. Same state, same odds,
different rolls.

## Takeaway
Measurement converts amplitudes to probabilities and erases the quantum state.
Everything a quantum computer does must be choreographed to survive that final,
destructive question.

## Deeper
The snap is projection: the state is projected onto the measured outcome and
renormalized to length 1. On the Bell pair from Lesson 3, measuring one qubit
would instantly fix the other — the defining move of entanglement.
