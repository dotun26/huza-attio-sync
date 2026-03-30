#!/usr/bin/env node
// sync.js — Apollo sequence → Attio engagement sync (GitHub Actions runner)
// No timeout constraints here. Run as: node sync.js

'use strict';

const https = require('https');

const APOLLO_KEY  = process.env.APOLLO_API_KEY;
const ATTIO_KEY   = process.env.ATTIO_API_KEY;
const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT     = process.env.TELEGRAM_CHAT_ID;
const SEQUENCE_ID = '698b3bdb6b7cef0021601884';

if (!APOLLO_KEY) { console.error('❌ APOLLO_API_KEY missing'); process.exit(1); }
if (!ATTIO_KEY)  { console.error('❌ ATTIO_API_KEY missing');  process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function request(hostname, method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = https.request({
            hostname, method, path,
            headers: { 'Content-Type': 'application/json', 'Content-Length': payload ? Buffer.byteLength(payload) : 0, ...headers },
            timeout: 30000
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (payload) req.write(payload);
        req.end();
    });
}

const apollo = (method, path, body) =>
    request('api.apollo.io', method, path, body, { 'X-Api-Key': APOLLO_KEY });

const attio = (method, path, body) =>
    request('api.attio.com', method, path, body, { 'Authorization': `Bearer ${ATTIO_KEY}` });

const telegram = text =>
    request('api.telegram.org', 'POST', `/bot${TG_TOKEN}/sendMessage`,
        { chat_id: TG_CHAT, text }, {}).catch(() => {});

// Pull all contacts from Apollo sequence
async function getSequenceContacts() {
    const contacts = [];
    let page = 1;

    while (true) {
        const r = await apollo('POST', '/api/v1/contacts/search', {
            emailer_campaign_ids: [SEQUENCE_ID],
            per_page: 100,
            page
        });
        if (r.status !== 200) { console.log(`  ⚠️  Apollo search page ${page}: ${r.status}`); break; }
        const batch = r.body?.contacts || [];
        contacts.push(...batch);
        console.log(`  Page ${page}: ${batch.length} contacts (total: ${contacts.length})`);
        if (batch.length < 100) break;
        page++;
        await sleep(300);
    }
    return contacts;
}

// Find Attio person by email
async function findAttioPerson(email) {
    const r = await attio('POST', '/v2/objects/people/records/query', {
        filter: { email_addresses: { email_address: { '$eq': email } } },
        limit: 1
    });
    if (r.status !== 200) return null;
    return r.body?.data?.[0] || null;
}

// Update Attio person engagement
async function updateAttioEngagement(recordId, values) {
    const r = await attio('PATCH', `/v2/objects/people/records/${recordId}`, { data: { values } });
    return r.status === 200;
}

function deriveEngagement(contact) {
    const status    = contact.contact_campaign_statuses?.[0];
    const seq       = status?.status || 'unknown';
    const reason    = (status?.inactive_reason || '').toLowerCase();
    const addedAt   = status?.added_at;
    const finishedAt = status?.finished_at;

    let engStatus = 'in_sequence';
    if (seq === 'finished') {
        if (reason.includes('replied'))   engStatus = 'replied';
        else if (reason.includes('bounce')) engStatus = 'bounced';
        else                               engStatus = 'completed';
    } else if (seq === 'paused') engStatus = 'paused';
    else if (seq === 'not_sent') engStatus = 'not_sent';

    const daysSince = addedAt
        ? Math.floor((Date.now() - new Date(addedAt)) / 86400000)
        : null;

    const values = {
        engagement_status: [{ value: engStatus }]
    };
    if (daysSince !== null) values.days_since_contact = [{ value: daysSince }];
    if (finishedAt || addedAt) values.last_engaged = [{ value: finishedAt || addedAt }];

    return values;
}

async function main() {
    console.log('🔄 Apollo → Attio sync starting...\n');
    const start = Date.now();

    // 1. Get all contacts from sequence
    console.log('📋 Fetching Apollo sequence contacts...');
    const contacts = await getSequenceContacts();
    console.log(`\n✅ ${contacts.length} contacts found\n`);

    // 2. Match & update each
    let synced = 0, notFound = 0, errors = 0;

    for (const contact of contacts) {
        const email = contact.email;
        if (!email) { notFound++; continue; }

        const name = contact.name || email;

        try {
            const person = await findAttioPerson(email);
            if (!person) {
                console.log(`  👻 ${name} — not in Attio`);
                notFound++;
                await sleep(100);
                continue;
            }

            const values = deriveEngagement(contact);
            const ok = await updateAttioEngagement(person.id.record_id, values);
            if (ok) {
                console.log(`  ✅ ${name} — ${values.engagement_status[0].value}`);
                synced++;
            } else {
                console.log(`  ❌ ${name} — Attio update failed`);
                errors++;
            }
        } catch (e) {
            console.log(`  ❌ ${name} — ${e.message}`);
            errors++;
        }

        await sleep(250);
    }

    const duration = Math.round((Date.now() - start) / 1000);
    const summary = `📊 Attio sync complete\n✅ ${synced} updated\n👻 ${notFound} not in Attio\n❌ ${errors} errors\n⏱ ${duration}s`;
    console.log(`\n${summary}`);

    if (TG_TOKEN && TG_CHAT) await telegram(summary);
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    if (TG_TOKEN && TG_CHAT) telegram(`⚠️ Attio sync failed: ${err.message}`).catch(() => {});
    process.exit(1);
});
