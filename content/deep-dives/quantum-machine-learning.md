---
title: "Machine Learning in the Realm of Quantum: Training a Classifier on a Quantum Circuit"
series: ml-research
order: 1
summary: "My undergraduate thesis, rebuilt from first principles: what a variational quantum circuit actually is, how you encode classical data into qubits, how a hybrid quantum-classical model learns by gradient descent on a simulator, and what the results honestly showed."
readingMinutes: 14
date: 2026-07
tags: [quantum-machine-learning, pennylane, variational-circuits, research, deep-learning]
status: active
---

## The question that started it

In my final undergraduate year at North South University, my thesis partner and I asked a question that sounds simple and turns out not to be: **can today's quantum computers learn to read handwritten digits?**

Not "will quantum computers one day change machine learning" — that's a keynote-slide question, and the honest answer is nobody knows. Our question was smaller and testable. Take MNIST, the most boring, most solved dataset in machine learning — 28×28 grayscale digits, a classical neural network cracks it to 99% before lunch — and try to classify it with a model that runs part of its computation on a *quantum circuit*. Then put that model next to an ordinary classical network of the same size and measure the gap.

We built two of them, deliberately different, and trained both on a simulator. This is the story of what a variational quantum circuit actually is, how classical pixels get *into* a qubit, how the thing learns by gradient descent, and what the numbers honestly said when we stopped hand-waving and ran the experiment.

## Why quantum machine learning at all

The pitch for quantum computing is that some problems are exponentially expensive classically and cheap quantumly. A quantum system of *n* qubits lives in a state space of dimension 2ⁿ — as I wrote in the thesis, "there are more bytes than atoms in the observable universe," and a few hundred qubits in principle span a space larger than that. Grover's search and Shor's factoring algorithm show real speedups exist. So the temptation is obvious: if a quantum computer can represent an astronomically large space in a handful of qubits, maybe it can represent the kind of high-dimensional decision boundary a classifier needs, more efficiently than a classical net.

That's the promise. Here's the honest reality, and it's the frame for everything below: we are in the **NISQ era** — Noisy Intermediate-Scale Quantum. Real devices have tens to low-hundreds of qubits, they're noisy, they're not fault-tolerant, and — this is the part people skip — even getting your classical data *onto* the device is expensive. So nobody serious was claiming a quantum classifier would beat a classical one on MNIST in 2022. The interesting research question wasn't "does quantum win," it was "**how close can a first-generation hybrid model get, and where exactly does it lose?**" That's what a measured baseline gives you that a keynote never will.

## Qubits, superposition, entanglement — only what the models use

Just enough physics to follow the circuits, no more.

A classical bit is 0 or 1. A **qubit** is a unit vector in a 2-dimensional complex space: `|ψ⟩ = α|0⟩ + β|1⟩`, with `|α|² + |β|² = 1`. That's **superposition** — until you measure, it's a weighted blend of both, and the weights are continuous. This matters for us because it means a qubit can *hold a continuous number* — an angle — and that's exactly the hook we'll use to smuggle a pixel value into the quantum world.

**Measurement** collapses the qubit: you don't read out α and β, you get 0 or 1 with probabilities `|α|²` and `|β|²`. So the only way to see what a circuit computed is to run it many times and estimate an expectation value — for us, the expected value of the Pauli-Z observable, a number in [−1, 1]. That expectation is the circuit's "output neuron."

**Entanglement** is when a multi-qubit state can't be factored into independent single-qubit states — measuring one instantly constrains the others. A two-qubit gate like a beamsplitter or a controlled rotation is what creates it. It's the quantum analog of a layer that lets features interact, and it's why a circuit is more than a stack of independent single-qubit knobs.

That's the whole toolkit: superposition to hold data, entangling gates to mix it, measurement to read a prediction out.

## Getting classical data into a qubit: the encoding bottleneck

Here is the problem that dominated every design decision in the thesis, and the one I most want a reader to walk away understanding: **a neural network eats a vector of numbers, but a quantum circuit eats a quantum state.** Before any "quantum learning" can happen, you have to turn a 784-pixel image into a state of a few qubits. That translation step — the *encoding* — is where most of the difficulty and most of the cost lives.

We used two different encodings, one per model.

**Angle encoding (Model 1).** The cleanest trick in the book. Take a classical value *x*, normalize it, and use it as the *rotation angle* of a gate. In the quanvolutional model each pixel of a 2×2 patch becomes a rotation on its own qubit:

```python
# Encoding of 4 classical input values into 4 qubits
for j in range(4):
    qml.RY(np.pi * phi[j], wires=j)
```

Four pixels, four qubits, four `RY` rotations. A bright pixel rotates its qubit further than a dark one. The pixel *is* the angle. Simple, cheap, and it caps how much data one qubit carries — one number each.

**Continuous-variable encoding (Model 2).** The second model is photonic — it computes with modes of light instead of two-level qubits — so its "gates" are optical operations: squeezing, beamsplitters, displacement, and the Kerr nonlinearity. Here we didn't feed raw pixels in; a classical network first *compressed* each image down to 14 numbers, and those 14 numbers became the parameters of the encoding gates:

```python
def data_encoding(x):
    qml.Squeezing(x[3], x[4], wires=0)
    qml.Squeezing(x[9], x[10], wires=1)
    qml.Beamsplitter(x[5], x[6], wires=[0, 1])
    qml.Rotation(x[7], wires=0); qml.Rotation(x[8], wires=1)
    qml.Displacement(x[1], x[2], wires=0); qml.Displacement(x[11], x[12], wires=1)
    qml.Kerr(x[0], wires=0); qml.Kerr(x[13], wires=1)
```

The subtlety I only appreciated after months of this: **the encoding is not a neutral pipe.** The choice of gates decides which images end up close together in the quantum state space and which end up far apart — it's a feature map, and a bad one throws away the signal before the "learning" part ever runs. Getting classical data into a quantum state honestly dominated the whole project.

## The variational circuit: a quantum layer with knobs

Now the actual "learning" part. A **variational** (or parameterized) quantum circuit is a circuit whose gates have tunable parameters — angles you can adjust — exactly like the weights of a neural network. You set up a fixed *shape* of gates (the **ansatz**), and training means finding the angles that make the circuit produce the right answers.

Model 2's variational layer, straight from the code, reads like a neural-network layer translated into optics:

```python
def qnn_layer(v):
    qml.Beamsplitter(v[0], v[1], wires=[0, 1])      # interferometer  ─┐ a "linear" mixing
    qml.Rotation(v[2], wires=0); qml.Rotation(v[3], wires=1)          #  ┘ of the two modes
    qml.Squeezing(v[4], 0.0, wires=0); qml.Squeezing(v[5], 0.0, wires=1)
    qml.Beamsplitter(v[6], v[7], wires=[0, 1])      # second interferometer
    qml.Rotation(v[8], wires=0); qml.Rotation(v[9], wires=1)
    qml.Displacement(v[10], 0.0, wires=0); qml.Displacement(v[11], 0.0, wires=1)  # "bias"
    qml.Kerr(v[12], wires=0); qml.Kerr(v[13], wires=1)               # non-linear activation
```

Look at the structure: the two interferometers plus squeezers play the role of a weight matrix (a linear transform of the modes), the displacement gates are a bias, and the **Kerr gate is the nonlinearity** — the quantum stand-in for a ReLU. That's not an analogy I invented; it's the Killoran et al. continuous-variable neural-network recipe, and it's why you can call this a "quantum neural network layer" with a straight face. We stacked **four** of these layers, 14 parameters each, for **56 trainable quantum parameters** total.

Then you **measure** to get a prediction. The circuit ends by reading out photon-number probabilities across the two modes, and those probabilities are the class scores. (A small, real detail: we padded MNIST's 10 one-hot labels out to length 4² = 16 so they'd line up with the two-mode, cutoff-4 measurement space.)

## The hybrid loop: how a classical optimizer trains a quantum circuit

Here's the piece that makes it *machine learning* and not just a fixed physics experiment. If the quantum circuit has tunable angles, and you can define a loss, you need gradients — you need to know which way to nudge each of the 56 angles to lower the loss. But the circuit's output is a measurement, an expectation value. How do you differentiate a quantum measurement?

The answer is the **parameter-shift rule**, and it's genuinely elegant: for these gates, the exact gradient of the expectation with respect to a parameter is `[f(θ + π/2) − f(θ − π/2)] / 2` — you evaluate the *same circuit twice*, with that one angle shifted forward and back, and subtract. No finite-difference approximation, no peeking inside the state. It's an analytic derivative you get by running the circuit itself. That's what lets a quantum circuit sit inside an ordinary gradient-descent loop.

![The hybrid quantum-classical loop — classical data is encoded into qubit rotations, a parameterized variational circuit transforms the state, a measurement yields a prediction, and a classical optimizer updates the circuit's parameters by gradient descent.](/figures/research-qml.svg)

The loop, then, is exactly the training loop you already know, with the forward pass detouring through a quantum device:

1. A classical layer preprocesses the image (compress to 14 numbers).
2. Encode those numbers into the quantum state.
3. Run the variational circuit; measure; get class probabilities.
4. Compute the loss (categorical cross-entropy) against the true label.
5. Backpropagate — parameter-shift for the quantum angles, ordinary autodiff for the classical weights — and let the optimizer update *both* in one step.

The reason this was even buildable as an undergrad is the tooling. **PennyLane** (v0.24) exposes the quantum circuit as a `qml.qnn.KerasLayer`, so the entire quantum device drops into a **TensorFlow/Keras** `Sequential` model as if it were one more layer. The photonic simulation ran on Xanadu's **Strawberry Fields** Fock backend. You compile with an optimizer and call `model.fit(...)`. The quantum circuit is, from Keras's point of view, just a layer with 56 weights.

```python
dev = qml.device('strawberryfields.fock', wires=2, cutoff_dim=4)

@qml.qnode(dev, interface="tf")
def quantum_nn(inputs, var):
    data_encoding(inputs)
    for v in var:            # 4 variational layers
        qnn_layer(v)
    return qml.probs(wires=[0, 1])

qlayer = qml.qnn.KerasLayer(quantum_nn, {'var': weights.shape}, output_dim=4)
model.add(qlayer)            # bolt the quantum circuit onto the classical stack
```

## The two models, side by side

We built two hybrids on purpose, because they stress different parts of the idea.

**Model 1 — the quanvolutional network** (after Henderson et al., 2019). This borrows the convolution idea. Instead of a classical filter sliding across the image, a tiny **4-qubit circuit** slides across it. Each 2×2 patch is angle-encoded into 4 qubits, transformed by a random quantum circuit, and read out as 4 Pauli-Z expectations — 4 output channels. Sweeping non-overlapping 2×2 patches across the 28×28 image turns it into a **14×14×4** feature stack, which a classical dense head then classifies (512→256→128→64→dropout→10-way softmax, Adam). We ran this on the gate-based `default.qubit` simulator, over 6,000 training and 1,000 test images.

The honest structural point, which I want to state plainly: in this model **the quantum circuit is a *fixed, random* feature extractor — its gates are not trained.** The `RandomLayers` weights are drawn once and frozen; only the classical head learns. That's faithful to the original quanvolution paper, but it means Model 1's quantum part is a quantum *preprocessing* step, not a trained quantum classifier. The parameter-shift training story above is Model 2's.

**Model 2 — the continuous-variable QNN** (after Killoran et al.). This is the one that actually trains its quantum weights. A classical front-end (Flatten → 128 → 64 → 32 → 14, ReLU) compresses each image to 14 numbers; those drive the photonic encoding; four variational layers (the 56 trainable quantum parameters) transform the state; a measurement gives the prediction. The whole thing — 111,278 classical parameters plus 56 quantum ones, **111,334 total** — trains end-to-end with plain SGD (learning rate 0.02, batch 64, 150 epochs). Because the photonic simulation is expensive, we trained on just **600 images** and tested on 100.

## What the numbers honestly showed

We compared each hybrid against a classical neural network of comparable size on three things: which reaches peak accuracy first, which reaches minimum loss first, and final test accuracy.

| Model | Test accuracy | Classical baseline |
|---|---|---|
| Quanvolutional NN (Model 1) | **0.92** | **0.96** |
| Continuous-variable QNN (Model 2) | **0.72** | **0.88** |

Both hybrids lost. That's the finding, and the margins are the interesting part.

The **quanvolutional** model came genuinely close: 92% against the classical 96%, with matching 0.98/0.99 training accuracy. And on the training curves it had one real bright spot — the hybrid reached its **minimum loss faster** than the classical model, even though the classical model hit peak *accuracy* first. A quantum-preprocessed feature stack was, at least, not obviously worse to optimize.

The **CV-QNN** — the one that actually trained quantum weights — lost by more: 72% against 88%. Its validation-accuracy curve (below the classical one for all 150 epochs) is noticeably noisier and slower to settle, and its loss took much longer to come down. Training the 56 quantum parameters through a simulated photonic circuit was simply harder than training the equivalent classical weights.

Neither result is a disappointment, because neither was ever going to win. What they *are* is a clean, measured snapshot of first-generation QML: on classical data, hybrid quantum models did **not** beat optimized classical networks — but the gate-based quanvolutional approach got within four points, which is closer than the hype-versus-cynicism framing would lead you to expect either way.

## Being honest about the limits

A portfolio piece that oversells its own thesis isn't worth writing, so here's the fine print, stated as plainly as the results:

- **It all ran on simulators**, not quantum hardware. A `default.qubit` state simulator and a Strawberry Fields Fock simulator. No real qubits, so no real decoherence or gate-error noise — the *easy* setting, and it still lost.
- **The circuits are tiny**: 4 qubits for Model 1, 2 qumodes (cutoff dimension 4) for Model 2. That's the NISQ reality — you cannot casually scale to the qubit counts that would matter.
- **The datasets are small**, especially Model 2's 600 training images, because simulating quantum circuits is exponentially expensive in the number of qubits. Which is the quiet irony: the very thing that makes quantum computing potentially powerful is what makes *simulating* it, to test it, so painful.
- **No quantum advantage is claimed, and none was observed.** These are hybrids where a classical network does much of the heavy lifting; Model 1's quantum layer isn't even trained. The comparison shows the current gap, not a path to closing it.
- **Convergence "wins" are narrow.** Model 1 reaching minimum loss faster is a real, measured observation on this setup — not evidence of general quantum speedup.

The thesis's own conclusion put the pragmatic case well: converting *all* classical data to quantum data is costly, so "there needs to be a bridge between quantum and classical computers, and this hybrid model is exactly what we need." The hybrid isn't a compromise you settle for — in the NISQ era it's the only honest architecture.

## What the thread became

The lesson I actually carried forward wasn't "quantum is fast" or "quantum is a dead end." It was narrower and more useful: **the encoding is the bottleneck.** Every hard decision in both models — the angle rotations, the 14-number compression, the choice of squeezers and Kerr gates — was really a decision about how to get classical information into a quantum state without destroying it before the model could use it. That's where the difficulty lives, and it's where I'd start if I picked the thread back up: better data encodings, and trainable quantum feature maps rather than the fixed random one Model 1 leans on.

If you want the underlying mathematics up close, the same parameter-shift rule from this thesis is what trains models elsewhere in this site — it's a surprisingly small idea doing a surprisingly large amount of work.

The full thesis, with the state-of-the-art review and the complete methodology, is at [/research/quantum-machine-learning-thesis](/research/quantum-machine-learning-thesis), and both notebooks — the quanvolutional network and the continuous-variable QNN — are on [GitHub](https://github.com/abuammarsami/CSE499.06-QML-). Everything above is reproducible from the code; the numbers are the ones the runs actually produced.
