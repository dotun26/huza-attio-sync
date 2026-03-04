# Attio Setup Guide - Best Practices

Complete setup for production-ready Attio deployment.

---

## Step 1: Import Contacts (One-Time)

**When:** Before creating views (so views have data)

```bash
APOLLO_API_KEY=KlGUfx8Gpr05VGCea0wEIA \
ATTIO_API_KEY=$(cat ~/.config/attio/api_key) \
APOLLO_LIST_ID=69a6f14a2d016c0011ddf7ed \
node ~/.openclaw/workspace/huza-attio-sync/scripts/import-apollo-list.js
```

**Expected output:**
```
🚀 Importing Huza HR contacts from Apollo to Attio...
✅ Fetched 105 contacts from Apollo
[105/105] Importing John Doe...
📊 Import Results:
  ✅ Created: 105/105
  ❌ Failed: 0
✨ Done!
```

**After import:** Check Attio → People → Should show 105 new contacts

---

## Step 2: Create 4 Table Views in Attio UI

Go to **Attio workspace** → **People** object

### View 1: Engagement Status

1. Click current view dropdown → **+ Create new**
2. Select **Table** → Name: **Engagement Status** → **Confirm**
3. Click **View settings** (top right) → **+ Add column** → Select:
   - Name
   - Company (linked)
   - Engagement Status
   - Engagement Score
   - Opens
   - Clicks
   - Has Replied
   - Last Engaged
   - Days Since Contact
4. Click **Sort** → **Engagement Score** (Descending) → **Apply**
5. **Save view**

### View 2: Hot Leads

1. **+ Create new** → **Table** → Name: **Hot Leads**
2. **Filter** → **+ Add condition**
   - Select: Engagement Status
   - Condition: **is**
   - Value: **Replied** OR **Clicked** (use + to add second)
3. **Add columns:**
   - Name
   - Company
   - Headline (Apollo Headline)
   - Engagement Score
   - Last Engaged
   - Next Follow-up Date
4. **Sort** → Engagement Score (Descending)
5. **Save**

### View 3: Stalled Contacts

1. **+ Create new** → **Table** → Name: **Stalled Contacts**
2. **Filter** → **+ Add condition**
   - Days Since Contact **>** 14
   - AND
   - Engagement Status **is not** Replied
3. **Add columns:**
   - Name
   - Company
   - Days Since Contact
   - Last Engaged
   - Next Follow-up Date
   - Engagement Status
4. **Sort** → Days Since Contact (Descending)
5. **Save**

### View 4: New Prospects

1. **+ Create new** → **Table** → Name: **New Prospects**
2. **Filter** → **+ Add condition**
   - Engagement Status **is** New OR Contacted
3. **Add columns:**
   - Name
   - Company
   - Headline
   - Location (Apollo Location)
   - Engagement Status
4. **Sort** → Date Added (Newest First)
5. **Save**

---

## Step 3: Set Up Attio MCP Integration

Connect your Attio workspace to Claude for AI-native queries.

### Connect MCP in Claude Desktop

1. Open **Claude Desktop settings**
2. Go to **Connectors**
3. **Add custom connector**
4. Enter URL: `https://mcp.attio.com/mcp`
5. Follow OAuth prompts (log in with Attio account)
6. **Done!** Claude now has access to your Attio workspace

### Example MCP Queries

Once connected, you can ask Claude:
- "Show me all hot leads at tech companies"
- "Find contacts I've been emailing with"
- "Create a note on the Linear account: great demo, wants pricing"
- "What was my last interaction with the Notion deal?"
- "Update Sarah's company to her new role at Stripe"

**Tip:** MCP searches are more powerful than views — combine multiple filters in natural language.

---

## Step 4: Verify Daily Sync (Tomorrow 8 AM Kigali)

Tomorrow at 8 AM Kigali time (06:00 UTC), the sync cron will run automatically:
- Fetch all 105 contacts from Attio
- Query Apollo for engagement data
- Calculate engagement status, score, days_since_contact
- Update all 9 engagement fields in Attio

**Check results:**
1. Go to Attio → **Engagement Status** view
2. Scroll right → should see:
   - Engagement Status column populated (New/Contacted/Opened/etc.)
   - Engagement Score column populated (0-100)
   - Opens, Clicks, Last Engaged columns populated

**If empty:** Check Vercel logs at `https://vercel.com/dashboard/huza-attio-sync` → Logs

---

## Step 5: Invite Team & Set Permissions

1. Go to Attio → **Workspace settings** → **Members**
2. Invite team members
3. Give access to:
   - People object (required)
   - Views: Engagement Status, Hot Leads, Stalled Contacts, New Prospects
4. Share **Attio MCP** access (if using Claude team)

---

## Daily Workflow

### Morning (8 AM Kigali, after sync)
- Open **Hot Leads** view
- Contact high-score prospects (score > 50)
- Log calls/emails as notes in Attio

### Afternoon
- Open **Stalled Contacts** view
- Decide: re-engage or disqualify
- Update Next Follow-up Date

### Weekly (Monday)
- Open **New Prospects** view
- Plan outreach for next batch
- Use Claude MCP: "Find all new prospects in tech"

### Monthly
- Review metrics:
  - Reply rate: (Replied / Total)
  - Avg Days to First Engagement
  - Pipeline progression rate

---

## MCP Best Practices

### Natural Language Queries (vs. Manual Filtering)
✅ **Good:** "Show me all contacts who clicked and haven't replied"
❌ **Worse:** Open Hot Leads view → manually filter

✅ **Good:** "Create a note on Stripe: discussed ROI, waiting on approval"
❌ **Worse:** Click into Stripe record → click Notes → create note

✅ **Good:** "Find all companies in the logistics space with 50-200 employees"
❌ **Worse:** Open People → filter by company → check each company manually

### Approval Flow
- **Read ops** (search, view): Auto-approved, instant results
- **Write ops** (create, update): Request confirmation, you approve once per session

---

## Troubleshooting

### Sync shows 0 contacts
- [ ] Import script ran? (should show "✅ Created: 105/105")
- [ ] Check Vercel logs: `https://vercel.com/dashboard/huza-attio-sync`
- [ ] Verify ATTIO_API_KEY is correct: `cat ~/.config/attio/api_key`

### Engagement fields empty after tomorrow 8 AM
- [ ] Check Vercel logs for errors
- [ ] Verify Apollo data exists (check Apollo app for the 105 contacts)
- [ ] Manually trigger sync: `curl -X POST https://huza-attio-sync.vercel.app/api/sync -H "Authorization: Bearer CRON_SECRET"`

### MCP not finding contacts
- [ ] Confirm OAuth login with Attio account completed
- [ ] Verify contacts exist in Attio (People object)
- [ ] Try simpler query first: "Show me all contacts"

### Want to change Apollo list ID
- [ ] Update Vercel env var: `APOLLO_LIST_ID=new_list_id`
- [ ] Re-run import script with new list ID
- [ ] Next sync will auto-import from new list

---

## Resources

| Resource | Purpose | Link |
|----------|---------|------|
| Attio Support | Table views, filters, attributes | https://attio.com/help |
| Attio API Docs | REST API reference | https://docs.attio.com/rest-api |
| Attio MCP Docs | AI integration, available tools | https://docs.attio.com/mcp |
| Sync Code | huza-attio-sync repo | https://github.com/dotun26/huza-attio-sync |

---

## What's Next?

After this setup:

**Week 1:**
- Views populated with engagement data ✅
- Team has Attio access ✅
- MCP connected to Claude ✅

**Week 2-4:**
- Use Hot Leads view to book meetings
- Log all interactions in Attio
- Monitor reply rate improving

**Month 2:**
- Set up Attio workflows (auto-create deals on reply)
- Expand to company-level tracking
- Integrate with your sales tools

---

**Status:** You're now following Attio best practices. 🚀
