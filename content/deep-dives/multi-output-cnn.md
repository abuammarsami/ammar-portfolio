---
title: "One Network, Three Answers: Age, Gender, and Race with a Multi-Output CNN"
series: ml-research
order: 5
summary: "Instead of training three separate models, one CNN shares a backbone and branches into three heads — a regression for age, classifications for gender and race. Why multi-task learning helps, how you balance three losses, and what the trade-offs were."
readingMinutes: 15
date: 2026-07
tags: [computer-vision, multi-task-learning, cnn, deep-learning, research]
status: active
---

## Three models, or one?

The obvious way to predict a person's age, gender, and race from a photo of their face is to train three models. One regressor for age. One classifier for gender. One classifier for race. Each gets its own architecture, its own training run, its own weights on disk. It works, and it's the first thing most people reach for, because it decomposes the problem into three tasks you already know how to solve.

I built the other thing: **one convolutional network that produces all three answers at once**. A single forward pass takes a face and emits an age (a real number), a gender (one of two classes), and a race (one of five). Not three models in a trench coat — one model, trained jointly, with three output heads hanging off a shared body.

The interesting question isn't *how* to wire that up — Keras makes the plumbing trivial. It's *why it should work at all*, and what it costs you. Because the moment you put three tasks in one network, you inherit a problem the three-model approach never has: the three tasks have to agree on one set of weights, and they have to share one loss. This write-up is about that tension — the case for sharing, the architecture that does it, and the loss-balancing act that turns out to be the whole game.

:::aside
Reading as an academic? Flip the ⟨lens| in the top nav to **professor** to reveal the derivations, ablation tables, and hyperparameters inline.
:::

## The task and the data

The dataset is **UTKFace** — a public collection of face images, a little over **23,000** of them once you drop the unparseable files. Every image is labelled in its *filename*: a file called `26_0_2_20170104....jpg` decodes as age 26, gender 0, race 2. The parser in the notebook does exactly that — split the filename on underscores, take the first three fields:

```python
age, gender, race, _ = filename.split('_')
return int(age), dataset_dict['gender_id'][int(gender)], dataset_dict['race_id'][int(race)]
```

That gives three label types of genuinely different character, which is the whole reason the project is interesting:

- **Age** — an integer from **0 to 116**. Continuous. This is a *regression* target.
- **Gender** — `0` male, `1` female. Binary *classification*.
- **Race** — a 5-way *classification*: `0` white, `1` black, `2` asian, `3` indian, `4` others.

Preprocessing is deliberately plain. Every image is resized to **198×198×3** and scaled to `[0, 1]` by dividing by 255. The two categorical labels are one-hot encoded. And age gets a step that matters more than it looks: it's **normalized by the maximum age in the dataset**, so the regression target lands in `[0, 1]` alongside everything else:

```python
ages.append(age / self.max_age)          # age → [0, 1]
races.append(to_categorical(race, 5))
genders.append(to_categorical(gender, 2))
```

Hold onto that normalized age. It comes back to bite the loss function in a way that explains one of the strangest-looking numbers in the whole project.

The split is 70/30 nested: 70% of the data goes to a training pool, 30% held out for test; then the training pool is split 70/30 again into train and validation. That leaves roughly **half the data for training, a fifth for validation, and 30% — about 7,000 images — for the final test** (the race classification report below is computed on exactly **7,040** test faces).

## Why one network beats three

There are three arguments for sharing a network across tasks, and they build on each other.

**Efficiency is the shallow one.** Three models mean three sets of convolutional weights, three forward passes at inference, three things to deploy and keep in sync. One model with three heads shares almost all of its parameters and runs once. The whole thing here is **~3.2 million parameters** — a single artifact you can ship. That's nice, but it's not the real reason.

**Shared representations are the deeper one.** Age, gender, and race are not three unrelated facts that happen to co-occur on a face. They are all read from the *same underlying structure* — bone geometry, skin texture, the shape of features, the way a face has aged. A convolutional stack that learns to see faces well — edges, then parts, then configurations — is learning features that *all three* tasks need. Forcing them to share that stack means the features get pressure from three directions at once, and the ones that survive are the ones useful to all of them. You're not learning three private feature sets; you're learning one good one, three times as supervised.

**The inductive-bias argument is the one I find most convincing.** This is the classic multi-task-learning result: **related tasks regularize each other.** When a network only has to predict gender, it can overfit — find some spurious shortcut in the training set that happens to correlate with gender and lean on it. But a shared representation that *also* has to predict age and race can't afford a gender-only shortcut, because that shortcut has to keep paying rent for the other two tasks. The other tasks act as a prior. They constrain the shared features toward things that are genuinely about the face, not artifacts of one label. Multi-task learning is, in this framing, a form of regularization you get for free by adding supervision instead of removing capacity.

![One convolutional body, ~3.2M parameters, forks into three heads: an age regression head, a gender classification head, and a race classification head — activation flows out to all three at once.](/figures/research-moc-architecture.svg)

That figure is the *conceptual* model, and it's worth being honest that the code has two versions of it — which is the next section.

## The architecture, honestly

There's a clean way to tell this story and a true way, and they differ. Here's the true one.

The **refactored package** in the repo implements the textbook multi-task design the figure shows: a single shared convolutional trunk — `Conv2D` into stacked separable-conv blocks with batch norm and dropout, down to a global pool and dense layers — that then *forks* into three output heads. One body, three heads. That is the idealized shared-backbone architecture, and it's what you'd draw on a whiteboard.

But the model that actually produced the numbers — the one in the original notebook — is subtly different, and I'd rather show you the real thing. It has **three parallel convolutional towers**, one per task, each built from the same block:

```python
def make_default_hidden_layers(self, inputs):
    x = Conv2D(16, (3, 3), padding="same")(inputs)
    x = Activation("relu")(x); x = BatchNormalization()(x)
    x = MaxPooling2D(pool_size=(3, 3))(x); x = Dropout(0.25)(x)
    x = Conv2D(32, (3, 3), padding="same")(x)
    x = Activation("relu")(x); x = BatchNormalization()(x)
    x = MaxPooling2D(pool_size=(2, 2))(x); x = Dropout(0.25)(x)
    x = Conv2D(32, (3, 3), padding="same")(x)
    x = Activation("relu")(x); x = BatchNormalization()(x)
    x = MaxPooling2D(pool_size=(2, 2))(x); x = Dropout(0.25)(x)
    return x
```

Each of the three branches calls `make_default_hidden_layers(inputs)` **on the raw input tensor**, then flattens, runs a `Dense(128) → ReLU → BatchNorm → Dropout(0.5)`, and finishes with its own task-specific head:

- **Age:** `Dense(1)` with a `linear` activation — a raw real number.
- **Race:** `Dense(5)` with `softmax` — a distribution over five classes.
- **Gender:** `Dense(2)` with `sigmoid`.

So what's actually shared in the trained model? **Only the input and the joint loss.** The three towers don't share convolutional weights at all — they're independent feature extractors that happen to be assembled into one `Model` and optimized together. That's a weaker form of multi-task learning than the shared-trunk ideal: the tasks still regularize each other *through the joint objective and the shared input pipeline*, but they don't share intermediate features the way the refactored version intends. It's a legitimate multi-output model — one artifact, one training loop, three simultaneous predictions — but if I were defending it at a whiteboard I'd say plainly that the version worth keeping is the shared-trunk one, and the numbers below come from the three-tower one.

Two more real details, because they're the kind of thing that gets sanded out of a polished retelling. The gender branch opens with a `Lambda` layer that converts the input to grayscale — and then **never uses it**, calling `make_default_hidden_layers` on the original color input on the very next line. It's a dead computation, a fossil of an idea that didn't get wired through. And the gender head uses a 2-unit `sigmoid` rather than the more conventional `softmax`-over-two or single-sigmoid setup. Neither hurt the results, but both are the fingerprints of a real project rather than a clean-room reconstruction.

:::professor[Architecture & hyperparameters]
The trained notebook model totals **3,192,648** parameters (3,191,400 trainable). Every head is the same body plus a task cap; nothing is shared between the three towers except the input tensor and the joint objective.

| Component | Definition |
|---|---|
| Input | `198×198×3`, scaled to `[0,1]` (÷255) |
| Backbone block (×1 per tower) | `Conv2D(16,3×3)` → `Conv2D(32,3×3)` → `Conv2D(32,3×3)`, each `ReLU · BatchNorm · MaxPool · Dropout(0.25)` |
| Head | `Flatten` → `Dense(128)` → `ReLU · BatchNorm · Dropout(0.5)` → task output |
| Age output | `Dense(1)`, `linear` — regression on normalized age |
| Gender output | `Dense(2)`, `sigmoid` — 2-class |
| Race output | `Dense(5)`, `softmax` — 5-class |
| Optimizer | `Adam(lr=1e-4, decay=1e-4/80)` |
| Epochs / batch | `80` / `42` |
| Checkpoint | `ModelCheckpoint(monitor="val_loss")` |

The `decay=lr/epochs` gives a mild linear-ish LR falloff, but as the loss curves below show, it wasn't aggressive enough to stop the late-run overfitting — a harder schedule (or early stopping on `val_loss`, which the checkpoint effectively simulates) would have helped.
:::

## The loss problem is the whole problem

Here is where multi-task learning stops being free. Each head needs its own loss, and the three losses are not measured in the same units at all:

```python
loss = {
    'age_output':    'mae',                        # regression
    'race_output':   'categorical_crossentropy',   # 5-class
    'gender_output': 'binary_crossentropy',        # 2-class
}
```

Age is trained with **mean absolute error** — but on the *normalized* age, the one squeezed into `[0, 1]`. So the age loss is a number like 0.05. The two classification losses are cross-entropies, which live on a completely different scale — typically starting well above 1 and falling toward zero. If you just add these three numbers up and backpropagate the sum, **the biggest-magnitude loss dominates the gradient**, and the model quietly decides to get good at whichever task happens to shout loudest. The tasks aren't competing on merit; they're competing on the arbitrary scale of their loss units.

The fix is loss weighting, and this is the single most important design decision in the project:

```python
loss_weights = {
    'age_output':    4.0,
    'race_output':   1.5,
    'gender_output': 0.1,
}
```

Read those weights and you can reconstruct the reasoning. **Age is weighted 4×** — the heaviest — precisely *because* its MAE-on-normalized-target is numerically tiny (around 0.05). Without a big multiplier, the age task's gradient would be a rounding error next to the cross-entropies, and the shared optimization would ignore it. The 4.0 lifts it back into contention. **Gender is weighted 0.1** — the lightest by far — because gender is the *easy* task: with two roughly balanced classes it converges fast and hits very high accuracy early. Left at full weight it would keep contributing large, confident gradients long after it had nothing left to learn, crowding out the harder tasks. Down-weighting it to a tenth says "you're basically done, stop hogging the gradient." **Race sits in the middle at 1.5**, the genuinely hard classification that deserves real signal.

![The three per-head losses are scaled — age MAE ×4.0, race cross-entropy ×1.5, gender cross-entropy ×0.1 — summed into one objective, and a single gradient flows back into the shared trunk. The weights are the craft: get them wrong and one task starves the other two.](/figures/research-moc-loss.svg)

That's the crux of multi-task learning in one dictionary. The architecture is easy; the *balancing* is the craft. These three numbers — `4.0`, `1.5`, `0.1` — are hand-tuned, and getting them wrong doesn't crash anything. It just silently produces a model that's excellent at one task and mediocre at the others, and you won't know why unless you understand that you were never really training three tasks — you were training their weighted sum.

:::professor[The multi-task objective]
Write $\theta$ for the shared parameters and $\phi_a, \phi_r, \phi_g$ for the per-head parameters. The total objective is a fixed weighted sum of one regression term and two cross-entropy terms:

$$
\mathcal{L}_{\text{total}} \;=\; w_a\,\mathcal{L}_{\text{age}} \;+\; w_r\,\mathcal{L}_{\text{race}} \;+\; w_g\,\mathcal{L}_{\text{gender}}
$$

with the per-head losses, over a batch of $N$ faces,

$$
\mathcal{L}_{\text{age}} = \frac{1}{N}\sum_{i=1}^{N}\bigl|\hat{a}_i - a_i\bigr|,
\qquad
\mathcal{L}_{\text{race}} = -\frac{1}{N}\sum_{i=1}^{N}\sum_{c=1}^{5} y^{r}_{i,c}\,\log\hat{y}^{r}_{i,c},
\qquad
\mathcal{L}_{\text{gender}} = -\frac{1}{N}\sum_{i=1}^{N}\sum_{c=1}^{2} y^{g}_{i,c}\,\log\hat{y}^{g}_{i,c}
$$

where the age target is **max-normalized** to $a_i = \text{age}_i / \text{age}_{\max} \in [0,1]$ and $\hat{a}_i$ is the head's prediction of it, and the weights are

$$
w_a = 4.0, \qquad w_r = 1.5, \qquad w_g = 0.1.
$$

The point of the weights is what they do to the *gradient* on the shared trunk:

$$
\nabla_{\theta}\,\mathcal{L}_{\text{total}} \;=\; w_a\,\nabla_{\theta}\mathcal{L}_{\text{age}} \;+\; w_r\,\nabla_{\theta}\mathcal{L}_{\text{race}} \;+\; w_g\,\nabla_{\theta}\mathcal{L}_{\text{gender}}.
$$

Because $\mathcal{L}_{\text{age}}$ is an MAE on a target in $[0,1]$, it is $\mathcal{O}(0.05)$ while the cross-entropies start $\mathcal{O}(1)$. At $w_a=1$ the age gradient would be ~20× smaller than the race gradient and effectively ignored; the $w_a=4.0$ multiplier restores it to a competitive magnitude. Symmetrically, $w_g=0.1$ throttles the gender gradient once it has saturated (train accuracy hits ~0.99 within a few epochs) so it stops dominating $\theta$ after it has nothing left to teach. This is the fixed-weight, hand-tuned form of the problem that methods like **uncertainty weighting** (Kendall et al.) or **GradNorm** try to learn automatically — here the balancing is a hyperparameter, not a learned quantity, which is exactly why it took the bulk of the tuning effort.
:::

The rest of the training config is unremarkable and I'll state it for completeness: **Adam at a 1e-4 learning rate** with a small decay of `lr / epochs`, **80 epochs**, batch size **42**, checkpointing on validation loss.

## What it actually scored

The one age number that's printed unambiguously in the notebook is the **R² of 0.814** on the test set — the model explains about 81% of the variance in age. In normalized-MAE terms the validation error settled around **0.05**, which, multiplied back through the age range, lands the mean absolute error in the neighbourhood of **6–7 years** (the repo reports ~6.8). For a task where humans routinely miss by a decade guessing strangers' ages, that's a solid regressor.

**Gender** was the easy task, as the loss weights already predicted: validation accuracy peaked around **95.8%** and finished near **94.8%**, with training accuracy up at **99.1%**. The confusion matrix is a clean diagonal.

**Race** is where the honesty lives. Test accuracy was **87%**, but the aggregate hides the story the per-class report tells:

| Race | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| white | 0.86 | 0.94 | 0.90 | 3024 |
| black | 0.90 | 0.91 | 0.91 | 1342 |
| asian | 0.92 | 0.89 | 0.91 | 1035 |
| indian | 0.84 | 0.82 | 0.83 | 1152 |
| **others** | **0.70** | **0.37** | **0.49** | **487** |

Four classes are strong. The fifth — **"others"** — collapses: a recall of **0.37** means the model *misses nearly two-thirds* of the faces in that category. And it's obvious why. "Others" is a catch-all with the fewest examples (487, versus 3,024 for white) and no coherent visual definition — it's a label that means "none of the above," which is not a thing a feature detector can learn a prototype for. The macro-averaged F1 of **0.81** sits well below the 0.87 accuracy precisely because macro-averaging refuses to let the big easy classes paper over the small impossible one. The headline accuracy is real; it's also the most flattering way to state the result.

![Per-head test results: age R² 0.81 (MAE ~6.8 yr), gender 94.8% validation accuracy, race 87% test accuracy — with a red flag that the race head's "others" class has recall of only 0.37.](/figures/research-moc-results.svg)

:::professor[Measured results — every number from the notebook]
No single-task baselines were trained, so these are the multi-output numbers on their own; the fair comparison against three independent models is exactly the ablation this project is missing.

| Head | Task | Metric | Value | Source |
|---|---|---|---|---|
| Age | regression | R² (test) | **0.8143** | `r2_score`, cell 35 |
| Age | regression | MAE, normalized (val best) | 0.050 | training log |
| Age | regression | MAE, years (approx.) | ~6.8 | repo README |
| Gender | 2-class | val accuracy (peak / end) | 0.958 / 0.948 | training log |
| Gender | 2-class | train accuracy (peak) | 0.992 | training log |
| Race | 5-class | test accuracy | 0.870 | `classification_report`, 7040 faces |
| Race | 5-class | val accuracy (peak / end) | 0.907 / 0.876 | training log |
| Race | 5-class | macro-F1 / weighted-F1 | 0.81 / 0.86 | `classification_report` |

**Overfitting in the tail.** The joint loss diverged late: training loss fell to **0.115** while validation loss reached its best of **0.559** mid-run and then climbed back to **1.073** by epoch 80. The `ModelCheckpoint(monitor="val_loss")` is what preserved a usable model out of the run — without it, the final-epoch weights would have been meaningfully worse than the checkpointed ones. This is the single most fixable weakness: early stopping on `val_loss`, stronger LR decay past the midpoint, or more aggressive dropout/augmentation would all have narrowed the train/val gap.
:::

One more honest observation from the training curves: the **validation loss diverged from the training loss late in the run** — training loss kept sliding down toward 0.12 while validation loss climbed back up past its best of ~0.56. That's textbook overfitting in the tail, and the checkpoint-on-validation-loss is what saved a usable model out of it. A learning-rate schedule that decayed harder after the midpoint would almost certainly have helped.

## The limits, and the part that isn't just engineering

The dataset caveats compound the way they always do. UTKFace's age labels are themselves estimates in many cases; its race taxonomy is a coarse five-bucket scheme with an incoherent fifth bucket; and the distribution is skewed toward some groups over others. A model trained on that data inherits all of it. The "others" collapse isn't a bug I could tune away — it's the data's structure surfacing in the metrics.

And I want to be straight about the race head specifically, because it's not just another output. Classifying people by race from their faces is a task with a genuinely fraught history and real potential for harm — it's the kind of capability that reads very differently depending on who deploys it and why. I built this as a **course project in multi-task learning**, and the technically interesting content — sharing a backbone, balancing a regression loss against two classification losses — is entirely separable from that particular head. The multi-output *lesson* would be exactly the same if the third task were, say, facial-expression or accessory detection. If I were taking this past a coursework demo, the race output is the first thing I'd interrogate hard: whether it should exist at all, what it would be used for, and whether a 5-way bucket with a 37%-recall garbage class is doing anything but laundering a bad taxonomy into a confident-looking softmax. A high accuracy number is not the same as a defensible one.

:::professor[Fairness, and age-as-regression vs. bucketing]
Three analytical points I'd defend in a viva:

1. **The accuracy metric is complicit in hiding the harm.** Overall accuracy is support-weighted, so the 3,024-face `white` class (recall 0.94) and the 487-face `others` class (recall 0.37) contribute to the same 0.87 in proportion to their size — the largest, easiest group dominates the headline. Macro-F1 (0.81) is the honest single number because it weights every class equally regardless of support; the 0.06 gap between them *is* the fairness story, quantified. Reporting only accuracy on an imbalanced, socially-loaded classification is a methodological choice with ethical consequences, not a neutral default.

2. **The "others" class is a taxonomy failure, not a modeling failure.** A softmax head learns a prototype per class. "Others" has no prototype — it is defined by exclusion — so no amount of capacity or tuning gives it a decision region a classifier can find. Re-weighting the loss toward it, or oversampling it, would trade its recall against the others' precision without ever fixing the underlying incoherence. The correct fix is upstream: drop the class, or replace the taxonomy with one whose categories are actually visually coherent — which for race, arguably, does not exist.

3. **Age as regression vs. bucketing.** Treating age as a continuous $\text{MAE}$ target (rather than binning into `<10, 10–20, …` classes) is the right call here for two reasons. First, it preserves ordinal structure — predicting 31 for a 30-year-old is nearly right, whereas a bucketed classifier treats an adjacent-bucket miss as fully wrong. Second, an MAE loss is robust to the label noise UTKFace's age annotations carry (many are themselves estimates), where a hard bucket boundary would penalize a near-miss across the boundary as heavily as a gross error. The cost is that the $R^2=0.81$ headline flatters a model whose error bar is still **~7 years** — fine for coarse demographics, useless for anything identity-adjacent.
:::

## The transferable part

Strip away the specifics and this project is a compact lesson in what multi-task learning actually buys and costs. The buy: one artifact, shared features, and tasks that regularize each other into learning something real about the input instead of a per-task shortcut. The cost: you no longer optimize three objectives — you optimize their **weighted sum**, and those weights are a modeling decision as consequential as the architecture. The `4.0 / 1.5 / 0.1` I landed on isn't a detail; it's the difference between a model that learns all three tasks and one that learns the loudest.

Every time I've wired multiple heads onto one network since, the architecture takes an afternoon and the loss balancing takes the rest of the week. That ratio is the real result. Build the shared body if the tasks are related — the inductive bias is real and it's free. But budget your effort for the part that's actually hard: making three losses on three different scales agree on one set of weights.

Code, the notebook that produced these numbers, and the refactored shared-trunk package: [GitHub](https://github.com/abuammarsami/Age-Gender-and-Race-Estimation-with-Multi-Output-CNN-Architecture). Project overview: [/work/multi-output-cnn](/work/multi-output-cnn).
