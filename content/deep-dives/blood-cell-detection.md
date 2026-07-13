---
title: "Counting Blood Cells: Why Data Augmentation Is a Modeling Decision, Not a Checkbox"
series: ml-research
order: 4
summary: "An object detector for blood-cell microscopy — and the lesson that cost me the most to learn: an augmentation is a claim about which transformations leave the label unchanged. Get the invariances wrong and you teach the model something false."
readingMinutes: 15
date: 2026-07
tags: [computer-vision, object-detection, data-augmentation, medical-imaging, research, deep-learning]
status: active
---

## The one decision I keep coming back to

Most of what I did on this project was ordinary. I took a pretrained object detector, swapped its classification head to predict three classes instead of the eighty it shipped with, pointed it at a microscopy dataset, and fine-tuned it on a 4 GB laptop GPU. The metrics came out respectable — **mAP 0.876 at IoU 0.5** on the held-out test split. None of that is the part I think about.

The part I think about is a decision I made *not* to do something. I did not apply color augmentation. Not brightness jitter, not hue shift, not saturation warping — none of the transformations that every "data augmentation for image classification" tutorial hands you as a default. And the reason is the whole point of this write-up:

> A blood cell's color *is* the label. Stain uptake is exactly what a hematologist reads to tell a white cell from a red one. If I jitter the hue during training, I am telling the model "the answer doesn't change when the color changes" — which, for this data, is a lie.

That sentence took me longer to arrive at than it should have, because I'd internalized augmentation as a preprocessing step you turn on to get free robustness. It isn't. Every augmentation you enable is a claim about your data. This is the story of the model, and of learning to read that claim before flipping the switch.

:::aside
Reading as an academic? Flip the ⟨lens| in the top nav to **professor** to reveal the derivations, ablation tables, and hyperparameters inline.
:::

## The task: three cell types, one crowded field

The clinical problem is counting. A complete blood count — how many red cells, white cells, and platelets are in a sample, and in what proportions — drives a huge fraction of everyday diagnosis, from anemia to infection to clotting disorders. Traditionally a trained technician does this by eye under a microscope. It is slow, tiring, subjective work, and the throughput of a lab is bounded by it.

So the task is object detection: draw a box around every cell in a smear image and label it as one of three classes — **Red Blood Cell (RBC)**, **White Blood Cell (WBC)**, or **Platelet**. I used the **BCCD dataset** (Blood Cell Count and Detection), a well-established public benchmark of stained microscopy images annotated in Pascal VOC format. It is small: **364 images with 4,888 annotations total**, split **255 train / 73 validation / 36 test**. I deliberately took the *raw* VOC version — the one that does *not* ship with pre-augmented images — because I wanted to own the augmentation policy myself rather than inherit someone else's assumptions baked into the files.

One property of this data matters more than its size, and it shows up again later: the classes are wildly imbalanced. A single field is carpeted with red cells; white cells and platelets appear a handful at a time. That imbalance is not a nuisance to be normalized away — it is the biology, and it shapes both the loss function and the augmentation policy.

![The detector draws a box around every cell and labels it RBC, WBC, or Platelet — and the field is carpeted with red cells against a handful of the rest, the extreme imbalance focal loss is built for.](/figures/research-blood-detection.svg)

## The detector: RetinaNet, and why single-stage

I used **RetinaNet** from Torchvision — a **ResNet backbone, a Feature Pyramid Network (FPN), and a focal-loss classification head** — fine-tuned from pretrained weights. A few of these choices are load-bearing, so I'll be specific.

**Single-stage, on purpose.** Two-stage detectors like Faster R-CNN tend to score higher on crowded scenes, but they're heavier and slower. RetinaNet is a one-stage detector that closed most of that accuracy gap, and the reason it could is directly relevant here: **focal loss**. In a dense detection setting, the overwhelming majority of candidate anchor boxes are easy background. Standard cross-entropy lets that sea of easy negatives dominate the gradient. Focal loss down-weights well-classified examples so the model spends its learning budget on the hard cases. A microscopy field packed with hundreds of red cells and a few small platelets is precisely the extreme-imbalance regime focal loss was built for — so the architecture and the data are a genuine match, not a default I reached for.

**Transfer learning, not from scratch.** With only 364 images, training a detector from random initialization would be hopeless. I initialized from pretrained weights so the backbone already knew edges, blobs, and textures, and modified only the classification head to output three classes. The whole exercise was: how far can careful fine-tuning of an off-the-shelf detector go, on modest hardware, without architecture surgery?

**Modest hardware, stated honestly.** Everything ran on an **NVIDIA GeForce RTX 3050 Ti with 4 GB of VRAM** and an AMD CPU at 3.70 GHz, under Windows, in PyTorch with Torchvision, OpenCV, and Torchmetrics. Training config: images resized to **640×640**, **batch size 4**, **40 epochs**, **learning rate 0.001**, no LR schedule. Batch size 4 is not a research choice; it's what fits in 4 GB. I mention it because the constraint is part of the honesty — this was a proving ground, not a leaderboard entry.

There was also unglamorous but essential label hygiene in preprocessing: after loading boxes I clipped every `xmax`/`ymax` back inside the image bounds, asserted that every lower bound was strictly below its upper bound (degenerate boxes crash the pipeline downstream), and kept box-less images as legitimate background rather than discarding them. None of that is exciting. All of it is the difference between a run that trains and a run that throws at epoch three.

:::professor[Focal loss and the detector objective]
**Focal loss, and why it fits this data.** RetinaNet's classification head replaces cross-entropy with focal loss, which multiplies the standard log-loss by a modulating factor $(1 - p_t)^\gamma$ that decays as a prediction becomes confident and correct:

$$
\mathrm{FL}(p_t) = -\,\alpha\,(1 - p_t)^{\gamma}\,\log(p_t),
\qquad
p_t = \begin{cases} p & y = 1 \\ 1 - p & y = 0 \end{cases}
$$

With the focusing parameter $\gamma > 0$, an easy background anchor at $p_t \approx 0.99$ contributes almost nothing to the gradient, so the loss is dominated by the hard, informative examples instead of the tens of thousands of trivial negatives a dense detector proposes. The paper writes it split by label (its Eqs. 2–3, with a class-balancing $\alpha$/$\beta$), and the full detector objective is the usual classification + localization sum:

$$
L(\{p_i\},\{t_i\}) = \frac{1}{N_{cls}}\sum_i L_{cls}(p_i, p_i^{*})
\;+\; \lambda\,\frac{1}{N_{reg}}\sum_i p_i^{*}\,L_{reg}(t_i, t_i^{*})
$$

where $p_i^{*}\in\{0,1\}$ gates the regression term so only positive anchors are penalized on box coordinates, $N_{cls}$/$N_{reg}$ are the anchor normalizers, and $\lambda$ balances the two. This is not a decorative choice: RBC ≫ WBC ≫ Platelet is exactly the foreground/background and class imbalance $\gamma$ exists to tame.
:::

## An augmentation is a claim about invariance

Here is the mental model I wish I'd started with.

When you add an augmentation, you are generating new training examples by transforming existing ones and **keeping the same label**. That "keeping the same label" is not free — it is an assertion. You are telling the model: *this transformation does not change the answer.* In the language of learning theory, you are declaring an **invariance**, and the model will dutifully learn to be invariant to exactly the thing you augmented over.

![Every augmentation asserts an invariance: a flip or rotation keeps a blood cell's label, but a hue shift erases the stain signal that defines the cell type — a false invariance you must never train into the model.](/figures/research-blood-invariance.svg)

So the design question is not "which augmentations should I turn on to be safe?" It is a modeling question: **which transformations genuinely leave my labels unchanged, and which ones destroy signal?** Turn on the right ones and you inject true prior knowledge — free robustness, exactly as advertised. Turn on the wrong ones and you inject a *false* invariance: you actively teach the model to ignore a feature that carries the answer. That's not a missed optimization. It's damage.

The reason this is easy to get wrong is that on natural-image benchmarks — ImageNet, COCO — the standard augmentation bundle is genuinely safe. A cat is a cat under a hue shift; a slightly bluer or warmer photo of a dog is still a dog. So we learn the bundle as a checkbox and carry it, unexamined, into domains where the assumptions no longer hold. Microscopy is one of those domains.

## Which invariances are real for blood cells

I worked through the transformations one at a time, and the answers split cleanly.

**Flips — valid.** A microscope has no canonical left or right. A red cell mirrored horizontally is still a red cell in the same place. The label survives the transform exactly, so a horizontal (or vertical) flip is a true invariance. I used it.

**Rotations — valid.** Same logic, stronger. There is no "up" in a smear; the slide's orientation under the objective is arbitrary. Rotating the field by any angle produces an image that could have genuinely occurred. Rotation is one of the most honest augmentations available for this data, and it multiplies the effective size of a tiny dataset without lying. I used it.

**Color and brightness shifts — not valid, and this is the whole lesson.** Stains are the entire point of a blood smear. The dyes bind differently to different cell components, and *that differential color uptake is how you tell the cell types apart* — the deep purple nucleus of a white cell against the pale pink of red cells is a color signal, not decoration. Jitter the hue and you don't produce a plausible new slide; you produce a slide where the diagnostic signal has been corrupted. Worse, by holding the label fixed across that corruption, you'd be training the model to treat stain color as irrelevant — sanding off the exact feature it most needs. So I dropped color augmentation entirely. This is the decision the abstract of the paper leads with, and it's the one I'd defend hardest.

**Scale — the subtle one.** You can't reason about scale as casually as flips. Cell *size* is diagnostic: relative dimensions help separate the classes and, in the wider clinical picture, abnormal sizing is itself a finding. Naive aggressive scale jitter risks telling the model that a cell's size doesn't matter, which — like color — is false for this domain. The resize to a fixed 640×640 is a controlled, uniform normalization applied to every image, not a randomized claim that any magnification is equivalent. The distinction I care about is exactly this: a deterministic preprocessing resize is not the same act as randomized scale augmentation, and only the second one makes an invariance claim to the model.

Notice the shape of the reasoning. For each transform I asked one question — *does the true label survive this?* — and the answer came from the biology of the data, not from a defaults list. Flip and rotate survive because orientation is meaningless here. Color does not survive because color is meaning here. That is what it means to treat augmentation as a modeling decision.

:::professor[The exact augmentation policy and hyperparameters]
**The exact policy, and a candid note on the paper's inconsistency.** What the training loop actually applied: a deterministic **resize to 640×640** on every image, plus **random horizontal/vertical flips and random rotations** as the only *randomized* augmentations. Color, hue, saturation, and brightness transforms were deliberately excluded. In the interest of not overselling my own paper: the prose is not perfectly self-consistent about this — the abstract mentions "blurring, flipping, and rotating," and the methodology section lists "rotation, flipping, and brightness adjustments" one sentence before warning against color augmentation. The Training Details section is the ground truth of what ran: **"data augmentation techniques included random flips and rotations."** So flips + rotations is the policy; the stray mentions of blurring and brightness are draft residue, and I'd rather flag that than let a reader assume a cleaner story than the record supports.

| Setting | Value |
|---|---|
| Backbone / neck | ResNet + FPN (Torchvision RetinaNet, pretrained) |
| Head modification | classification head → 3 classes (RBC, WBC, Platelet) |
| Input resolution | 640 × 640 |
| Randomized augmentation | random flips + rotations only (no color/brightness) |
| Batch size | 4 (VRAM-bound) |
| Epochs | 40 |
| Learning rate | 0.001, constant (no schedule) |
| Loss | focal classification + smooth-L1 box regression |
| Framework | PyTorch, Torchvision, OpenCV, Torchmetrics |
| Hardware | RTX 3050 Ti, 4 GB VRAM; AMD CPU @ 3.70 GHz; Windows |
:::

## What the model actually scored

The fine-tuned detector reached **mAP 0.876 at IoU 0.5** on the held-out test set, and **55.25% mAP at the stricter IoU 0.50:0.95** sweep — the averaged-over-thresholds metric that penalizes loose boxes. During training the best validation mAP at 0.50:0.95 landed around 58%, so the test number is consistent with what I saw in the loop rather than a lucky split. Table I in the paper also reports 88% accuracy at IoU 0.5. (In the interest of honesty: the write-up conflates the 88% and the 0.876 figures in one spot — a leftover from an early draft — which is one reason I keep the PDF available on request rather than treating it as polished.)

I also put it next to specialized detectors on the same benchmark, and I did not fudge the comparison.

![Fine-tuned RetinaNet lands at mAP 0.876 — close to purpose-built YOLO variants (0.896–0.927) but not ahead of them — from pretrained weights on a 4 GB laptop.](/figures/research-blood-metrics.svg)

The honest read: the fine-tuned RetinaNet **did not beat** the purpose-built YOLO variants — CST-YOLO in particular sits well ahead at 0.927. But it lands close, without architecture surgery, from pretrained weights, on a 4 GB laptop. Given that the whole premise was "how far does careful fine-tuning go under real constraints," landing within a few points of models designed specifically for this task is the result I wanted to be able to state plainly.

:::professor[Detection metric math and the real results tables]
**How the detection metrics are defined.** A prediction is scored against ground truth by **Intersection over Union** — the overlap of the two boxes divided by their union:

$$
\mathrm{IoU}(B_p, B_{gt}) = \frac{|B_p \cap B_{gt}|}{|B_p \cup B_{gt}|}
= \frac{\text{Area of Overlap}}{\text{Area of Union}}
$$

Fix a threshold $\tau$. A detection is a **true positive** if its class matches and $\mathrm{IoU} \geq \tau$ with an unclaimed ground-truth box (the best-matching one); extra boxes onto the same target are duplicates and count as **false positives**; unmatched ground truth is a **false negative**. From those counts,

$$
\text{Precision} = \frac{TP}{TP + FP},
\qquad
\text{Recall} = \frac{TP}{TP + FN}.
$$

Sweeping the confidence threshold traces a precision–recall curve; **average precision** is the area under it, and **mean average precision** averages AP over the classes:

$$
\mathrm{AP} = \int_0^1 p(r)\,dr,
\qquad
\mathrm{mAP} = \frac{1}{n}\sum_{i=1}^{n}\mathrm{AP}_i .
$$

"mAP@0.5" fixes $\tau = 0.5$ (the PASCAL-VOC convention); "mAP@0.50:0.95" averages the whole thing again over $\tau \in \{0.50, 0.55, \dots, 0.95\}$ (the stricter COCO convention), which is why it is always the smaller, more honest number.

**Real results (test set), and an important caveat.** The paper reports **aggregate** metrics only — there is no per-class AP/precision/recall table in it, so I will not invent one here. What is genuinely reported:

| Metric | Value |
|---|---|
| mAP @ IoU 0.5 | **0.876** |
| Accuracy @ IoU 0.5 | 88% |
| mAP @ IoU 0.50:0.95 | 55.25% |
| Best validation mAP @ 0.50:0.95 | ≈ 58% |

| Method | mAP @ IoU 0.5 |
|---|---|
| **Our modified RetinaNet** | **0.876** |
| YOLOv5x | 0.923 |
| YOLOv7 | 0.896 |
| CST-YOLO | 0.927 |

The gap to CST-YOLO (0.927) is real and I don't paper over it; the point of the number is that careful fine-tuning under a 4 GB constraint lands within a few points of task-specific architectures.
:::

## Honest limits, and what I'd change

**Red cells are still the weak spot.** The class that dominates the field is the one the model detects least reliably — RBCs are numerous, overlapping, and often clumped, so boxes merge and get missed. It's the failure mode most worth attacking next, and it's inherent to the density that made focal loss the right choice in the first place.

**Staining and image quality generalize poorly.** The model's performance varies with the smear's stain and capture quality, and BCCD is one dataset from presumably one acquisition regime. A model this small, trained on 364 images, has not seen enough variation to be robust to a different lab's stain protocol. Which is a slightly delicious tension with the whole augmentation argument: I refused *synthetic* color augmentation because it corrupts signal — but the right answer to stain robustness isn't fake hue jitter, it's *real* images from multiple staining protocols. The invariance you want (robustness to stain vendor) and the invariance you must not fake (color carries no information) are different claims, and only real data distinguishes them.

**Things I'd change with more room:** add a learning-rate schedule after epoch 30 — the loss curve fluctuated more than I'd like and a decay would likely have smoothed the late training and nudged the ceiling up; push the input resolution and batch size on a bigger GPU; and, most of all, treat the augmentation policy as something to *ablate* rather than assert. I reasoned my way to no-color from domain knowledge, and I still believe the reasoning — but the rigorous version of this project runs the experiment both ways and shows the color-augmented model measurably worse, turning a well-argued prior into a measured result.

:::professor[Failure modes, read against the biology]
**Failure modes, read against the biology.** Three interact, and none is incidental:

- **Overlapping / clumped RBCs.** At the densities BCCD shows, red cells touch and stack. Anchor-based detection resolves neighboring instances through non-max suppression on IoU, which is exactly the operation that struggles when true instances *legitimately* overlap — merge two touching cells into one box and you've traded a false positive for a false negative with no threshold that fixes both. This is the dominant error source and it is worst on the majority class.
- **Class imbalance (RBC ≫ WBC ≫ Platelet).** Focal loss addresses the *gradient* imbalance during training, but it does not manufacture data. Platelets are both rare *and* tiny — few positive anchors ever fire on them — so their AP is the most fragile and the most sensitive to the IoU threshold, since a small box loses IoU fast under a few pixels of localization error.
- **Stain / acquisition shift.** Because I (correctly) refused synthetic color augmentation, the model's color prior is pinned to BCCD's staining protocol. Under a different lab's stain or camera, the very signal the model relies on (differential dye uptake) shifts distribution — and the only sound fix is more *real* protocols in the training set, not fabricated hue jitter, which would corrupt the signal it's trying to generalize.

The training curve is consistent with all this: loss at IoU 0.50:0.95 fluctuated notably through 40 epochs with no LR decay, and the best validation mAP (≈ 0.58) sat just above the test 0.5525 — no schedule, no early-stopping tuning, a deliberately unpolished baseline.
:::

## The transferable part

The metrics on this project will age. The lesson hasn't. Every time I've reached for augmentation since — and it comes up constantly in production vision work — I run the same check before enabling anything: *for each transform, does the true label survive it?* If yes, it's free knowledge worth injecting. If no, it's a false invariance I'd be training the model to believe. The checkbox mentality skips that question entirely, and on natural images it gets away with it. On blood cells, on medical imaging, on any domain where a pixel's *color or scale is the diagnosis*, skipping the question is how you quietly teach your model something false.

Augmentation isn't preprocessing. It's modeling. Treat it that way.

Full paper, methodology, and the comparison table: [/research/blood-cell-detection](/research/blood-cell-detection).
