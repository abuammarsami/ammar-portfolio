# Playground

This is a real two-qubit quantum simulator — the same dependency-free
statevector engine that trains the classifier on the homepage, with the
gates exposed. Place **H** (superposition), **RY/RZ** (rotations by your
chosen θ), and **CNOT** (entanglement, control q0 → target q1) on the two
wires and watch the exact state respond: outcome probabilities on the left,
each qubit's Bloch vector on the right.

Two things worth trying: build a **Bell pair** (H on q0, then CNOT) and
watch the marginals hit 50/50 while |01⟩ and |10⟩ stay at zero — that
correlation is entanglement. Then add an RY on one qubit and see both the
histogram and the Bloch arrows move together.

Every circuit gets a **share link** (the `?c=` in the address bar), and AI
agents can build circuits here too, through the `compose_circuit` tool on
the [machine interface](/agents). The math behind each gate is derived
step-by-step in the [six-lesson curriculum](/learn).
