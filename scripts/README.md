# Scripts

## import-apollo-list.js

Import 105 Huza HR contacts from Apollo to Attio.

**Usage:**
```bash
APOLLO_API_KEY=KlGUfx8Gpr05VGCea0wEIA \
ATTIO_API_KEY=$(cat ~/.config/attio/api_key) \
node scripts/import-apollo-list.js
```

**What it does:**
1. Fetches all contacts from Apollo list `69a6f14a2d016c0011ddf7ed` (clawd generate)
2. Creates each contact in Attio with:
   - Name
   - Apollo Person ID (linked for engagement sync)
   - Headline
   - Location
   - Organization name

**Takes:** ~2 minutes for 105 contacts

**Output:**
```
🚀 Importing Huza HR contacts from Apollo to Attio...

Fetching batch (offset 0)...
  Got 105 contacts (total: 105)

✅ Fetched 105 contacts from Apollo

[105/105] Importing John Doe...

📊 Import Results:
  ✅ Created: 105/105
  ❌ Failed: 0

✨ Done!
```

Once imported, the daily sync at 8 AM Kigali will automatically pull engagement data (opens, clicks, replies) from Apollo and populate the 9 engagement fields in Attio.
