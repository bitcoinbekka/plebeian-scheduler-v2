# Plebeian Scheduler - Nostr Protocol Usage

## Overview

Plebeian Scheduler is a scheduling tool for Nostr merchants, primarily targeting the Plebeian Market ecosystem. It enables users to compose, schedule, and publish Nostr events at future timestamps.

## Standard NIPs Used

### NIP-01 — Events & `created_at`

All Nostr events use the standard event structure. For scheduled posts, the `created_at` field is set to the future timestamp when the event should appear on relays.

### NIP-07 — Browser Extension Signer

Events are signed via NIP-07 compatible browser extensions (like Plebeian Signer). The scheduler never handles private keys directly.

### NIP-23 — Long-form Content

- **kind 30023** — Published long-form articles
- **kind 30024** — Draft articles (saved before publishing)

Tags used: `d`, `title`, `summary`, `image`, `published_at`, `t`

### NIP-40 — Event Expiration

Optional `expiration` tag can be added to any event to signal relays to delete the event after a specified timestamp.

```json
["expiration", "1700000000"]
```

### NIP-46 — Remote Signing (Nostr Connect)

Supports NIP-46 bunker:// URIs for remote signing. This enables delegated publishing via DVM without exposing private keys.

### NIP-65 — Relay List Metadata

Relay configuration is synced via NIP-65. The scheduler reads and writes relay preferences.

### NIP-90 — Data Vending Machine (DVM)

For delegated publishing, the scheduler creates job requests:

- **kind 5905** — Job request to publish a scheduled event
  - Input: The stringified JSON of the unsigned event to publish
  - Params: `action` = "publish", `publish_at` = unix timestamp
  - Relays: Target relay URLs for publication

```json
{
  "kind": 5905,
  "content": "",
  "tags": [
    ["i", "<stringified-event-json>", "text"],
    ["output", "text/plain"],
    ["param", "action", "publish"],
    ["param", "publish_at", "1700000000"],
    ["relays", "wss://relay.damus.io", "wss://relay.primal.net"],
    ["alt", "DVM job request: publish scheduled Nostr event at 2023-11-14T22:13:20.000Z"]
  ]
}
```

Job results would be **kind 6905** from the DVM service provider.

### NIP-92 — Media Attachments

All uploaded media includes `imeta` tags with available metadata:

```json
["imeta", "url https://example.com/image.jpg", "m image/jpeg", "dim 1024x768", "x <sha256>"]
```

### NIP-99 — Classified Listings

The primary use case for Plebeian Market merchants.

- **kind 30402** — Published classified listing
- **kind 30403** — Draft classified listing

Required tags: `d`, `title`, `published_at`

Optional tags: `summary`, `price`, `location`, `status`, `t`, `image`, `imeta`, `expiration`

#### Price Tag Format

```json
["price", "<amount>", "<currency>", "<frequency>"]
```

- Currency: ISO 4217 or crypto codes (BTC, SAT, USD, EUR, etc.)
- Frequency: Optional (hour, day, week, month, year)

## Local Storage Schema

All scheduler data is stored in browser localStorage (not on Nostr relays) until the event is published:

- `plebeian-scheduler:posts` — Array of SchedulerPost objects
- `plebeian-scheduler:queues` — Array of Queue objects

This local-first approach ensures no private data leaks to relays before intentional publishing.
