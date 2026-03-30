# Huza HR — Apollo → Attio Engagement Sync

Daily sync of Apollo sequence engagement data into Attio CRM.

---

## How It Works

```
GitHub Actions (daily 6 AM UTC / 8 AM Kigali)
    ↓
Pull all contacts from Apollo sequence
    ↓
For each contact:
  - Find in Attio by email
  - If not found → create person in Attio
  - Update engagement fields
    ↓
Telegram summary notification
```

## What Gets Synced

| Field | Source | Notes |
|---|---|---|
| `engagement_status` | `contact_campaign_statuses[0].status` | In Sequence / Replied / Bounced / Completed / Paused / Not Sent |
| `days_since_contact` | Calculated from `added_at` | Number of days since added to sequence |
| `last_engaged` | `finished_at` or `added_at` | ISO timestamp |

## Architecture

- **Runner:** GitHub Actions (no timeout, free tier)
- **Script:** `sync.js` — single Node.js file, no dependencies (pure `https` module)
- **Previous:** Vercel cron — abandoned (10s Hobby plan timeout kills 272-contact runs)

## Secrets Required (GitHub repo)

| Secret | Description |
|---|---|
| `APOLLO_API_KEY` | Apollo master API key |
| `ATTIO_API_KEY` | Attio API token |
| `TELEGRAM_BOT_TOKEN` | @huzahr_bot token |
| `TELEGRAM_CHAT_ID` | 7442010599 |

## Schedule

- **Automatic:** Daily at 06:00 UTC (08:00 Kigali)
- **Manual trigger:** GitHub Actions → "Attio Engagement Sync" → Run workflow
- **Active:** Daily from March 30, 2026

## Trigger Manually

```bash
curl -s -X POST \
  -H "Authorization: token YOUR_GH_TOKEN" \
  "https://api.github.com/repos/dotun26/huza-attio-sync/actions/workflows/daily-sync.yml/dispatches" \
  -d '{"ref":"main"}'
```

## Attio Status Options

Created via API on 2026-03-30. Must match exactly:
- `In Sequence`
- `Replied`
- `Bounced`
- `Completed`
- `Paused`
- `Not Sent`

## Key Decisions

- **Email as join key** — Apollo contacts matched to Attio people by email address (reliable, no Apollo ID dependency)
- **Create on miss** — if a contact doesn't exist in Attio, it's created automatically (handles new contacts added since Relay.app paused)
- **GitHub Actions over Vercel** — 272 contacts × API calls × rate limit sleeps = ~5 min runtime; Vercel 10s timeout makes this impossible
- **Direct API sync** — no third-party middleware; Apollo→Attio handled natively

## Apollo Sequence

- **Name:** Huza HR - Formalization Squeeze
- **ID:** `698b3bdb6b7cef0021601884`
- **Contacts:** ~272 (as of March 2026, growing every 3 days)
