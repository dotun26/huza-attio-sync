// api/sync.js — Apollo sequence → Attio engagement sync
// Correct flow: pull contacts from Apollo sequence → match to Attio by email → update fields

const APOLLO_BASE = 'https://api.apollo.io/api/v1';
const ATTIO_BASE  = 'https://api.attio.com/v2';
const SEQUENCE_ID = '698b3bdb6b7cef0021601884';

function apolloHeaders() {
    return { 'Content-Type': 'application/json', 'X-Api-Key': process.env.APOLLO_API_KEY };
}
function attioHeaders() {
    return { 'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`, 'Content-Type': 'application/json' };
}

async function post(url, body, headers) {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function patch(url, body, headers) {
    const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

// Step 1: Pull all contacts from Apollo sequence (paginated)
async function getSequenceContacts() {
    const contacts = [];
    let page = 1;

    while (true) {
        const r = await post(`${APOLLO_BASE}/contacts/search`, {
            emailer_campaign_ids: [SEQUENCE_ID],
            per_page: 100,
            page
        }, apolloHeaders());

        if (r.status !== 200) break;
        const batch = r.body?.contacts || [];
        contacts.push(...batch);
        if (batch.length < 100) break;
        page++;
        await sleep(300);
    }

    return contacts;
}

// Step 2: Find Attio person by email
async function findAttioPerson(email) {
    const r = await post(`${ATTIO_BASE}/objects/people/records/query`, {
        filter: {
            email_addresses: { $eq: email }
        },
        limit: 1
    }, attioHeaders());

    return r.body?.data?.[0] || null;
}

// Step 3: Update Attio person engagement fields
async function updateAttioEngagement(recordId, fields) {
    const r = await patch(
        `${ATTIO_BASE}/objects/people/records/${recordId}`,
        { data: { values: fields } },
        attioHeaders()
    );
    return r.status === 200;
}

// Derive engagement fields from Apollo contact data
function deriveEngagement(contact) {
    const status = contact.contact_campaign_statuses?.[0];
    const sequenceStatus = status?.status || 'unknown';
    const inactiveReason = status?.inactive_reason || null;
    const addedAt = status?.added_at || null;
    const finishedAt = status?.finished_at || null;

    // Determine readable status
    let engagementStatus = 'in_sequence';
    if (sequenceStatus === 'finished') {
        if (inactiveReason?.toLowerCase().includes('replied')) engagementStatus = 'replied';
        else if (inactiveReason?.toLowerCase().includes('bounced')) engagementStatus = 'bounced';
        else engagementStatus = 'completed';
    } else if (sequenceStatus === 'paused') {
        engagementStatus = 'paused';
    } else if (sequenceStatus === 'not_sent') {
        engagementStatus = 'not_sent';
    }

    // Days since added
    const daysSinceAdded = addedAt
        ? Math.floor((Date.now() - new Date(addedAt)) / 86400000)
        : null;

    return {
        engagement_status: [{ value: engagementStatus }],
        days_since_contact: daysSinceAdded,
        last_engaged: finishedAt || addedAt
            ? { value: (finishedAt || addedAt) }
            : undefined,
        sequence_step: status?.current_step_id
            ? [{ value: String(contact.emailer_campaign_ids?.length || 1) }]
            : undefined
    };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function syncHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!process.env.APOLLO_API_KEY) return res.status(500).json({ error: 'APOLLO_API_KEY missing' });
    if (!process.env.ATTIO_API_KEY)  return res.status(500).json({ error: 'ATTIO_API_KEY missing' });

    const start = Date.now();
    console.log('[sync] Starting Apollo → Attio sync');

    try {
        // 1. Pull all contacts from sequence
        const contacts = await getSequenceContacts();
        console.log(`[sync] ${contacts.length} contacts in sequence`);

        let synced = 0, notFound = 0, errors = 0;

        for (const contact of contacts) {
            const email = contact.email;
            if (!email) { notFound++; continue; }

            try {
                // 2. Find in Attio by email
                const attioPerson = await findAttioPerson(email);
                if (!attioPerson) { notFound++; await sleep(150); continue; }

                // 3. Derive and push engagement data
                const fields = deriveEngagement(contact);
                const ok = await updateAttioEngagement(attioPerson.id.record_id, fields);
                if (ok) synced++;
                else errors++;
            } catch (e) {
                console.error(`[sync] Error on ${email}:`, e.message);
                errors++;
            }

            await sleep(200); // Attio rate limit
        }

        const duration = Math.round((Date.now() - start) / 1000);
        const summary = { ok: true, total: contacts.length, synced, notFound, errors, durationSec: duration };
        console.log('[sync] Done:', summary);

        // Telegram summary
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const msg = `📊 Attio sync complete\n✅ ${synced} updated\n❌ ${errors} errors\n👻 ${notFound} not in Attio\n⏱ ${duration}s`;
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg })
            }).catch(() => {});
        }

        return res.status(200).json(summary);

    } catch (err) {
        console.error('[sync] Fatal:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
