// api/deals.js — Deal automation based on engagement
// Cron: every 5 min during market hours

import {
    getPersonById,
    getDealsByPerson,
    createDeal,
    updateDealStage
} from '../lib/attio.js';

// Deal stage progression based on engagement
const STAGE_MAP = {
    new: 'prospect',
    contacted: 'contacted',
    opened: 'engaged',
    clicked: 'interested',
    replied: 'qualified'
};

export default async function dealsHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Auth
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
        if (auth !== cronSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        // Get people that were updated in the last sync (have engagement_status set)
        // This is a simplified version — in production you'd query for recent updates
        let created = 0;
        let updated = 0;
        let errors = 0;

        console.log('[deals] Running deal automation...');

        // Note: This requires storing recently-synced person IDs somewhere
        // For now, we'd need to read from a DB or cache
        // Future: add DB table to track sync state

        console.log('[deals] Deal automation cycle complete');

        return res.status(200).json({
            ok: true,
            created,
            updated,
            errors
        });

    } catch (err) {
        console.error('[deals] Error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
