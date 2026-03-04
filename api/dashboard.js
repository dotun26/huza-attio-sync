import { getAllPeople, getApolloPersonEngagement } from '../lib/attio.js';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
    // Security: allow both API calls and CRON
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (auth !== CRON_SECRET && req.query.key !== CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const view = req.query.view || 'engagement-status';
        const limit = parseInt(req.query.limit) || 50;

        // Fetch all people
        const people = await getAllPeople(500);
        const withApollo = people.filter(p => p.values?.nddl_apollo_person_id);

        // Apply filters & sorting based on view
        let filtered = withApollo;

        switch (view) {
            case 'hot-leads':
                // Engagement Status = Replied or Clicked
                filtered = withApollo.filter(p => {
                    const status = p.values?.nddl_engagement_status?.[0]?.text || '';
                    return status === 'Replied' || status === 'Clicked';
                });
                filtered.sort((a, b) => (b.values?.nddl_engagement_score?.[0]?.text || 0) - (a.values?.nddl_engagement_score?.[0]?.text || 0));
                break;

            case 'stalled':
                // Days Since Contact > 14, not Replied
                filtered = withApollo.filter(p => {
                    const days = parseInt(p.values?.nddl_days_since_contact?.[0]?.text || 0);
                    const status = p.values?.nddl_engagement_status?.[0]?.text || '';
                    return days > 14 && status !== 'Replied';
                });
                filtered.sort((a, b) => (b.values?.nddl_days_since_contact?.[0]?.text || 0) - (a.values?.nddl_days_since_contact?.[0]?.text || 0));
                break;

            case 'new':
                // Status = New or Contacted
                filtered = withApollo.filter(p => {
                    const status = p.values?.nddl_engagement_status?.[0]?.text || '';
                    return status === 'New' || status === 'Contacted';
                });
                break;

            case 'engagement-status':
            default:
                // Sort by engagement score (descending)
                filtered.sort((a, b) => (b.values?.nddl_engagement_score?.[0]?.text || 0) - (a.values?.nddl_engagement_score?.[0]?.text || 0));
                break;
        }

        // Format response
        const results = filtered.slice(0, limit).map(p => ({
            id: p.id,
            name: p.values?.name?.[0]?.text || 'Unknown',
            status: p.values?.nddl_engagement_status?.[0]?.text || 'New',
            score: p.values?.nddl_engagement_score?.[0]?.text || 0,
            opens: p.values?.nddl_opens?.[0]?.text || 0,
            clicks: p.values?.nddl_clicks?.[0]?.text || 0,
            replied: p.values?.nddl_engagement_replied?.[0]?.checked || false,
            lastEngaged: p.values?.nddl_last_engaged?.[0]?.text || null,
            daysSinceContact: p.values?.nddl_days_since_contact?.[0]?.text || null,
            company: p.values?.nddl_apollo_org_name?.[0]?.text || null,
            headline: p.values?.nddl_apollo_headline?.[0]?.text || null,
        }));

        return res.status(200).json({
            ok: true,
            view,
            total: withApollo.length,
            filtered: filtered.length,
            limit,
            results
        });
    } catch (e) {
        console.error('[dashboard] error:', e.message);
        return res.status(500).json({ error: e.message });
    }
}
