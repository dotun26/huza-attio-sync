// api/sync.js — Daily Apollo → Attio engagement sync
// Cron: 06:00 UTC (8 AM Kigali / GMT+2)

import {
    getAllPeople,
    updatePersonEngagement,
    getApolloPersonEngagement,
    calculateEngagementStatus,
    calculateEngagementScore,
    calculateDaysSinceContact,
    calculateNextFollowup,
    importApolloListToAttio
} from '../lib/attio.js';

export default async function syncHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Auth: CRON_SECRET from environment
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
        if (auth !== cronSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const start = Date.now();
        let synced = 0;
        let created = 0;
        let errors = 0;

        // Get all people from Attio
        console.log('[sync] Fetching people from Attio...');
        const people = await getAllPeople(100);
        let withApollo = people.filter(p => p.values?.nddl_apollo_person_id);
        console.log(`[sync] Found ${withApollo.length} people with Apollo IDs`);

        // Auto-import Apollo list on first run (0 contacts)
        if (withApollo.length === 0) {
            const listId = process.env.APOLLO_LIST_ID;
            if (listId) {
                console.log(`[sync] No Apollo contacts found — importing from Apollo list ${listId}...`);
                const importResult = await importApolloListToAttio(listId);
                console.log(`[sync] Import result: ${importResult.imported} created`);
            } else {
                console.log('[sync] No Apollo contacts and APOLLO_LIST_ID not set — skipping import');
            }
            
            // Re-fetch after import
            const peopleAfterImport = await getAllPeople(100);
            withApollo = peopleAfterImport.filter(p => p.values?.nddl_apollo_person_id);
            console.log(`[sync] After import: ${withApollo.length} people with Apollo IDs`);
        }

        // Process each person
        for (const person of withApollo) {
            try {
                const apolloId = Array.isArray(person.values.nddl_apollo_person_id)
                    ? person.values.nddl_apollo_person_id[0]
                    : person.values.nddl_apollo_person_id;

                if (!apolloId) continue;

                // Fetch engagement from Apollo
                const apolloData = await getApolloPersonEngagement(apolloId);
                if (!apolloData) continue;

                // Calculate derived fields
                const status = calculateEngagementStatus(apolloData);
                const score = calculateEngagementScore(apolloData);
                const daysSinceContact = calculateDaysSinceContact(apolloData.lastEngaged);
                const nextFollowup = calculateNextFollowup(apolloData, daysSinceContact);

                // Update in Attio
                const updated = await updatePersonEngagement(person.id, {
                    status,
                    score,
                    emailsSent: apolloData.emailsSent,
                    opens: apolloData.opens,
                    clicks: apolloData.clicks,
                    lastEngaged: apolloData.lastEngaged,
                    daysSinceContact,
                    nextFollowupDate: nextFollowup
                });

                if (updated) synced++;
            } catch (e) {
                console.error(`[sync] Error processing person:`, e.message);
                errors++;
            }
        }

        const duration = Math.round((Date.now() - start) / 1000);
        console.log(`[sync] Complete: ${synced} synced, ${errors} errors, ${duration}s`);

        return res.status(200).json({
            ok: true,
            synced,
            errors,
            total: withApollo.length,
            durationSec: duration
        });

    } catch (err) {
        console.error('[sync] Fatal error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
