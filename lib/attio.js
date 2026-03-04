// lib/attio.js — Attio REST API client

const ATTIO_BASE = 'https://api.attio.com/v2';
const APOLLO_BASE = 'https://api.apollo.io/v1';
const ATTIO_KEY = process.env.ATTIO_API_KEY;
const APOLLO_KEY = process.env.APOLLO_API_KEY;

const ATTIO_HEADERS = {
    'Authorization': `Bearer ${ATTIO_KEY}`,
    'Content-Type': 'application/json'
};

const APOLLO_HEADERS = {
    'Content-Type': 'application/json',
    'X-Api-Key': APOLLO_KEY
};

// Get all people from Attio (with pagination)
export async function getAllPeople(limit = 500) {
    const people = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const url = new URL(`${ATTIO_BASE}/objects/people/records`);
            url.searchParams.set('limit', limit);
            url.searchParams.set('offset', offset);
            console.log(`[attio] Fetching people offset ${offset}...`);
            const res = await fetch(url.toString(), { headers: ATTIO_HEADERS });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            const batch = data.data || [];
            people.push(...batch);
            console.log(`[attio] Got ${batch.length} people (total: ${people.length})`);
            hasMore = data.pagination?.has_more || false;
            offset += limit;
            if (batch.length === 0) hasMore = false;
        } catch (e) {
            console.error('[attio] getAllPeople error:', e.message);
            break;
        }
    }
    console.log(`[attio] Fetched total: ${people.length} people`);
    return people;
}

// Get a person record by ID
export async function getPersonById(recordId) {
    try {
        const res = await fetch(`${ATTIO_BASE}/objects/people/records/${recordId}`, {
            headers: ATTIO_HEADERS
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.data;
    } catch (_) {
        return null;
    }
}

// Update a person's engagement data
export async function updatePersonEngagement(recordId, engagement) {
    try {
        const values = {};
        if (engagement.status) values.engagement_status = [{ id: engagement.status }];
        if (engagement.score !== undefined) values.engagement_score = engagement.score;
        if (engagement.emailsSent !== undefined) values.emails_sent = engagement.emailsSent;
        if (engagement.opens !== undefined) values.engagement_opens = engagement.opens;
        if (engagement.clicks !== undefined) values.engagement_clicks = engagement.clicks;
        if (engagement.lastEngaged) values.last_engaged = engagement.lastEngaged;
        if (engagement.daysSinceContact !== undefined) values.days_since_contact = engagement.daysSinceContact;
        if (engagement.sequenceStep) values.sequence_step = [{ id: String(engagement.sequenceStep) }];
        if (engagement.nextFollowupDate) values.next_followup_date = engagement.nextFollowupDate;

        const res = await fetch(`${ATTIO_BASE}/objects/people/records/${recordId}`, {
            method: 'PUT',
            headers: ATTIO_HEADERS,
            body: JSON.stringify({ data: { values } })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
    } catch (e) {
        console.error(`[attio] updatePersonEngagement error:`, e.message);
        return null;
    }
}

// Fetch a person's engagement from Apollo
export async function getApolloPersonEngagement(apolloPersonId) {
    try {
        const res = await fetch(
            `${APOLLO_BASE}/people/${apolloPersonId}`,
            { headers: APOLLO_HEADERS }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const p = data.person;
        if (!p) return null;

        return {
            emailsSent: p.email_status_updates?.length || 0,
            opens: p.email_opens_count || 0,
            clicks: p.email_clicks_count || 0,
            replies: p.email_status === 'verified' ? 1 : 0,
            lastEngaged: p.last_activity_date ? new Date(p.last_activity_date).toISOString() : null,
            hasReplied: p.verified_at ? true : false
        };
    } catch (e) {
        console.error('[attio] getApolloPersonEngagement error:', e.message);
        return null;
    }
}

// Get all deals associated with a person
export async function getDealsByPerson(personId) {
    try {
        const url = new URL(`${ATTIO_BASE}/objects/deals/records`);
        url.searchParams.set('filter', JSON.stringify({
            attribute_id: 'associated_people',
            condition: 'contains',
            value: personId
        }));
        const res = await fetch(url.toString(), { headers: ATTIO_HEADERS });
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
    } catch (_) {
        return [];
    }
}

// Create a deal for a person
export async function createDeal(personId, dealName, stage = 'prospect') {
    try {
        const res = await fetch(`${ATTIO_BASE}/objects/deals/records`, {
            method: 'POST',
            headers: ATTIO_HEADERS,
            body: JSON.stringify({
                data: {
                    values: {
                        name: dealName,
                        stage: [{ id: stage }],
                        associated_people: [{ record_id: personId }]
                    }
                }
            })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return data.data;
    } catch (e) {
        console.error('[attio] createDeal error:', e.message);
        return null;
    }
}

// Update a deal's stage
export async function updateDealStage(dealId, newStage) {
    try {
        const res = await fetch(`${ATTIO_BASE}/objects/deals/records/${dealId}`, {
            method: 'PUT',
            headers: ATTIO_HEADERS,
            body: JSON.stringify({
                data: {
                    values: {
                        stage: [{ id: newStage }]
                    }
                }
            })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
    } catch (e) {
        console.error('[attio] updateDealStage error:', e.message);
        return null;
    }
}

// Summary stats for reporting
export function calculateEngagementStatus(apolloData) {
    if (apolloData.hasReplied) return 'replied';
    if (apolloData.clicks > 0) return 'clicked';
    if (apolloData.opens > 0) return 'opened';
    if (apolloData.emailsSent > 0) return 'contacted';
    return 'new';
}

export function calculateEngagementScore(apolloData) {
    return (apolloData.opens * 10) + (apolloData.clicks * 25) + (apolloData.hasReplied ? 50 : 0);
}

export function calculateDaysSinceContact(lastEngagedStr) {
    if (!lastEngagedStr) return null;
    const lastEngaged = new Date(lastEngagedStr);
    return Math.floor((Date.now() - lastEngaged) / (24 * 60 * 60 * 1000));
}

export function calculateNextFollowup(apolloData, daysSinceContact) {
    if (apolloData.hasReplied) return null; // Don't follow up replied contacts
    if (!apolloData.lastEngaged) return null;

    const lastEngaged = new Date(apolloData.lastEngaged);
    const followupDaysOffset = apolloData.opens > 0 ? 7 : 14;
    return new Date(lastEngaged.getTime() + followupDaysOffset * 24 * 60 * 60 * 1000).toISOString();
}

// Import Apollo list contacts to Attio (one-time)
// listId can be passed directly or via APOLLO_LIST_ID env var
export async function importApolloListToAttio(listId = process.env.APOLLO_LIST_ID) {
    if (!listId) {
        console.error('[attio] Error: APOLLO_LIST_ID not provided and not set in env');
        return { imported: 0, errors: 1 };
    }
    try {
        console.log(`[attio] Importing Apollo list ${listId} to Attio...`);
        
        // Fetch from Apollo list
        const apolloRes = await fetch(
            `${APOLLO_BASE}/v1/lists/${listId}/contacts`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': APOLLO_KEY
                },
                body: JSON.stringify({ limit: 500 })
            }
        );
        
        if (!apolloRes.ok) {
            console.log(`[attio] Apollo list fetch failed: ${apolloRes.status}`);
            return { imported: 0, errors: 0 };
        }

        const apolloData = await apolloRes.json();
        const contacts = apolloData.contacts || [];
        console.log(`[attio] Found ${contacts.length} contacts in Apollo list`);

        let imported = 0;
        let errors = 0;

        for (const contact of contacts) {
            try {
                const res = await fetch(
                    `${ATTIO_BASE}/objects/people/records`,
                    {
                        method: 'POST',
                        headers: ATTIO_HEADERS,
                        body: JSON.stringify({
                            data: {
                                values: {
                                    name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
                                    nddl_apollo_person_id: contact.id,
                                    nddl_apollo_headline: contact.headline,
                                    nddl_apollo_location: contact.city
                                }
                            }
                        })
                    }
                );

                if (res.ok) {
                    imported++;
                } else {
                    const err = await res.json();
                    // Ignore duplicate errors (contact already exists)
                    if (!err.message?.includes('duplicate')) {
                        errors++;
                    }
                }
            } catch (e) {
                console.error(`[attio] Error importing contact ${contact.id}:`, e.message);
                errors++;
            }
        }

        console.log(`[attio] Import complete: ${imported} created, ${errors} errors`);
        return { imported, errors };
    } catch (e) {
        console.error('[attio] Import error:', e.message);
        return { imported: 0, errors: 1 };
    }
}
