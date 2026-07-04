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
featured: false
status: active
---

# Blood Cell Detection in Microscopic Images with RetinaNet

**Abstract:** Fine-tuning a pretrained RetinaNet (ResNet backbone + feature
pyramid network, focal loss) on the BCCD microscopy dataset to detect red
blood cells, white blood cells, and platelets — 364 images, 4,888 annotations,
three classes — reaching **mAP 0.876 at IoU 0.5** and **55.25% at IoU
0.50:0.95** on the test split.

**In plain words:** Counting blood cells under a microscope is slow, tiring,
expert work, and diagnosis depends on it. This project teaches an off-the-shelf
object detector to draw boxes around every red cell, white cell, and platelet
in a slide image. The most consequential decision was what *not* to do: no
color augmentation during training, because a blood cell's color *is*
diagnostic information — blur or hue-shift it and you've destroyed the very
signal a hematologist reads.

**Method:** Torchvision RetinaNet with a modified classification head for
3 classes; transfer learning from pretrained weights. BCCD (Pascal VOC
format), 255/73/36 train/val/test, resized to 640×640 with bounding-box
sanity-clipping; augmentation restricted to flips and rotations. Trained
40 epochs, batch size 4, lr 0.001, on a 4 GB RTX 3050 Ti — a deliberately
modest hardware budget.

**Results:** mAP **0.876 @ IoU 0.5** and **55.25% @ 0.50:0.95** on test.
Honest comparison: specialized YOLO variants do better on BCCD (YOLOv5x 0.923,
CST-YOLO 0.927 @ 0.5) — the fine-tuned single-stage RetinaNet gets close
without architecture surgery, which was the point of the exercise.

**Looking back:** This was my proving ground for domain-aware augmentation
policy — the same "know which invariances are real" reasoning I now apply
when validating vision models for kiosk monitoring at work. The write-up
itself has a contradictory sentence left from an early draft, so the PDF is
available on request rather than posted.
