# Huza Attio Engagement Sync

Apollo → Attio engagement tracking automation for Huza HR outbound campaigns.

## What It Does

Syncs engagement metrics from Apollo (opens, clicks, replies) to Attio custom fields daily. Tracks engagement status, calculates engagement scores, and prepares deal automation.

**Features:**
- Daily sync of Apollo engagement data to Attio People records
- 9 engagement tracking fields (status, score, opens, clicks, etc.)
- Deal automation foundation (create/move deals based on engagement)
- Handles 100+ contacts efficiently

## Setup

### 1. Create a new Vercel project

```bash
npm i -g vercel
vercel
```

Select `huza-attio-sync` as the project name. Choose Node.js framework.

### 2. Set environment variables in Vercel

Go to Vercel dashboard → Settings → Environment Variables. Add:

- `ATTIO_API_KEY` — from 1Password "attio API Credentials"
- `APOLLO_API_KEY` — from Apollo.io account settings
- `CRON_SECRET` — generate a random string: `openssl rand -hex 32`

### 3. Deploy

```bash
git push origin main
```

Vercel auto-deploys on push. Check logs in dashboard.

## Cron Schedules

### `/api/sync` — Daily at 8 AM Kigali (06:00 UTC)

Pulls engagement data from Apollo for all people in Attio, updates 9 fields:
- Engagement Status
- Engagement Score
- Emails Sent, Opens, Clicks
- Last Engaged
- Days Since Contact
- Sequence Step
- Next Follow-up Date

**Response:**
```json
{
  "ok": true,
  "synced": 105,
  "errors": 0,
  "total": 105,
  "durationSec": 12
}
```

### `/api/deals` — Every 5 minutes (during market hours)

Deal automation (currently a stub; full implementation in progress).

## Manual Testing

Test the sync endpoint:

```bash
curl -X POST https://huza-attio-sync.vercel.app/api/sync \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Attio Custom Fields

All fields are on the **People** object:

| Field | Type | Purpose |
|-------|------|---------|
| Engagement Status | Select | new → contacted → opened → clicked → replied → stalled |
| Engagement Score | Number | 0-100 formula: opens×10 + clicks×25 + reply×50 |
| Emails Sent | Number | Count of emails in the sequence |
| Opens | Number | Email open count from Apollo |
| Clicks | Number | Email click count from Apollo |
| Last Engaged | Timestamp | When they last opened/clicked/replied |
| Days Since Contact | Number | Days since first email sent |
| Sequence Step | Select | 1/2/3/4 (which email they're on) |
| Next Follow-up Date | Timestamp | Auto-calculated (7 days if opened, 14 if not) |

## Apollo Integration

The sync uses Apollo's `/v1/people/<id>` endpoint to fetch:
- `email_opens_count`
- `email_clicks_count`
- `email_status` (verified = replied)
- `last_activity_date`
- `verified_at`

All Apollo contact data is already synced to Attio via the native integration; this syncs **engagement metrics only**.

## Future Work

1. **Deal automation** — Auto-create deals for new contacts, move to "Interested" when they reply
2. **Weekly digest** — Send engagement summary to Telegram/email
3. **Stalled contact alerts** — Flag contacts with no engagement in 7+ days
4. **Custom workflows** — Trigger actions in Attio when engagement changes
5. **DB persistence** — Track sync state to avoid duplicate updates

## Files

- `lib/attio.js` — Attio REST client + engagement calculators
- `api/sync.js` — Daily engagement sync
- `api/deals.js` — Deal automation (stub)
- `vercel.json` — Cron schedules + function configs
- `package.json` — Dependencies (currently none needed)

## Status

✅ **Deployment-ready** — All core sync logic complete and tested locally. Ready to push to GitHub and deploy to Vercel.

## Support

Questions? Check Vercel function logs or GitHub Issues.
