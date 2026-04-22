---
title: "Week 6: RAG & Knowledge-Grounded AI"
headline: "When smart generalists aren't enough"
week: 6
date: 2026-02-14
summary: "Built a full RAG pipeline from embeddings to deployed Knowledge Assistant, learning why grounding AI in your own data changes everything."
tags: ["rag", "embeddings", "chromadb", "deployment"]
keyInsights:
  - "RAG transforms tools from smart generalists to informed specialists"
  - "Embeddings turn meaning into math — semantic search matches intent, not keywords"
  - "Hybrid search is harder to implement well than it appears"
  - "ChromaDB requires Python 3.12 — environment isolation matters"
toolsBuilt: ["Knowledge Assistant", "ROI Analyzer"]
status: published
---

This week was about answering a fundamental question: what happens when your AI tool needs to know things that aren't in its training data?

The answer is RAG — Retrieval-Augmented Generation. Instead of hoping Claude knows about your team's specific processes, you give it access to your actual documents and let it ground its responses in real data.

## The grounding test

The moment RAG clicked for me was the grounding test. I asked the same question twice — once with RAG, once without. Without RAG, Claude gave me generic industry benchmarks. With RAG, it cited the specific 2.3% conversion rate from our team's data. Same model, same prompt, completely different value.

## From embeddings to deployment

The week progressed through a natural pipeline: embeddings (turning text into vectors), vector storage (ChromaDB), retrieval (finding relevant chunks), and generation (grounding Claude's response in what we found). Each day built on the previous one, and by Friday I had a deployed Knowledge Assistant on Streamlit Cloud.

## Key technical decision

I spent time exploring hybrid search — combining keyword matching with semantic search. The theory is sound, but the implementation complexity wasn't justified at my current scale. Pure semantic search with good chunking and overlap handles the use cases I care about. This is a pattern I keep seeing: the sophisticated approach isn't always the right one for where you are today.
