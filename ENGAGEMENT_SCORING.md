# Engagement Scoring System

## Status Progression

Each contact moves through engagement stages based on Apollo metrics:

```
New → Contacted → Opened → Clicked → Replied
     (email 1)   (open)   (click)   (reply)
```

**Stalled** is a separate state for contacts with no engagement in 7+ days after first email.

## Score Calculation

Engagement Score = 0-100 range

**Formula:**
```
Score = (Opens × 10) + (Clicks × 25) + (Replied × 50)
```

**Examples:**
- Opened 1 email: 10 points
- Opened 3 emails: 30 points
- Opened + clicked 1: 35 points
- Opened + clicked + replied: 85 points

**Interpretation:**
- 0-20: Low engagement (contacted but not opening)
- 20-40: Mild interest (opening but not clicking)
- 40-70: Active interest (opening and clicking)
- 70+: Strong interest (clicked and/or replied)

## Follow-up Logic

**Next Follow-up Date** is calculated as:
- If replied: No follow-up needed (move to Qualified deal stage)
- If opened: Follow up in 7 days
- If not opened: Follow up in 14 days
- If no emails sent: No follow-up (wait for sequence)

## Status Transitions

```
Status updates whenever Apollo data changes:

NEW
  ↓ (first email sent)
CONTACTED
  ↓ (email opened)
OPENED
  ↓ (link clicked)
CLICKED
  ↓ (reply received)
REPLIED (final state)

OR if no engagement for 7+ days:
CONTACTED/OPENED/CLICKED → STALLED
```

## Integration with Deals

Attio deals move through stages based on engagement status:

| Engagement Status | Deal Stage |
|---|---|
| New | Prospect |
| Contacted | Contacted |
| Opened | Engaged |
| Clicked | Interested |
| Replied | Qualified |
| Stalled | On Hold / Nurture |

## Real-World Example

Contact: John (john@company.com)

**Day 1:** Sequence email 1 sent
- Status: Contacted (1/10 score)
- Next follow-up: Day 14

**Day 3:** Email 1 opened
- Status: Opened (10/100 score)
- Next follow-up: Day 10 (7 days from now)

**Day 5:** Email 2 sent + clicked
- Status: Clicked (35/100 score)
- Next follow-up: Day 10

**Day 8:** Email 3 sent
- Status: Clicked (35/100 score)
- Next follow-up: Day 10

**Day 11:** Replied to email 3
- Status: Replied (85/100 score)
- Next follow-up: None (move to "Qualified" deal stage)
- Action: Sales team reaches out for discovery call

## Customization

To adjust scoring weights, edit `calculateEngagementScore()` in `lib/attio.js`:

```javascript
export function calculateEngagementScore(apolloData) {
    return (apolloData.opens * 10) +      // <- change this
           (apolloData.clicks * 25) +      // <- or this
           (apolloData.hasReplied ? 50 : 0); // <- or this
}
```

## Notes

- Scores are cumulative (opens + clicks + replies all count together)
- A contact with 0 emails sent has a score of 0 (they're not in the sequence yet)
- Replies are the highest weight because they indicate genuine interest
- Follow-up dates are auto-calculated and updated daily by the sync
