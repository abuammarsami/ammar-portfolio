---
title: "Counting Blood Cells: Why Data Augmentation Is a Modeling Decision, Not a Checkbox"
series: ml-research
order: 4
summary: "An object detector for blood-cell microscopy — and the lesson that cost me the most to learn: an augmentation is a claim about which transformations leave the label unchanged. Get the invariances wrong and you teach the model something false."
readingMinutes: 11
date: 2026-07
tags: [computer-vision, object-detection, data-augmentation, medical-imaging, research, deep-learning]
status: active
---

## The one decision I keep coming back to

Most of what I did on this project was ordinary. I took a pretrained object detector, swapped its classification head to predict three classes instead of eighty, pointed it at a microscopy dataset, and trained it on a 4 GB laptop GPU. The metrics came out respectable — **mAP 0.876 at IoU 0.5** on the test split. None of that is the part I think about.

The part I think about is a decision I made *not* to do something. I did not apply color augmentation. Not brightness jitter, not hue shift, not saturation warping — none of the transformations that every "data augmentation for image classification" tutorial hands you as a default. And the reason is the whole point of this write-up:

> A blood cell's color *is* the label. Stain uptake is exactly what a hematologist reads to tell a white cell from a red one. If I jitter the hue during training, I am telling the model "the answer doesn't change when the color changes" — which, for this data, is a lie.

That sentence took me longer to arrive at than it should have, because I'd internalized augmentation as a preprocessing step you turn on to get free robustness. It isn't. Every augmentation you enable is a claim about your data. This is the story of the model, and of learning to read that claim before flipping the switch.

## The task: three cell types, one crowded field

The clinical problem is counting. A complete blood count — how many red cells, white cells, and platelets are in a sample, and in what proportions — drives a huge fraction of everyday diagnosis, from anemia to infection to clotting disorders. Traditionally a trained technician does this by eye under a microscope. It is slow, tiring, subjective work, and the throughput of a lab is bounded by it.

So the task is object detection: draw a box around every cell in a smear image and label it as one of three classes — **Red Blood Cell (RBC)**, **White Blood Cell (WBC)**, or **Platelet**. I used the **BCCD dataset** (Blood Cell Count and Detection), a well-established public benchmark of stained microscopy images annotated in Pascal VOC format. It is small: **364 images with 4,888 annotations total**, split **255 train / 73 validation / 36 test**. I deliberately took the *raw* VOC version — the one that does *not* ship with pre-augmented images — because I wanted to own the augmentation policy myself rather than inherit someone else's assumptions baked into the files.

One property of this data matters more than its size, and it shows up again later: the classes are wildly imbalanced. A single field is carpeted with red cells; white cells and platelets appear a handful at a time. That imbalance is not a nuisance to be normalized away — it is the biology, and it shapes both the loss function and the augmentation policy.

## The detector: RetinaNet, and why single-stage

I used **RetinaNet** from Torchvision — a **ResNet backbone, a Feature Pyramid Network (FPN), and a focal-loss classification head** — fine-tuned from pretrained weights. A few of these choices are load-bearing, so I'll be specific.

**Single-stage, on purpose.** Two-stage detectors like Faster R-CNN tend to score higher on crowded scenes, but they're heavier and slower. RetinaNet is a one-stage detector that closed most of that accuracy gap, and the reason it could is directly relevant here: **focal loss**. In a dense detection setting, the overwhelming majority of candidate anchor boxes are easy background. Standard cross-entropy lets that sea of easy negatives dominate the gradient. Focal loss down-weights well-classified examples so the model spends its learning budget on the hard cases. A microscopy field packed with hundreds of red cells and a few small platelets is precisely the extreme-imbalance regime focal loss was built for — so the architecture and the data are a genuine match, not a default I reached for.

**Transfer learning, not from scratch.** With only 364 images, training a detector from random initialization would be hopeless. I initialized from pretrained weights so the backbone already knew edges, blobs, and textures, and modified only the classification head to output three classes. The whole exercise was: how far can careful fine-tuning of an off-the-shelf detector go, on modest hardware, without architecture surgery?

**Modest hardware, stated honestly.** Everything ran on an **NVIDIA RTX 3050 Ti with 4 GB of VRAM** and an AMD CPU at 3.70 GHz, under Windows, in PyTorch with Torchvision and Torchmetrics. Training config: images resized to **640×640**, **batch size 4**, **40 epochs**, **learning rate 0.001**. Batch size 4 is not a research choice; it's what fits in 4 GB. I mention it because the constraint is part of the honesty — this was a proving ground, not a leaderboard entry.

There was also unglamorous but essential label hygiene in preprocessing: after loading boxes I clipped every `xmax`/`ymax` back inside the image bounds, asserted that every lower bound was strictly below its upper bound (degenerate boxes crash the pipeline downstream), and kept box-less images as legitimate background rather than discarding them. None of that is exciting. All of it is the difference between a run that trains and a run that throws at epoch three.

## An augmentation is a claim about invariance

Here is the mental model I wish I'd started with.

When you add an augmentation, you are generating new training examples by transforming existing ones and **keeping the same label**. That "keeping the same label" is not free — it is an assertion. You are telling the model: *this transformation does not change the answer.* In the language of learning theory, you are declaring an **invariance**, and the model will dutifully learn to be invariant to exactly the thing you augmented over.

![Augmentation as a claim about invariance — a horizontal flip keeps a blood cell's label, but a hue shift can erase the stain signal that defines the cell type; each augmentation you enable is a statement that this transformation must not change the answer.](/figures/research-blood-cell.svg)

So the design question is not "which augmentations should I turn on to be safe?" It is a modeling question: **which transformations genuinely leave my labels unchanged, and which ones destroy signal?** Turn on the right ones and you inject true prior knowledge — free robustness, exactly as advertised. Turn on the wrong ones and you inject a *false* invariance: you actively teach the model to ignore a feature that carries the answer. That's not a missed optimization. It's damage.

The reason this is easy to get wrong is that on natural-image benchmarks — ImageNet, COCO — the standard augmentation bundle is genuinely safe. A cat is a cat under a hue shift; a slightly bluer or warmer photo of a dog is still a dog. So we learn the bundle as a checkbox and carry it, unexamined, into domains where the assumptions no longer hold. Microscopy is one of those domains.

## Which invariances are real for blood cells

I worked through the transformations one at a time, and the answers split cleanly.

**Flips — valid.** A microscope has no canonical left or right. A red cell mirrored horizontally is still a red cell in the same place. The label survives the transform exactly, so a horizontal (or vertical) flip is a true invariance. I used it.

**Rotations — valid.** Same logic, stronger. There is no "up" in a smear; the slide's orientation under the objective is arbitrary. Rotating the field by any angle produces an image that could have genuinely occurred. Rotation is one of the most honest augmentations available for this data, and it multiplies the effective size of a tiny dataset without lying. I used it.

**Color and brightness shifts — not valid, and this is the whole lesson.** Stains are the entire point of a blood smear. The dyes bind differently to different cell components, and *that differential color uptake is how you tell the cell types apart* — the deep purple nucleus of a white cell against the pale pink of red cells is a color signal, not decoration. Jitter the hue and you don't produce a plausible new slide; you produce a slide where the diagnostic signal has been corrupted. Worse, by holding the label fixed across that corruption, you'd be training the model to treat stain color as irrelevant — sanding off the exact feature it most needs. So I dropped color augmentation entirely. This is the decision the abstract of the paper leads with, and it's the one I'd defend hardest.

**Scale — the subtle one.** You can't reason about scale as casually as flips. Cell *size* is diagnostic: relative dimensions help separate the classes and, in the wider clinical picture, abnormal sizing is itself a finding. Naive aggressive scale jitter risks telling the model that a cell's size doesn't matter, which — like color — is false for this domain. The resize to a fixed 640×640 is a controlled, uniform normalization applied to every image, not a randomized claim that any magnification is equivalent. The distinction I care about is exactly this: a deterministic preprocessing resize is not the same act as randomized scale augmentation, and only the second one makes an invariance claim to the model.

Notice the shape of the reasoning. For each transform I asked one question — *does the true label survive this?* — and the answer came from the biology of the data, not from a defaults list. Flip and rotate survive because orientation is meaningless here. Color does not survive because color is meaning here. That is what it means to treat augmentation as a modeling decision.

## What the model actually scored

The fine-tuned detector reached **mAP 0.876 at IoU 0.5** on the held-out test set, and **55.25% mAP at the stricter IoU 0.50:0.95** sweep — the averaged-over-thresholds metric that penalizes loose boxes. During training the best validation mAP at 0.50:0.95 landed around 58%, so the test number is consistent with what I saw in the loop rather than a lucky split. Table I in the paper also reports 88% accuracy at IoU 0.5. (In the interest of honesty: the write-up conflates the 88% and the 0.876 figures in one spot — a leftover from an early draft — which is one reason I keep the PDF available on request rather than treating it as polished.)

I also put it next to specialized detectors on the same benchmark, and I did not fudge the comparison:

| Method | mAP @ IoU 0.5 |
|---|---|
| **Our modified RetinaNet** | **0.876** |
| YOLOv5x | 0.923 |
| YOLOv7 | 0.896 |
| CST-YOLO | 0.927 |

The honest read: the fine-tuned RetinaNet **did not beat** the purpose-built YOLO variants — CST-YOLO in particular sits well ahead at 0.927. But it lands close, without architecture surgery, from pretrained weights, on a 4 GB laptop. Given that the whole premise was "how far does careful fine-tuning go under real constraints," landing within a few points of models designed specifically for this task is the result I wanted to be able to state plainly.

## Honest limits, and what I'd change

**Red cells are still the weak spot.** The class that dominates the field is the one the model detects least reliably — RBCs are numerous, overlapping, and often clumped, so boxes merge and get missed. It's the failure mode most worth attacking next, and it's inherent to the density that made focal loss the right choice in the first place.

**Staining and image quality generalize poorly.** The model's performance varies with the smear's stain and capture quality, and BCCD is one dataset from presumably one acquisition regime. A model this small, trained on 364 images, has not seen enough variation to be robust to a different lab's stain protocol. Which is a slightly delicious tension with the whole augmentation argument: I refused *synthetic* color augmentation because it corrupts signal — but the right answer to stain robustness isn't fake hue jitter, it's *real* images from multiple staining protocols. The invariance you want (robustness to stain vendor) and the invariance you must not fake (color carries no information) are different claims, and only real data distinguishes them.

**Things I'd change with more room:** add a learning-rate schedule after epoch 30 — the loss curve fluctuated more than I'd like and a decay would likely have smoothed the late training and nudged the ceiling up; push the input resolution and batch size on a bigger GPU; and, most of all, treat the augmentation policy as something to *ablate* rather than assert. I reasoned my way to no-color from domain knowledge, and I still believe the reasoning — but the rigorous version of this project runs the experiment both ways and shows the color-augmented model measurably worse, turning a well-argued prior into a measured result.

## The transferable part

The metrics on this project will age. The lesson hasn't. Every time I've reached for augmentation since — and it comes up constantly in production vision work — I run the same check before enabling anything: *for each transform, does the true label survive it?* If yes, it's free knowledge worth injecting. If no, it's a false invariance I'd be training the model to believe. The checkbox mentality skips that question entirely, and on natural images it gets away with it. On blood cells, on medical imaging, on any domain where a pixel's *color or scale is the diagnosis*, skipping the question is how you quietly teach your model something false.

Augmentation isn't preprocessing. It's modeling. Treat it that way.

Full paper, methodology, and the comparison table: [/research/blood-cell-detection](/research/blood-cell-detection).
