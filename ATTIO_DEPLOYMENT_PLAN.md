# Attio Deployment Best Practices

Based on Attio support docs, API docs, and MCP documentation.

---

## 1. Data Model Foundation

### Objects & Relationships
**Attio native objects:**
- **People** (contacts)
  - Core attributes: name, email, phone, title, location
  - Linked to: Companies (via relationship)
  - Apollo integration: apollo_person_id, headline, organization
- **Companies** (organizations)  
  - Core attributes: name, domain, employee_count, industry
  - Linked to: People (employees)
  - Apollo integration: apollo_org_name, location, funding_stage
- **Deals** (sales opportunities)
  - Linked to: People (decision maker), Companies (target org)
  - Stages: Prospect → Contacted → Interested → Qualified → Won/Lost

### Custom Attributes (Engagement Fields)
Already created on People object:
- `nddl_engagement_status` (single select: New, Contacted, Opened, Clicked, Replied)
- `nddl_engagement_score` (number: 0-100)
- `nddl_opens` (number)
- `nddl_clicks` (number)
- `nddl_engagement_replied` (checkbox)
- `nddl_last_engaged` (date)
- `nddl_days_since_contact` (number)
- `nddl_sequence_step` (number)
- `nddl_next_followup_date` (date)

---

## 2. Views (UI Organization)

### Create 4 Table Views in Attio UI

**View 1: Engagement Status** (Primary view)
- **Path:** People → + Create new → Table
- **Columns:** Name, Company (linked), Engagement Status, Engagement Score, Opens, Clicks, Last Engaged, Days Since Contact
- **Filters:** None (all contacts)
- **Sort:** Engagement Score (Descending)
- **Purpose:** Dashboard of all 105 contacts ranked by engagement

**View 2: Hot Leads** (Sales focus)
- **Columns:** Name, Company, Title (headline), Engagement Score, Last Engaged, Next Follow-up Date
- **Filters:** Engagement Status = "Replied" OR "Clicked"
- **Sort:** Engagement Score (Descending)
- **Purpose:** High-priority contacts ready for outreach/calls

**View 3: Stalled Contacts** (Follow-up needed)
- **Columns:** Name, Company, Days Since Contact, Last Engaged, Next Follow-up Date, Engagement Status
- **Filters:** Days Since Contact > 14 AND Engagement Status ≠ "Replied"
- **Sort:** Days Since Contact (Descending)
- **Purpose:** Identify contacts to re-engage or disqualify

**View 4: New Prospects** (Pipeline building)
- **Columns:** Name, Company, Headline, Location, Engagement Status, Date Added
- **Filters:** Engagement Status = "New" OR "Contacted"
- **Sort:** Date Added (Newest First)
- **Purpose:** Plan outreach for next batch

---

## 3. Integration Layer

### Option A: Attio MCP (Recommended)
**Best practice:** Use Attio MCP for AI-native CRM management.

**Setup:**
1. Connect Attio MCP to Claude/ChatGPT
2. Use natural language for:
   - Searching: "Show me all hot leads at tech companies"
   - Creating: "Add a new person: John Doe, VP Engineering at Stripe"
   - Updating: "Update Sarah's contact with her new company: Linear"
   - Logging: "Create a note on the Notion account about our demo call"

**Advantages:**
- AI handles complex searches (vs. manual filters)
- Natural language CRM interactions
- Built-in approval flows (write ops request confirmation)
- No custom API maintenance needed

**Implementation:**
- OAuth with your Attio account
- No API keys to manage
- Secure by design (tied to your user permissions)

### Option B: REST API (Custom Integrations)
**Use case:** Programmatic contact creation, bulk updates, external system sync.

**Current setup:**
- `huza-attio-sync` handles Apollo → Attio engagement sync
- Runs daily at 8 AM Kigali
- REST API for contact creation, field updates

**Endpoints:**
- Create/update people: `POST /v2/objects/people/records`
- Search records: `GET /v2/objects/{object_id}/records`
- Update engagement: `PATCH /v2/objects/{object_id}/records/{record_id}`

---

## 4. Data Flow & Sync

### Daily Engagement Sync (Production)
**System:** `huza-attio-sync` (Vercel)
- **Trigger:** 06:00 UTC (8 AM Kigali) daily via Vercel cron
- **Source:** Apollo engagement metrics (opens, clicks, replies)
- **Target:** Attio People records (engagement fields)
- **Logic:**
  1. Fetch all People with Apollo IDs
  2. Query Apollo for engagement per contact
  3. Calculate: status, score, days_since_contact, next_followup
  4. Batch update Attio People records
  5. Log results to Vercel function logs

**Process:**
```
Apollo Engagement Data
        ↓
    /api/sync (cron 8 AM Kigali)
        ↓
Calculate Metrics (status, score)
        ↓
Update Attio People Records
        ↓
Views Auto-Refresh
```

### First-Time Setup
1. Run import script to add 105 contacts to Attio
2. First cron sync populates engagement data
3. Views show real data starting tomorrow

---

## 5. Workflows & Automation (Future)

**Attio native workflows** (if available on your plan):
- **Trigger:** Engagement Status changes to "Replied"
  - **Action:** Create Deal record, notify team via Slack
- **Trigger:** Days Since Contact > 30 AND Status ≠ "Replied"
  - **Action:** Flag for review, create follow-up task
- **Trigger:** Engagement Score > 75
  - **Action:** Move to "Hot" list, schedule call task

(Check Attio account for workflow availability)

---

## 6. Security & Access

### Authentication
- **API:** REST API keys stored in env vars (`ATTIO_API_KEY`)
- **MCP:** OAuth via Attio account (no keys needed)
- **Views:** User permissions in Attio workspace

### Data Access Control
- Sync runs as workspace user (tied to API key)
- MCP requests authenticated as your Attio user
- All operations auditable in Attio activity logs

---

## 7. Documentation & Team Handoff

### For Your Team:
**File:** `ATTIO_USER_GUIDE.md` (create in workspace)
- How to use each view
- When to check Hot Leads vs Stalled vs New
- How to log notes/updates
- Link to Attio support docs

### For Developers:
**File:** `ATTIO_INTEGRATION_GUIDE.md`
- How sync works (Apollo → Attio)
- API endpoints available
- MCP setup instructions
- Troubleshooting common issues

---

## 8. Rollout Steps

### Phase 1: Setup (Today)
- [ ] Import 105 Apollo contacts to Attio
- [ ] Verify engagement fields synced (tomorrow 8 AM)
- [ ] Create 4 table views in Attio UI

### Phase 2: Integration (This Week)
- [ ] Connect Attio MCP to Claude (for AI queries)
- [ ] Test MCP: "Show me hot leads"
- [ ] Set up team access to views

### Phase 3: Optimization (Next Week)
- [ ] Monitor engagement sync accuracy
- [ ] Set up Attio workflows (if available)
- [ ] Create team documentation

### Phase 4: Scale (Ongoing)
- [ ] Add new contacts to Apollo list
- [ ] Auto-import via sync (APOLLO_LIST_ID configurable)
- [ ] Expand to deals/companies as needed

---

## 9. Tools & Resources

| Tool | Purpose | URL |
|------|---------|-----|
| **Attio Support** | Views, filters, attributes, workflows | https://attio.com/help |
| **Attio API Docs** | REST API reference, create/update records | https://docs.attio.com/rest-api |
| **Attio MCP** | AI-native CRM via Claude/ChatGPT | https://docs.attio.com/mcp |
| **huza-attio-sync** | Daily engagement sync (Apollo → Attio) | https://github.com/dotun26/huza-attio-sync |

---

## 10. KPIs & Monitoring

**Weekly Review:**
- Engagement Score distribution (are contacts moving to "Replied"?)
- Hot Leads count (trend over time)
- Stalled count (at-risk contacts)
- Sync accuracy (compare Apollo data vs Attio fields)

**Monthly Review:**
- Reply rate % (Replied / Total)
- Time to first engagement (average Days Since Contact → Opened)
- Pipeline stage progression (New → Contacted → Replied → Deal)

---

## Summary

**Best Practices Implemented:**
✅ Proper data model (People, Companies, Deals with relationships)
✅ Native Attio views per support documentation
✅ Daily REST API sync (Apollo → Attio)
✅ MCP integration for AI-native queries
✅ Security via OAuth + API key management
✅ Documented workflows for team use
✅ Monitoring & KPIs for accountability

**No Custom API Hacks:**
- ❌ Removed `/api/dashboard` (redundant with Attio views + MCP)
- ✅ Use Attio views + MCP for all querying needs
- ✅ Keep REST API for sync only (its proper purpose)

**Next:** Import contacts + set up views + connect MCP to Claude = production-ready Attio.
