---
title: "Machine Learning in the Realm of Quantum: Training a Classifier on a Quantum Circuit"
series: ml-research
order: 1
summary: "My undergraduate thesis, rebuilt from first principles: what a variational quantum circuit actually is, how you encode classical pixels into qubits, how a hybrid quantum-classical model learns by gradient descent on a simulator, and what the numbers honestly showed — 0.92 and 0.72 against classical baselines of 0.96 and 0.88."
readingMinutes: 19
date: 2026-07
tags: [quantum-machine-learning, pennylane, variational-circuits, research, deep-learning]
status: active
---

## The question that started it

In my final undergraduate year at North South University, my thesis partner and I asked a question that sounds simple and turns out not to be: **can today's quantum computers learn to read handwritten digits?**

Not "will quantum computers one day change machine learning" — that's a keynote-slide question, and the honest answer is nobody knows. Our question was smaller and testable. Take MNIST, the most boring, most solved dataset in machine learning — 28×28 grayscale digits, a classical neural network cracks it to 99% before lunch — and try to classify it with a model that runs part of its computation on a *quantum circuit*. Then put that model next to an ordinary classical network of the same size and measure the gap.

We built two of them, deliberately different, and trained both on a simulator. This is the story of what a variational quantum circuit actually is, how classical pixels get *into* a qubit, how the thing learns by gradient descent, and what the numbers honestly said when we stopped hand-waving and ran the experiment.

:::aside
Reading as an academic? Flip the ⟨lens| in the top nav to **professor** to reveal the derivations, ablation tables, and hyperparameters inline.
:::

## Why quantum machine learning at all

The pitch for quantum computing is that some problems are exponentially expensive classically and cheap quantumly. A quantum system of *n* qubits lives in a state space of dimension 2ⁿ — as I wrote in the thesis, there are "more bytes than atoms in the observable universe" once you have a few hundred qubits, because the space they span grows that fast. Grover's search and Shor's factoring algorithm show real speedups exist. So the temptation is obvious: if a quantum computer can represent an astronomically large space in a handful of qubits, maybe it can represent the kind of high-dimensional decision boundary a classifier needs, more efficiently than a classical net.

That's the promise. Here's the honest reality, and it's the frame for everything below: we are in the **NISQ era** — Noisy Intermediate-Scale Quantum. Real devices have tens to low-hundreds of qubits, they're noisy, they're not fault-tolerant, and — this is the part people skip — even getting your classical data *onto* the device is expensive. So nobody serious was claiming a quantum classifier would beat a classical one on MNIST in 2022. The interesting research question wasn't "does quantum win," it was "**how close can a first-generation hybrid model get, and where exactly does it lose?**" That's what a measured baseline gives you that a keynote never will.

## Qubits, superposition, entanglement — only what the models use

Just enough physics to follow the circuits, no more.

A classical bit is 0 or 1. A **qubit** is a unit vector in a 2-dimensional complex space: $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$, with $|\alpha|^2 + |\beta|^2 = 1$. That's **superposition** — until you measure, it's a weighted blend of both, and the weights are continuous. This matters for us because it means a qubit can *hold a continuous number* — an angle — and that's exactly the hook we'll use to smuggle a pixel value into the quantum world.

**Measurement** collapses the qubit: you don't read out $\alpha$ and $\beta$, you get 0 or 1 with probabilities $|\alpha|^2$ and $|\beta|^2$. So the only way to see what a circuit computed is to run it many times and estimate an expectation value — for us, the expected value of the Pauli-Z observable, a number in $[-1, 1]$. That expectation is the circuit's "output neuron."

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

Four pixels, four qubits, four `RY` rotations. A bright pixel rotates its qubit further than a dark one. The pixel *is* the angle. Simple, cheap, and it caps how much data one qubit carries — one number each. That single patch then passes through an entangling layer and gets read out as four expectation values; sweep it across the image and you have a feature map.

![Model 1's angle encoding: each pixel of a 2×2 patch drives an RY rotation, a variational ansatz entangles the four qubits, and each wire is measured as a Pauli-Z expectation — four output channels.](/figures/research-qml-encoding.svg)

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

:::professor[The encoding as a feature map]
Angle encoding is the map $x \mapsto |\phi(x)\rangle$ built by applying a rotation per feature. For a single qubit,

$$
R_Y(\pi x)\,|0\rangle \;=\; \cos\!\Big(\tfrac{\pi x}{2}\Big)\,|0\rangle \;+\; \sin\!\Big(\tfrac{\pi x}{2}\Big)\,|1\rangle ,
$$

so a normalized pixel $x \in [0,1]$ sweeps the qubit from $|0\rangle$ to $|1\rangle$. Across four wires the joint state is the tensor product $\bigotimes_{j} R_Y(\pi x_j)|0\rangle$ *before* the entangling layer — separable, hence cheap — and the `RandomLayers` block is what couples the wires so the map is no longer a product state.

The continuous-variable encoding is richer: displacement, squeezing, and beamsplitter gates place a Gaussian state in phase space, and the **Kerr gate** $\exp(i\kappa\,\hat n^2)$ is the only *non-Gaussian* element — without it the whole circuit would be classically simulable in polynomial time (Gaussian states + Gaussian operations are efficiently trackable). The non-Gaussianity is exactly what buys the model expressive power, and exactly what makes the Fock-space simulation expensive. Truncating the infinite-dimensional Fock space to `cutoff_dim = 4` is the approximation that makes it runnable at all.
:::

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

Then you **measure** to get a prediction. The circuit ends by reading out photon-number probabilities across the two modes, and those probabilities are the class scores. (A small, real detail: we padded MNIST's 10 one-hot labels out to length $4^2 = 16$ so they'd line up with the two-mode, cutoff-4 measurement space — 10 real classes plus 6 zeros of padding.)

:::professor[Ansatz parameter accounting]
Each `qnn_layer` allocates its 14 parameters as an interferometer–squeeze–interferometer–displace–Kerr stack, mirroring the affine-then-nonlinear structure of a dense layer:

| Sub-block | Gates | Params | Neural-net analog |
|---|---|---|---|
| Interferometer 1 | 1 beamsplitter + 2 rotations | 4 | first half of the "weight matrix" |
| Squeezers | 2 squeezing | 2 | scaling along mode axes |
| Interferometer 2 | 1 beamsplitter + 2 rotations | 4 | second half of the weight matrix |
| Displacement | 2 displacement | 2 | bias term |
| Kerr | 2 Kerr | 2 | non-linear activation |

That is $4+2+4+2+2 = 14$ parameters per layer. With `num_layers = 4` the quantum block holds $4 \times 14 = 56$ trainable parameters. Weights were initialized with `tf.random.normal` — passive (interferometer/rotation) angles at $\sigma = 0.1$, active (squeeze/displace/Kerr) magnitudes at $\sigma = 10^{-4}$, so the circuit starts near the identity and doesn't blow the Fock cutoff on step one.
:::

## The hybrid loop: how a classical optimizer trains a quantum circuit

Here's the piece that makes it *machine learning* and not just a fixed physics experiment. If the quantum circuit has tunable angles, and you can define a loss, you need gradients — you need to know which way to nudge each of the 56 angles to lower the loss. But the circuit's output is a measurement, an expectation value. How do you differentiate a quantum measurement?

The answer is the **parameter-shift rule**, and it's genuinely elegant: for these gates, the exact gradient of the expectation with respect to a parameter is $\tfrac{1}{2}\big[f(\theta + \tfrac{\pi}{2}) - f(\theta - \tfrac{\pi}{2})\big]$ — you evaluate the *same circuit twice*, with that one angle shifted forward and back, and subtract. No finite-difference approximation, no peeking inside the state. It's an analytic derivative you get by running the circuit itself. That's what lets a quantum circuit sit inside an ordinary gradient-descent loop.

![The hybrid quantum-classical loop — data is encoded into qubit rotations, a parameterized variational circuit transforms the state, a measurement yields class scores, a loss is computed, and a classical optimizer sends the parameter-shift gradient back to update the circuit's angles.](/figures/research-qml-training-loop.svg)

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

:::professor[Deriving the parameter-shift rule]
Take a gate generated by a Pauli-type operator $P$ with eigenvalues $\pm 1$, i.e. $U(\theta) = e^{-i\theta P/2}$, and an observable $A$. The expectation as a function of that one parameter is

$$
f(\theta) \;=\; \langle\psi|\,U^\dagger(\theta)\,A\,U(\theta)\,|\psi\rangle .
$$

Because $P^2 = I$, the generator has the closed form $U(\theta) = \cos(\theta/2)\,I - i\sin(\theta/2)\,P$. Substituting and expanding, $f(\theta)$ contains only $\cos\theta$, $\sin\theta$, and a constant — it is a pure sinusoid in $\theta$ with no higher harmonics. For any such $f(\theta) = a + b\cos\theta + c\sin\theta$, the two symmetric shifts collapse to the slope:

$$
f\!\Big(\theta + \tfrac{\pi}{2}\Big) - f\!\Big(\theta - \tfrac{\pi}{2}\Big) \;=\; 2\big(c\cos\theta - b\sin\theta\big) \;=\; 2\,\frac{\partial f}{\partial \theta},
$$

so the exact analytic gradient is

$$
\frac{\partial f}{\partial \theta} \;=\; \frac{1}{2}\left[\, f\!\Big(\theta + \tfrac{\pi}{2}\Big) - f\!\Big(\theta - \tfrac{\pi}{2}\Big) \right].
$$

The point that trips people up: this is **not** finite differences. The shift $\pi/2$ is macroscopic, not a limit $h \to 0$; the identity is exact for the sinusoidal $f$, so there is no truncation error and no ill-conditioning as $h$ shrinks. You pay two full circuit evaluations per parameter — $2 \times 56 = 112$ forward passes per gradient step for Model 2's quantum block — which is the real cost, but each is an honest analytic derivative. (Gates outside the $\pm1$-eigenvalue family, like the Kerr and squeezing gates, use generalized multi-term shift rules; PennyLane dispatches the right one per gate.)
:::

## The two models, side by side

We built two hybrids on purpose, because they stress different parts of the idea.

**Model 1 — the quanvolutional network** (after Henderson et al., 2019). This borrows the convolution idea. Instead of a classical filter sliding across the image, a tiny **4-qubit circuit** slides across it. Each 2×2 patch is angle-encoded into 4 qubits, transformed by a random quantum circuit, and read out as 4 Pauli-Z expectations — 4 output channels. Sweeping non-overlapping 2×2 patches across the 28×28 image turns it into a **14×14×4** feature stack, which a classical dense head then classifies (512→256→128→64→dropout→10-way softmax, Adam). We ran this on the gate-based `default.qubit` simulator, over 6,000 training and 1,000 test images.

The honest structural point, which I want to state plainly: in this model **the quantum circuit is a *fixed, random* feature extractor — its gates are not trained.** The `RandomLayers` weights are drawn once from a fixed seed and frozen; only the classical head learns. That's faithful to the original quanvolution paper, but it means Model 1's quantum part is a quantum *preprocessing* step, not a trained quantum classifier. The parameter-shift training story above is Model 2's.

**Model 2 — the continuous-variable QNN** (after Killoran et al.). This is the one that actually trains its quantum weights. A classical front-end (Flatten → 128 → 64 → 32 → 14, ReLU) compresses each image to 14 numbers; those drive the photonic encoding; four variational layers (the 56 trainable quantum parameters) transform the state; a measurement gives the prediction. The whole thing — 111,278 classical parameters plus 56 quantum ones, **111,334 total** — trains end-to-end with plain SGD (learning rate 0.02, batch 64). Because the photonic simulation is expensive, we trained on just **600 images** and tested on 100.

## What the numbers honestly showed

We compared each hybrid against a classical neural network of comparable size on three things: which reaches peak accuracy first, which reaches minimum loss first, and final test accuracy.

![Test accuracy: the quanvolutional hybrid lands at 0.92 against a 0.96 classical baseline; the continuous-variable QNN lands at 0.72 against 0.88. Both hybrids trail — narrowly for Model 1, widely for Model 2.](/figures/research-qml-results.svg)

Both hybrids lost. That's the finding, and the margins are the interesting part.

The **quanvolutional** model came genuinely close: 92% against the classical 96%, with matching high-0.9s training accuracy. And on the training curves it had one real bright spot — the hybrid reached its **minimum loss faster** than the classical model, even though the classical model hit peak *accuracy* first. A quantum-preprocessed feature stack was, at least, not obviously worse to optimize.

The **CV-QNN** — the one that actually trained quantum weights — lost by more: 72% against 88%. Its validation-accuracy curve sat below the classical one for the whole run, noticeably noisier and slower to settle, and its loss took much longer to come down. Training the 56 quantum parameters through a simulated photonic circuit was simply harder than training the equivalent classical weights.

Neither result is a disappointment, because neither was ever going to win. What they *are* is a clean, measured snapshot of first-generation QML: on classical data, hybrid quantum models did **not** beat optimized classical networks — but the gate-based quanvolutional approach got within four points, which is closer than the hype-versus-cynicism framing would lead you to expect either way.

:::professor[Full results and hyperparameters]
The reported test/train accuracies (thesis Tables 5.1–5.2), with the classical baseline trained under matched conditions in the same notebook:

| Model | Encoding | Quantum trained? | Train acc | Test acc | Classical baseline (test) |
|---|---|---|---|---|---|
| **Model 1** — quanvolutional NN | angle ($R_Y$) | no (random, frozen) | 0.98 | **0.92** | 0.96 |
| **Model 2** — CV-QNN | photonic (squeeze/BS/Kerr) | yes (56 params) | 0.98 | **0.72** | 0.88 |

Convergence, on the same figures: for **both** models the classical baseline reached peak *accuracy* first; for Model 1 the hybrid reached minimum *loss* faster than the classical net, whereas for Model 2 the hybrid took *longer* to reach its loss floor.

Hyperparameters, pulled straight from the notebooks:

| | Model 1 (quanvolutional) | Model 2 (CV-QNN) |
|---|---|---|
| Framework | PennyLane 0.24 · TF/Keras 2.9 | PennyLane 0.24 · Strawberry Fields 0.23 |
| Device | `default.qubit`, 4 wires | `strawberryfields.fock`, 2 modes, `cutoff_dim=4` |
| Quantum params | 16 random, **frozen** (4 layers × 4) | **56 trainable** (4 layers × 14) |
| Classical head | 512→256→128→64→drop(0.2)→10 softmax | 128→64→32→14 front-end (111,278 params) |
| Optimizer | Adam + `ReduceLROnPlateau` | SGD, lr `0.02` |
| Loss | sparse categorical cross-entropy | categorical cross-entropy |
| Batch / epochs | 10 / 10 | 64 / 150 |
| Train / test size | 6,000 / 1,000 | 600 / 100 |
| Seed | `np.random.seed(0)`, `tf.random.set_seed(0)` | init σ: passive 0.1, active 1e-4 |

Two honest run-notes the tables flatten. First, Model 1's `n_epochs = 100` variable is defined but the actual `.fit()` runs **10** epochs — the effective training length is short, and the quanvolutional run's `ReduceLROnPlateau` drove the learning rate to ~$10^{-28}$, freezing validation accuracy at 0.916 for its final epochs (which rounds to the reported 0.92). Second, Model 2's requested 150 epochs recorded 139 in the saved history; the run peaked at **0.73** validation accuracy and finished at 0.70, and the thesis reports **0.72** as the headline test figure — I quote the thesis number in the table and flag the spread here.
:::

## Being honest about the limits

A portfolio piece that oversells its own thesis isn't worth writing, so here's the fine print, stated as plainly as the results:

- **It all ran on simulators**, not quantum hardware. A `default.qubit` state simulator and a Strawberry Fields Fock simulator. No real qubits, so no real decoherence or gate-error noise — the *easy* setting, and it still lost.
- **The circuits are tiny**: 4 qubits for Model 1, 2 qumodes (cutoff dimension 4) for Model 2. That's the NISQ reality — you cannot casually scale to the qubit counts that would matter.
- **The datasets are small**, especially Model 2's 600 training images, because simulating quantum circuits is exponentially expensive in the number of qubits. Which is the quiet irony: the very thing that makes quantum computing potentially powerful is what makes *simulating* it, to test it, so painful.
- **No quantum advantage is claimed, and none was observed.** These are hybrids where a classical network does much of the heavy lifting; Model 1's quantum layer isn't even trained. The comparison shows the current gap, not a path to closing it.
- **Convergence "wins" are narrow.** Model 1 reaching minimum loss faster is a real, measured observation on this setup — not evidence of general quantum speedup.

:::professor[Where each model actually fails]
The two failure modes are different in kind, and worth separating:

- **Model 1 is bottlenecked by a *frozen, random* feature map.** Its quantum circuit never sees a gradient — `RandomLayers` is drawn once and never updated. So the ceiling is whatever separability a random 4-qubit entangler happens to give the classical head. It does well (0.92) only because the classical head is large and MNIST is easy; the quantum part is doing quantum *preprocessing*, not learning. The fix is a trainable ansatz, at which point you inherit Model 2's problems.
- **Model 2 is bottlenecked by *trainability and truncation*.** Training 56 parameters through a Fock simulation truncated at `cutoff_dim = 4` is both expensive (112 circuit evals per gradient step from the shift rule) and fragile: too large a squeeze/displacement leaks probability past the cutoff and silently corrupts the state, which is why the active gates are initialized at $\sigma = 10^{-4}$. Layer this on top of the **barren-plateau** phenomenon — for many random parameterized circuits the gradient variance vanishes exponentially in qubit count — and it is unsurprising that the CV-QNN's loss descended slowly and its validation curve stayed noisy. The 0.72 isn't a coding bug; it's the honest difficulty of optimizing a non-Gaussian photonic circuit on 600 samples.

The single change with the most leverage, if I picked this back up, is a **trainable data-encoding** (a learned feature map) rather than either a fixed random entangler or a hand-built photonic encoding — because, as below, the encoding was the real bottleneck all along.
:::

The thesis's own conclusion put the pragmatic case well: converting *all* classical data to quantum data is costly, so "there need a bridge between quantum and classical computer and this hybrid model is exactly what we need." The hybrid isn't a compromise you settle for — in the NISQ era it's the only honest architecture.

## What the thread became

The lesson I actually carried forward wasn't "quantum is fast" or "quantum is a dead end." It was narrower and more useful: **the encoding is the bottleneck.** Every hard decision in both models — the angle rotations, the 14-number compression, the choice of squeezers and Kerr gates — was really a decision about how to get classical information into a quantum state without destroying it before the model could use it. That's where the difficulty lives, and it's where I'd start if I picked the thread back up: better data encodings, and trainable quantum feature maps rather than the fixed random one Model 1 leans on.

If you want the underlying mathematics up close, the same parameter-shift rule from this thesis is what trains models elsewhere in this site — it's a surprisingly small idea doing a surprisingly large amount of work.

The full thesis, with the state-of-the-art review and the complete methodology, is at [/research/quantum-machine-learning-thesis](/research/quantum-machine-learning-thesis), and both notebooks — the quanvolutional network and the continuous-variable QNN — are on [GitHub](https://github.com/abuammarsami/CSE499.06-QML-). Everything above is reproducible from the code; the numbers are the ones the runs actually produced.
