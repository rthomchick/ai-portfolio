---
title: "Knowledge Assistant"
description: "RAG-powered Q&A tool grounded in team knowledge base documents."
status: deployed
deployUrl: "https://knowledge-assistant.streamlit.app"
weekBuilt: 6
tags: ["rag", "chromadb", "embeddings", "streamlit"]
problemSolved: "Team members spend time searching through documents for specific information. This tool answers questions grounded in actual team data."
architecturePattern: "RAG pipeline: retrieve → generate"
techStack: ["Python", "Streamlit", "Anthropic API", "ChromaDB", "OpenAI Embeddings"]
sortOrder: 2
---

## What it does

Accepts natural language questions and returns answers grounded in team documents. Uses semantic search to find relevant passages, then generates responses citing specific data rather than generic knowledge.

## Architecture decisions

The pipeline follows the standard RAG pattern: embed the question, retrieve top-k relevant chunks from ChromaDB, inject them into Claude's context, and generate a grounded response. I added a re-ranking step using Claude Haiku to improve retrieval precision before the final generation call.

## What I learned

The key insight from this project: the quality of your RAG system depends more on your chunking strategy than on your model choice. Getting the chunk size and overlap right had a bigger impact on answer quality than any prompt engineering I did.
