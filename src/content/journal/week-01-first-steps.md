---
title: "Week 1: First Steps"
headline: "Week 1: First Steps"
week: 1
date: 2026-04-12
summary: "A non-engineer sets up a Python dev environment, generates an API key, and makes a first Claude API call — and discovers that vibe-coding has limits."
tags:
  - python
  - anthropic-sdk
  - dev-environment
  - cli
  - api
keyInsights:
  - "Setup is still the unglamorous prerequisite — Python, venv, API keys, and editor config all have to work together before you write a single line of product logic."
  - "Calling Claude from code is a fundamentally different relationship than the chat UI — system prompt, temperature, and conversation history are all parameters you control."
  - "A working 'Hello World' API call is only 10–15 lines; the entry point to building AI products is more accessible than it looks."
  - "venv activation is per-session — closing the terminal logs you out of the environment, like switching accounts."
  - "Being a developer is more than coding: environment setup, deployment config, error handling, and cross-system debugging are hard to vibe-code through."
toolsBuilt: []
status: published
---

**Goal**: Set up development environment and make my first Claude API call.

---

I am not an engineer, but I have done enough coding in the past to get frustrated with the setup process and toolchain dependencies. I tried an AI training course in 2018 and couldn't get past the step to install PyTorch. It was downright embarrassing. So my first question was, "Can Claude get me over the hump? Can I make it work?"

Thankfully, the answer was Yes! Within the first five minutes, I knew this was going to be a very different (and better) experience than I've had in the past.

## What I Did

### Set Up the Dev Environment

- Installed Python, created my first virtual environment (`python3 -m venv venv`)
- Reacquainted myself with VS Code; installed Claude Code and several extensions
- Set up a project directory at `~/ai-projects/`
- Installed the Anthropic SDK (`pip install anthropic`)

### Generated My First API Key

- Generated an API key from the Anthropic console
- Configured it as an environment variable (`export ANTHROPIC_API_KEY="sk-ant-..."`)
- Learned the hard way that `export` is per-terminal-session: close the window, lose the key

### Made My First API Call

- Wrote the "Hello World" script `client.messages.create()` with a simple prompt: "Hello, Claude! What can you help me build?" About 10 lines of code.
- Successfully called the Claude API from my own machine and received my first response.

## What I Learned

- **Setup was still the hardest part.** Getting Python, the venv, the API key, and the editor all working together is still an unglamorous prerequisite. I suspect it will get easier as I shake off the rust of having not used these tools in a while.
- **What "real" prompt engineering is.** Running Claude from code is a fundamentally different relationship than using the Claude AI chat interface. I get to control the system prompt, the temperature, the conversation history. Everything that felt like magic in the chat UI is now a parameter I can set.
- **How little code it actually takes.** The first working script was probably 10–15 lines. After weeks of imagining that "building AI products" required deep engineering, the entry point is surprisingly accessible.

## What I Struggled With

- Terminal/CLI unfamiliarity: navigating directories, understanding `PATH`, knowing which Python I'm running (and juggling between system Python and venv Python).
- **venv activation is per-session.** This tripped me up — I installed `anthropic`, closed the terminal, reopened it, and got `ModuleNotFoundError`. The mental model that clicked: a venv is like logging into a specific account. Close the terminal, you're logged out.
- Understanding what the SDK actually does vs. what the API does vs. what Claude does — three layers that blur together at first.

## Key Takeaway

**Being a developer is much more than just coding.** I can see how vibe-coding might make a person feel drunk with power, but there is a lot of less glamorous work — environment setup, deployment config, error handling, cross-system debugging, evaluation infrastructure — that is much harder to vibe-code your way through vs. a professional software engineer who understands what's actually happening on the machine.

---

*Week 1 complete. Environment works. Claude responds. Everything else starts here.*
