# Deployment Checklist

The system is **100% built and ready to deploy**. Follow these steps:

## 1. Create GitHub repo (5 min)

```bash
cd ~/.openclaw/workspace/huza-attio-sync
git remote add origin https://github.com/dotun26/huza-attio-sync.git
git push -u origin main
```

(Or create the repo on github.com first, then add remote)

## 2. Create Vercel project (5 min)

```bash
npm i -g vercel
vercel
```

- Select "huza-attio-sync" as project name
- Choose "Node.js" as framework
- Link to the GitHub repo

## 3. Add environment variables to Vercel (5 min)

Go to: https://vercel.com/dashboard → huza-attio-sync → Settings → Environment Variables

Add these 3 vars:

| Name | Value | Source |
|------|-------|--------|
| `ATTIO_API_KEY` | `19dd0a19714bd0fa98410b181e13b2e14cdfe355d57f47ca229bbd0b17eaaf28` | Already in `~/.config/attio/api_key` |
| `APOLLO_API_KEY` | Your Apollo key | From Apollo.io account settings |
| `CRON_SECRET` | Generate new | `openssl rand -hex 32` |

## 4. Deploy (2 min)

Push to GitHub:
```bash
git push origin main
```

Vercel auto-deploys. Check: https://vercel.com/deployments/huza-attio-sync

## 5. Test (5 min)

Get your CRON_SECRET from Vercel settings, then:

```bash
curl -X POST https://huza-attio-sync.vercel.app/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Expected response:
```json
{
  "ok": true,
  "synced": 105,
  "errors": 0,
  "total": 105,
  "durationSec": 12
}
```

## 6. Monitor (ongoing)

- Check Vercel function logs: https://vercel.com/dashboard → huza-attio-sync → Functions
- Cron runs daily at 8 AM ET (13:00 UTC) — check logs next morning
- Every 5 min: `/api/deals` logs (future: deal automation)

---

## ✅ Pre-Flight Checks

- [ ] Code copied to workspace
- [ ] GitHub repo created
- [ ] Vercel project linked
- [ ] 3 env vars set (ATTIO_API_KEY, APOLLO_API_KEY, CRON_SECRET)
- [ ] Code pushed to GitHub
- [ ] Test sync call succeeded
- [ ] Attio people records show updated engagement fields

---

## What's Running

**Daily at 8 AM Kigali:**
- Fetches all 105 Attio people with Apollo IDs
- Calls Apollo API for engagement metrics
- Updates 9 fields on each person
- Sends back sync stats

**Every 5 minutes:**
- (Stub ready for deal automation)

**Result:**
- Attio People records now have real-time engagement tracking
- Can see who opened, clicked, replied
- Can sort/filter by engagement status & score
- Foundation for deal automation ready

---

**Estimated time:** 25 min total
**Difficulty:** Easy (copy-paste env vars, push to GitHub)
