---
title: "Dino: AI Vegas Dining Concierge"
description: "AI-powered dining concierge for Las Vegas with Rat Pack-era personality, real restaurant discovery via Google Maps, mock booking with a real API contract, and Google Calendar deep links with insider tips."
status: deployed
deployUrl: "https://web-production-c0565.up.railway.app"
repoUrl: "https://github.com/rthomchick/dino"
weekBuilt: 13
tags: ["consumer-ai", "prompt-engineering", "personality", "fastapi", "google-maps", "restaurant-booking", "claude-code"]
problemSolved: "Existing hotel concierge chatbots recommend restaurants but can't book; Dino closes the loop with opinionated recommendations, availability checks, reservations, and calendar events."
architecturePattern: "Single conversational agent with tool loop (Claude Sonnet) orchestrating six tools via FastAPI backend"
techStack: ["Python", "FastAPI", "Anthropic API", "Google Maps Places API", "Railway", "vanilla HTML/JS"]
sortOrder: 1
journalSlug: "week-13-meet-dino"
---

## What it does

Dino is a conversational AI dining concierge for Las Vegas, named after Dean Martin. Tell him what kind of night you're planning, and he recommends restaurants with strong opinions, checks availability, books a table, and adds the reservation to your Google Calendar with an insider tip about what to order.

The conversation feels like texting a friend who knows every restaurant in town. Dino asks about the vibe, not the cuisine. He leads with his best pick and tells you why. When a restaurant isn't bookable through the system, he gives you the direct booking link.

Under the hood, a single agent (Claude Sonnet) orchestrates six tools through a tool loop: restaurant search via Google Maps Places API, availability and reservation through a mock booking service, and calendar events via Google Calendar deep links. The user never sees the agent reasoning. They talk to Dino and things happen.

## Architecture decisions

FastAPI serves both the REST API and the static HTML/JS frontend from a single Railway service. The frontend calls `POST /chat` and renders structured response data (restaurant cards, booking confirmations, calendar events) as rich UI components inline with the chat.

The mock booking service mirrors a real reservation API contract. The agent doesn't know it's a mock. Swapping in a real provider (SevenRooms, Resy) means changing the service implementation, not the agent or tools. This was a deliberate pivot after discovering that all major reservation platforms are closed B2B systems with no public developer APIs.

Calendar integration uses deep links rather than OAuth. Dino generates a pre-filled Google Calendar URL with reservation details and his insider tip in the event description. Zero auth infrastructure, and the user sees the event before it hits their calendar.

## Personality engineering

Dino's system prompt builds a full character: warm, confident, opinionated but not pushy. He recommends with reasons, never lists options neutrally. He handles "I don't know what I want" by asking about vibe, not cuisine.

The prompt uses a structured conversation flow (greet, understand, recommend, confirm, book, calendar) with explicit edge case handling. When someone asks about nightclubs, Dino stays honest: "That's not my department, pal. I'm your dinner guy." When I gave the name "Frank Sinatra" for a reservation, Dino called me "Chairman" for the rest of the conversation.

## What I learned

The system prompt is the product specification. Every line maps to a user-facing behavior. A missing field in the schema is a missing feature. This was proven when restaurant photos weren't rendering: photo data flowed through the entire backend, but the structured output schema didn't include `photo_url`, so the model dropped it. One-line fix, photos everywhere.

Consumer products demand different design thinking than internal tools. The personality layer isn't a nice-to-have; it's what sets the product apart from Yelp. Without Dino's voice, this is just a restaurant search with extra steps.

Claude Code changed the job from writing Python to writing specifications. Build prompts describe desired behavior, visual design, API contracts, and test criteria. Claude Code handles implementation. The trust shift from reviewing code to testing behavior mirrors the shift a PM makes when they stop micromanaging engineering and start managing outcomes.
