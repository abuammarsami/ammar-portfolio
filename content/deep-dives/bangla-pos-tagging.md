---
title: "Tagging Bangla Parts of Speech: Which Layer of BERT Knows Grammar?"
series: ml-research
order: 2
summary: "The real, messier story behind a Bangla POS tagger: probing a pretrained Bengali BERT layer by layer to find where part-of-speech actually lives, then using knowledge distillation — an inverted setup where a decision-tree teacher guides a neural student — to fight severe class imbalance."
readingMinutes: 12
date: 2026-07
tags: [nlp, bangla, knowledge-distillation, pos-tagging, research, deep-learning]
status: active
---

In my final year at North South University, my partner Sadia and I set out to build a part-of-speech tagger for Bangla. Simple enough on paper: label every word in a sentence with its grammatical role — noun, verb, postposition, and so on. We had a benchmark dataset, three pretrained Bangla language models, and a plan.

The plan broke almost immediately, and the way it broke is the whole story. The dataset was so lopsided that our neural network learned to be confidently, uselessly good — it aced the common tags and quietly ignored the rare ones. A dumb little decision tree, the kind of model you're supposed to have outgrown by grad school, handled the rare tags *better*. That inversion is what sent us to knowledge distillation, and it's why this write-up isn't the textbook version of the technique. Let me rebuild the whole thing from the ground up.

## Why POS tagging is worth doing, and why Bangla makes it hard

A POS tag is a label on a token that marks its part of speech — and often more: tense, number, gender, case. Once you have those labels, a lot of downstream NLP gets easier. Named-entity recognition, question answering, grammar correction, sentiment analysis — they all lean on knowing the syntactic role of each word. So a good tagger is a piece of foundational infrastructure, not an end in itself.

The catch is that all the recent progress in tagging has come from neural methods, and neural methods are hungry for large, well-annotated corpora. Those corpora exist for English. They mostly don't exist for the world's low-resource languages — and Bangla, despite being the seventh most-spoken language on the planet, is one of them. There has been comparatively little progress here precisely because the data isn't there.

Bangla is also just structurally hard. It's morphologically rich, so a single root spawns many surface forms, and the same word can carry different grammatical roles in different contexts. That last property — one word, many meanings — turns out to matter a lot later, when we start asking *which* internal layer of a language model actually understands context.

## The data: one benchmark, brutally imbalanced

There is effectively one publicly usable POS dataset for academic Bangla work: the **Indian Language Part-of-Speech Tagset (IL-POST) for Bengali**, from Microsoft Research India. That's what we used, because it's the only thing you *can* use for benchmarking.

The numbers: **7,168 sentences** carrying **102,933 hand-annotated tags**. The tagset has several annotation levels; we used the first level — the universal lexical categories — which gives **32 tags**. The dataset ships with no standard train/test/validation split, so following prior work we split at the sentence level in a **60:20:20** ratio, deliberately making sure every class appeared in all three partitions.

Then we hit the wall. The class distribution is savage. The most frequent tag, **NC (Common Noun), is about 31% of all tokens** — more than twice as common as the second-place tag, VM (Main Verb). The long tail of rare tags — foreign-word residuals, various demonstratives, reciprocal pronouns — each sits at a fraction of a percent. We also merged two auxiliary-verb tags (VA into VAUX), since they denote the same thing and VA was rare, which took the **32 tags down to 30**.

Here's why that imbalance is a *modeling* problem and not just a cosmetic one. If a classifier just predicts NC for everything remotely noun-shaped, it can post a respectable-looking accuracy while being blind to most of the tagset. Worse, when your test set is skewed the same way as your training set, that blindness gets *hidden* — accuracy inflates, and you fool yourself into thinking the model learned something it didn't. This is the trap the paper is really about.

## The teacher, the student, and where the embeddings come from

Every model in the project consumes the same input: a **768-dimensional contextual word embedding** pulled from a pretrained Bangla BERT. BERT gives you a vector per token that's shaped by the surrounding words — unlike Word2Vec or fastText, where a word has one fixed vector regardless of context. For a morphologically rich language where meaning shifts with position, that context-sensitivity is exactly what you want.

We tried three BERT models: **BERT-Multilingual (cased)**, **Sagorsarker's bangla-bert-base**, and **Kowsher's Bangla-BERT**. Each has 12 hidden layers, and — this is a point most people skip — *every one of those 12 layers emits its own embedding*. They are not interchangeable. Some layers hold more static, dictionary-like meaning; some hold more contextual, this-sentence meaning.

To find out which layer understood context best, we built a small custom probe: **30 pairs of Bangla sentences, where each pair uses the same word with two different meanings.** For each pair we measured the cosine similarity of the target word's embedding across the two sentences, layer by layer. The logic: if a layer truly encodes context, it should give the *same* word *different* vectors when the meaning differs — so **low** cosine similarity is the good outcome. A layer that returns nearly identical vectors for both senses is just parroting a static representation.

The result was a clean, monotonic-ish decline: cosine similarity was highest in the early layers (around 0.90+ at layer 1–2) and lowest in the deep layers. So we picked, per model, a best / average / worst layer to carry forward:

| BERT model | Best layer | Average layer | Worst layer | Word embeddings extracted |
|---|---|---|---|---|
| BERT-Multilingual | 12 | 7 | 1 | 92,522 |
| Sagorsarker Bangla-BERT | 12 | 7 | 1 | 94,717 |
| Kowsher Bangla-BERT | 11 | 6 | 1 | 94,717 |

One small finding I still like: for Kowsher, the best layer was **11, not 12**. The last layer is not always the most semantic — a reminder that "just take the final hidden state" is a habit, not a law. (The multilingual model also yields fewer usable embeddings — 92,522 vs 94,717 — because it fragments more Bangla words into sub-word pieces and drops more unknowns.)

With embeddings in hand, we trained two very different models on them:

- **A decision tree** (scikit-learn), and
- **A dense neural network** (PyTorch): a single hidden layer, `768 → 2048 → 30` with ReLU and dropout. Small. A couple of linear layers.

Now the part where the textbook and reality part ways.

## Knowledge distillation from first principles

The canonical framing of knowledge distillation goes like this. You have a big, accurate, expensive **teacher** model. You want a small, cheap **student** that you can actually deploy. So instead of training the student only on the ground-truth labels, you train it to mimic the teacher's *output probability distribution*.

![Knowledge distillation — a large teacher tagger's softened output distribution (not just the hard label) becomes the training signal for a much smaller student, transferring the teacher's uncertainty and letting the student punch above its size.](/figures/research-bangla-pos.svg)

Why does mimicking a distribution beat learning from labels? Because a hard label throws almost everything away. "This word is a Common Noun" is a one-hot vector: 1 on NC, 0 on all 29 other tags. But a well-trained teacher doesn't output one-hot — it outputs something like *"85% Common Noun, 10% Proper Noun, 3% Verbal Noun, ..."*. That spread is the interesting part. It says NC and NP are easy to confuse, and NC and, say, Punctuation are not. Geoffrey Hinton's team called this the **dark knowledge** — the relative probabilities of the *wrong* answers encode how the teacher sees the structure of the problem. A hard label has none of it.

Two knobs make this work, and both are in our actual loss function:

- **Temperature (`T`).** You divide the logits by `T` before the softmax. At `T = 1` you get the normal, peaky distribution. Crank `T` up and the distribution softens — those small 3% and 10% probabilities swell into a clearer signal the student can actually learn from. Temperature is the volume knob on the dark knowledge.
- **Alpha (`α`).** The student learns from two things at once: the soft teacher targets *and* the real hard labels. Alpha weights the blend.

Here is the distillation loss exactly as we wrote it — a KL-divergence between the softened student and teacher distributions, plus an ordinary cross-entropy against the true tags:

```python
def loss_fn_kd(student_output, tags, teacher_output, alpha, temperature):
    T = temperature
    KD_loss = nn.KLDivLoss(reduction='batchmean', log_target=True)(
                  F.log_softmax(student_output / T, dim=1),
                  F.softmax(teacher_output / T, dim=1)
              ) * (alpha * T * T) \
              + F.cross_entropy(student_output, tags.long()) * (1. - alpha)
    return KD_loss
```

The `T * T` scaling on the distillation term is the standard correction — softening by `T` shrinks the gradients by `1/T²`, so you multiply back to keep the two loss terms on comparable footing. This is textbook Hinton, implemented faithfully.

## The twist: the decision tree is the teacher

Here's where our project stops being textbook. In the classic story the teacher is the big powerful model. In ours, **the teacher is the humble decision tree, and the student is the neural network.** We ran the distillation *backwards* — from the weaker, simpler model into the stronger, hungrier one.

Why on earth would you do that? Because of the imbalance. When we measured the two models honestly with **macro-F1** — which averages F1 across all 30 classes equally, so the rare tags count as much as NC — a pattern jumped out. The neural network scored higher overall, but it did so by feasting on the majority classes and starving the minority ones. The decision tree scored lower overall, yet its errors were spread *more evenly*; it was **less biased by the class imbalance.**

That reframes imbalance beautifully. It's not only a sampling problem you fix by oversampling the rare classes (the standard move, which we deliberately avoided because it invents data). It's a **knowledge-representation** problem. The decision tree's leaf nodes each hold a count of how many training words of each class landed there. Read that count as a probability distribution and you get exactly the soft, spread-out target that distillation wants — a teacher signal that hasn't collapsed onto NC. So we distilled the *tree's* leaf distributions into the neural network, hoping to hand the network the tree's more balanced judgment without giving up the network's raw capacity. Concretely, the teacher's `predict_proba` over each batch became the `teacher_output` in the loss above.

The training recipe for the student: **Adam, learning rate 0.01, weight decay 1e-5, up to 100 epochs with early stopping, batch size 124**, and — critically — **model selection by validation macro-F1**, not accuracy. When your whole problem is the minority classes, you must not let accuracy pick your model.

## Results: what each model actually scored

Two clean results, plus one honest gap.

**The neural network alone** (the student trained conventionally) topped out on Sagorsarker's layer 7:

| Model / layer | Test macro-F1 | Test accuracy |
|---|---|---|
| Sagorsarker, layer 7 | **0.69** | **0.79** |
| Sagorsarker, layer 12 | 0.69 | 0.78 |
| Kowsher, layer 11 | 0.65 | 0.78 |
| BERT-Multilingual, layer 12 | 0.56 | 0.69 |

**The decision-tree teacher** peaked much lower — its best was Sagorsarker's layer 1:

| Model / layer | Test macro-F1 | Test accuracy |
|---|---|---|
| Sagorsarker, layer 1 | **0.46** | **0.60** |
| Kowsher, layer 1 | 0.43 | 0.60 |
| BERT-Multilingual, layer 1 | 0.40 | 0.55 |

Put those two tables side by side and a genuinely interesting thing appears. **As you go deeper into BERT, the decision tree gets worse and the neural network gets better.** The tree loves the shallow, near-static layer-1 embeddings; by layer 12 it's collapsing (multilingual layer 12 falls to 0.18 macro-F1). The network is the opposite — it wants the deep, contextual layers where the tree drowns. They consume the same embedding geometry in opposite directions. That single observation was, to me, the most quietly important result of the whole project: the "best layer" isn't a property of the data, it's a property of the *model that eats it*.

Now the honest gap. The tables above are the two models measured *standalone* — the plain network and the plain tree. The full evaluation of the *distilled* student — the network trained through `loss_fn_kd` with the tree as teacher — was left unfinished when the semester ran out. The machinery is all there in the code and the method is complete, but I won't hand you a headline distilled number, because we never finished measuring it cleanly. For context, published work on this same dataset reports macro-F1 in the high 70s to 87 using CRFs with class weights or oversampling; our contribution was never meant to beat those on the leaderboard — it was to ask whether distillation is a viable third road. On that question the method stands; the final score doesn't.

## What worked, what didn't, and what I'd do next

**What worked.** Layer probing with the polysemy dataset was cheap and paid off — it stopped us from blindly grabbing the final layer and gave us the "different models want different layers" insight for free. And the core reframing — treating a decision tree's leaf counts as dark knowledge — is, I still think, a legitimately good idea. Class imbalance as a representation problem rather than a sampling problem is a lens I've reused since.

**What didn't.** We ran out of runway before the distilled student was fully evaluated, which is the kind of thing that's easy to hide in a results table and dishonest to hide. There's also an unresolved wrinkle worth naming: the paper's figures label the student a "CNN," but the code that ran is a dense feed-forward network. The idea traveled faster than the implementation caught up — a normal hazard of a two-person directed study, but one I'd flag rather than paper over.

**What I'd do next.** Finish the distilled evaluation properly, and sweep temperature and alpha instead of fixing them — the whole thesis of the project lives in how hard you soften the tree's distribution, so that sweep is the experiment, not a footnote. I'd also compare the tree-teacher against a proper cost-sensitive loss on the network, to isolate how much of the benefit is really the *distillation* versus just any de-biasing signal.

The lesson I actually carried out of this project wasn't about Bangla, or even about distillation. It was about respecting the negative space in a results table — that what you *didn't* get to measure often shapes the next question more than what you did. A year later I found myself distilling network-intrusion detectors, and the first thing I asked was: which model here is the less-biased one, and what does it know that the accurate one doesn't?

---

The full paper, the notebooks, and the layer-by-layer evaluation live here:

- Project write-up: [/research/bangla-pos-tagging](/research/bangla-pos-tagging)
- Code and notebooks: [github.com/abuammarsami/CSE498_Bangla_Postagging](https://github.com/abuammarsami/CSE498_Bangla_Postagging)
