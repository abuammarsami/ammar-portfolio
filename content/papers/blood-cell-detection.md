---
title: "Deep Learning-Based Blood Cell Detection in Microscopic Images for Enhanced Disease Recognition with RetinaNet"
authors: [Md. Abu Ammar, Sadia Afrin Tamanna]
venue: "Graduate coursework (CSE583, Digital Image Processing), North South University"
year: 2023
kind: report
supervisor: null
pdf: false
tags: [computer-vision, object-detection, retinanet, medical-imaging, transfer-learning]
related:
  project: null
  lesson: null
  writeup: blood-cell-detection
featured: false
status: active
---

# Blood Cell Detection in Microscopic Images with RetinaNet

**Abstract:** I fine-tuned a pretrained RetinaNet (ResNet backbone, feature
pyramid network, focal-loss classification head) on the BCCD microscopy dataset
to detect red blood cells, white blood cells, and platelets — 364 images,
4,888 annotations, three classes, split 255/73/36 train/val/test. Only the
classification head was modified, from 80 classes to 3; everything else
transferred from pretrained weights. The detector reached **mAP 0.876 at IoU
0.5** and **55.25% at IoU 0.50:0.95** on the held-out test split, running
entirely on a 4 GB laptop GPU. The technical result is ordinary; the argument
the paper builds around one omitted augmentation is the part worth reading.

**In plain words:** A complete blood count — how many red cells, white cells,
and platelets are in a sample — drives a large share of everyday diagnosis,
from anemia to infection to clotting disorders, and a technician still does it
by eye under a microscope: slow, tiring, subjective work that bounds a lab's
throughput. This project teaches an off-the-shelf object detector to draw a box
around every cell in a smear and label its type. The most consequential decision
was what I chose *not* to do: no color, hue, brightness, or saturation
augmentation during training. A blood cell's stain color *is* the label — the
deep purple of a white cell's nucleus against the pale pink of red cells is
exactly what a hematologist reads. Jitter the hue while holding the label fixed
and you don't create a plausible new slide; you teach the model that the
diagnostic signal is irrelevant. The full story of that reasoning lives in
[the writeup](/deep-dives/blood-cell-detection).

**Method:** Torchvision RetinaNet, chosen deliberately as a single-stage
detector: its focal-loss head down-weights the sea of easy background anchors so
learning concentrates on hard cases, which is a genuine match for a microscopy
field carpeted with hundreds of red cells against a handful of platelets — the
extreme foreground/background and class imbalance (RBC ≫ WBC ≫ Platelet) that
focal loss exists to tame. I took the *raw* BCCD in Pascal VOC format rather
than a pre-augmented copy, precisely so I owned the augmentation policy instead
of inheriting someone else's assumptions. Preprocessing: resize to 640×640, clip
every box back inside image bounds, assert each lower bound strictly below its
upper bound (degenerate boxes crash the pipeline), and keep box-less images as
legitimate background. The only *randomized* augmentations were flips and
rotations — both true invariances here, since a smear has no canonical left/right
or up. Training config: 40 epochs, batch size 4 (VRAM-bound, not a research
choice), learning rate 0.001 with no schedule, on an NVIDIA RTX 3050 Ti with
4 GB of VRAM. The premise was narrow and honest: how far does careful
fine-tuning of a stock detector go, on modest hardware, without architecture
surgery?

**Results:** mAP **0.876 @ IoU 0.5** and **55.25% @ 0.50:0.95** on test, with
Table I also reporting 88% accuracy at IoU 0.5. During training the best
validation mAP at 0.50:0.95 landed around 58%, so the test number tracks what I
saw in the loop rather than a lucky split. Set honestly against purpose-built
detectors on the same benchmark, the fine-tuned RetinaNet **did not win** —
YOLOv7 reaches 0.896, YOLOv5x 0.923, and CST-YOLO 0.927 @ IoU 0.5, a gap I
don't paper over. What it did was land within a few points of task-specific
architectures from pretrained weights on a 4 GB laptop, which is exactly the
claim the premise set up. The honest limits are real too: red cells — the
majority class — are the weak spot, because at BCCD's densities they overlap and
clump and non-max suppression merges touching instances; and the model's color
prior is pinned to BCCD's one staining protocol, so it generalizes poorly to a
different lab's stain. The right fix there is *real* images from more protocols,
not synthetic hue jitter — a different invariance claim entirely.

**Looking back:** This was my proving ground for treating augmentation as a
modeling decision, not a preprocessing checkbox — the "for each transform, does
the true label survive it?" question I now run before enabling anything in
production vision work, including validating vision models for kiosk monitoring
at my job. What I'd change with more room: a learning-rate decay after epoch 30
to smooth the fluctuating late-training loss, more resolution and batch size on
a bigger GPU, and — most of all — *ablating* the no-color policy rather than
asserting it, running the color-augmented model as a measured control instead of
a well-argued prior. One caveat kept me honest about the writeup itself: the
prose has draft residue — the abstract and methodology mention blurring and
brightness augmentations that the Training Details section (the ground truth:
"random flips and rotations") contradicts, and one spot conflates the 88% and
0.876 figures. Because of those leftovers I keep the PDF available on request
rather than treating it as polished.
