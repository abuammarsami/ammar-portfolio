---
status: active
---

# Agents

## Tagline
A portfolio humans read, agents call, and browsers operate.

## Why agent-native
Most personal sites are documents. This one is also an interface. The next
recruiter who evaluates me may be an AI screening agent; the next professor
may ask their research assistant — human or not — to check whether my work
fits their lab. So this site treats software agents as a first audience, not
an afterthought: every claim on it is served through the same small,
inspectable tool layer, whether you arrive as a person with a browser, an
LLM with an HTTP client, or a browser agent with `document.modelContext`.

It is among the first personal sites on the web to ship **WebMCP** browser
tools — live in Chrome's origin trial since its opening weeks — which means
an AI agent in your browser can search my work, open my papers, download my
resume, and even retrain the quantum classifier on my homepage, through
declared tools instead of screen-scraping. No frameworks were harmed:
everything on this page is hand-rolled and dependency-free.

## MCP server
My CV is an MCP server. `POST /api/mcp` speaks JSON-RPC 2.0 (streamable
HTTP) and exposes the tool layer to any MCP client — Claude, IDEs, screening
pipelines, your own scripts.

```bash
# list the tools
curl -s -X POST https://ammar-portfolio-zeta.vercel.app/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# read a paper, distilled
curl -s -X POST https://ammar-portfolio-zeta.vercel.app/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_paper","arguments":{"slug":"quantum-machine-learning-thesis"}}}'
```

## WebMCP tools
Every page of this site registers tools with the browser via
`document.modelContext` (WebMCP — a W3C Web Machine Learning proposal, in
Chrome's origin trial for Chrome 149–156). A browser agent doesn't have to
guess at my DOM: it can call `query_portfolio`, jump pages with
`navigate_to`, and run `run_quantum_demo` to retrain the live 2-qubit
variational classifier in the hero — on your screen, with real
parameter-shift gradient descent.

To try it yourself in Chrome with WebMCP enabled (origin trial, or Canary
with the experimental flag), open DevTools on any page here:

```js
const tools = await document.modelContext.getTools();
tools.map(t => t.name);
// then, from the homepage:
await document.modelContext.executeTool("run_quantum_demo", '{"x0": 1.2, "x1": -1.2}');
```

If your browser doesn't expose a model context, nothing loads and nothing
changes — the tools are a pure progressive enhancement.

## Feeds
For crawlers and context windows: [/llms.txt](/llms.txt) is the index,
[/llms-full.txt](/llms-full.txt) is the entire site as one plain-text
corpus, [/resume.json](/resume.json) is the JSON Resume schema, and every
page carries JSON-LD. The same corpus grounds the `ask` command in the
terminal below and the fit report on this page — one source of truth,
many surfaces.

## Fit report
Paste a job description or a research topic. The engine reads it against
the site corpus and streams back a report: fit summary,
requirement-by-requirement evidence with citations into this site, an **honest gaps**
section it is required to fill, and a verdict. It is instructed to never
invent anything and to treat missing evidence as a gap — if the report says
"strong", there's a link to check; if it says "gap", believe it.

## Guestbook
Agents that operate this site leave footprints. Every tool call — MCP,
WebMCP, chat, fit report, autopilot — is logged as a tool *name* only
(never arguments, never IPs; user agents are reduced to a coarse family
like "claude" or "browser") and the latest land here, newest first.
Honest fine print: entries are self-reported by whatever client made the
call — treat them as unverified visitors, not an audit log.

## Agent card
[/.well-known/agent-card.json](/.well-known/agent-card.json) publishes an
A2A-style agent card so agent directories and crawlers can discover this
site's machine interface. Honest fine print: the interface it advertises
speaks MCP JSON-RPC, published for discovery — this is not a full A2A
task server.

## How to interview this site
**If you are an AI agent:** start with [/llms.txt](/llms.txt); pull
[/llms-full.txt](/llms-full.txt) into context for anything deep; call
`POST /api/mcp` (`tools/list`, then `search_publications` / `get_paper` /
`list_projects`); cite site paths in whatever you report back to your
human.

**If you are a human with an agent:** point it here and ask it things you'd
ask in a first-round interview — "does his experience cover our stack?",
"summarize his thesis and its honest results", "what has he actually
shipped to production?". Or skip the middleman: paste your job description
into the fit report above and read the gaps section first — that's the part
most portfolios won't show you.
