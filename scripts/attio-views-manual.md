# Create Attio Views Manually (UI Walkthrough)

Since Attio API doesn't support view creation, these are exact steps to set up in the UI.

---

## View 1: Engagement Status

1. Go to **Attio** → **People** → **+ View** button (top left)
2. Name: **Engagement Status**
3. Click **Customize columns**
   - Add: Name
   - Add: Engagement Status
   - Add: Engagement Score
   - Add: Opens
   - Add: Clicks
   - Add: Has Replied
   - Add: Last Engaged
   - Add: Days Since Contact
4. Click **Sort** → Sort by **Engagement Score** (Descending)
5. **Save**

---

## View 2: Hot Leads

1. **+ View** → Name: **Hot Leads**
2. **Filter** → Add Filter
   - Engagement Status = "Replied" OR "Clicked"
3. **Customize columns**
   - Name
   - Engagement Status
   - Engagement Score
   - Opens
   - Clicks
   - Last Engaged
4. **Sort** → Engagement Score (Descending)
5. **Save**

---

## View 3: Stalled Contacts

1. **+ View** → Name: **Stalled Contacts**
2. **Filter** → Add Filter
   - Days Since Contact > 14
   - AND Engagement Status ≠ "Replied"
3. **Customize columns**
   - Name
   - Engagement Status
   - Days Since Contact
   - Last Engaged
   - Next Follow-up Date
4. **Sort** → Days Since Contact (Descending)
5. **Save**

---

## View 4: New Prospects

1. **+ View** → Name: **New Prospects**
2. **Filter** → Add Filter
   - Engagement Status = "New" OR "Contacted"
3. **Customize columns**
   - Name
   - Company (Apollo Org Name)
   - Location (Apollo Location)
   - Headline (Apollo Headline)
   - Engagement Status
   - Date Added
4. **Sort** → Date Added (Newest First)
5. **Save**

---

## Expected Timeline

After import script runs:
- **Today:** Views exist but empty (0 contacts in Attio yet)
- **Tomorrow 8 AM Kigali:** First daily sync populates 105 contacts + engagement data
- **Views light up** with real engagement metrics

---

## QuickCheck: Before Creating Views

Run the import first:
```bash
APOLLO_API_KEY=KlGUfx8Gpr05VGCea0wEIA \
ATTIO_API_KEY=$(cat ~/.config/attio/api_key) \
APOLLO_LIST_ID=69a6f14a2d016c0011ddf7ed \
node /Users/macbook-xl/.openclaw/workspace/huza-attio-sync/scripts/import-apollo-list.js
```

Then create views. Views will be empty until tomorrow's 8 AM sync.
