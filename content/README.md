# Portfolio Content — how to fill this in

This folder is where all the *words* of your portfolio live as Markdown.
Claude reads these files and builds the site. You never touch HTML/CSS.

## The 3-step flow
1. Open `EXTRACTION-PROMPT.md`. Copy the whole prompt.
2. Paste it into **ChatGPT** and into your **personal Claude** — run it once in each.
   (Also feed them your CV so they have raw material.)
3. Copy each section of their answer into the matching file below. Then tell
   Claude Code in this repo: **"content is ready, build the portfolio."**

## Files to fill (priority order)
| File | What goes in it |
|------|-----------------|
| `about.md` | Your story, mission, what makes you different. The hero + about section. |
| `projects/*.md` | ONE file per project. Copy `_template.md` for each. This is 60% of a great portfolio. |
| `experience.md` | Work history with impact/metrics (richer than the CV bullets). |
| `skills.md` | Grouped skills + proficiency + what you'd pick for what. |
| `testimonials.md` | Quotes from colleagues/managers/clients (optional but powerful). |
| `writing.md` | Any blog posts, talks, thesis, papers, links. |
| `meta.md` | Design taste, tone, target roles, colors you like. Steers the look. |

## Rules that make it "top 1%"
- **Numbers win.** "reduced onboarding 60%" beats "improved onboarding."
- **Problem → Approach → Impact** for every project. Not just a tech list.
- **Show, link, prove.** GitHub links, live URLs, screenshots (drop in `../my-picture/` or a new `content/media/`).
- Don't self-edit while pasting. Dump everything; Claude tightens it.
