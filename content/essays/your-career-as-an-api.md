---
title: "Your Career Is About to Have an API"
status: draft
kind: essay
created: 2026-07-06
summary: "The résumé was built for a human skimmer. That reader is being replaced. What it means to make yourself operable by the machine that now reads you first."
note: "Draft manifesto — doubles as site essay and the launch post for the agentify skill. Route wiring (/essays/[slug] or a /writing long-form) is a separate build step."
---

# Your Career Is About to Have an API

The résumé is a document optimized for a reader who is disappearing.

It was designed for a specific act: a human being, holding coffee, giving your life six seconds before deciding which pile you go in. Every convention of the form — the reverse-chronology, the bolded metrics, the one-page discipline — is a concession to that reader's attention. We got very good at writing for the skimmer.

The skimmer is being replaced. Not entirely, not yet, but at the first gate — the one that decides whether a human ever sees you at all — the reader is increasingly a machine. A recruiter's copilot. A screening model with a rubric. A professor's research assistant told to "find me three students who've actually shipped a quantum classifier, not just read about one." The first entity to form an opinion of you now reads at ten thousand words a second, never gets tired, and does not skim. It queries.

And here is the uncomfortable part: **almost nothing we build for ourselves is legible to it.**

A PDF résumé is a wall to an agent — a rasterized artifact it has to guess at. A portfolio site is better, but only barely: it's a pile of HTML written for eyes, where the actual signal — did he handle scale, does the research hold up, what has he *not* done — is buried in prose the agent has to reconstruct. We spent a decade making our work beautiful to humans and accidentally made it opaque to the thing that now stands between us and the humans.

So I did the obvious thing and made mine operable.

This site is not just a page you read. It's a service you can call. There's a [Model Context Protocol](/agents) server, so an AI agent can ask it structured questions — *list the projects, search the publications, get the results of that thesis* — and get structured answers, not scraped guesses. There's an A2A agent card at a well-known URL, the handshake one agent uses to discover what another can do. There are WebMCP tools that let a browser agent operate the page directly. And there's a fit engine: paste a job description or a lab's research focus, and it writes a report mapping each requirement to real evidence on the site, with citations to the exact page — and a section, which it is forbidden to leave empty, listing what I *haven't* done.

That last constraint is the whole point.

Because the interesting thing about building for an agent isn't the plumbing. MCP is a weekend. The interesting thing is what it does to your relationship with the truth. A human skimmer can be charmed. Confident verbs, a good adjective, a metric with no denominator — these work on people because people are polite and in a hurry. An agent is neither. If you claim "improved performance by 40%," a sufficiently good agent asks *forty percent of what, measured how, versus what baseline* — and if the answer isn't on the page, that's not a strong claim anymore. It's a gap. Making yourself machine-readable means making yourself **auditable**, and auditable is a much higher bar than impressive.

So the discipline the agent forces is honesty. Every number on my site is committed with the git SHA it was measured at. Every "strong fit" the engine claims has to cite a real artifact. My worst result — a knowledge-distillation experiment where the student model only reached 0.75 F1 and I could not get it to learn what I'd hoped — is on the site in those words, because a research assistant that catches you hiding a negative result trusts nothing else you say. The machine reader doesn't reward the polish that fooled the human reader. It rewards the receipts.

I think this is the next literacy, and I think it arrives faster than people expect. Not "learn to use AI" — everyone says that and it means nothing. Something more specific: **make yourself operable by AI.** Structure your work so the systems that increasingly mediate opportunity can query it, verify it, and represent you faithfully when you're not in the room. Treat your career as an API — with real endpoints, honest schemas, and no undocumented behavior — because in a few years the alternative is being the one professional in the search results that the agent couldn't parse, and therefore didn't return.

The résumé told a human, in six seconds, a story you controlled. The next artifact tells a machine, in one query, a truth it can check. Those are different skills. I'd rather be early at the second one.

If you want to make your own presence operable, I extracted the layer that runs this site into an open tool — [agentify](https://github.com/abuammarsami). Point it at your work; it gives you the endpoints. The honesty part you have to bring yourself. The machine will notice either way.

*— Md. Abu Ammar*
