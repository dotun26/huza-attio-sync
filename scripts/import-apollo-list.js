#!/usr/bin/env node

/**
 * Import Huza HR contacts from Apollo list to Attio
 * 
 * Usage: APOLLO_API_KEY=xxx ATTIO_API_KEY=yyy node import-apollo-list.js
 */

const APOLLO_KEY = process.env.APOLLO_API_KEY;
const ATTIO_KEY = process.env.ATTIO_API_KEY;
const LIST_ID = process.env.APOLLO_LIST_ID;

if (!LIST_ID) {
    console.error('❌ Missing env var: APOLLO_LIST_ID');
    console.error('   Example: 69a6f14a2d016c0011ddf7ed (clawd generate list)');
    process.exit(1);
}

if (!APOLLO_KEY || !ATTIO_KEY) {
    console.error('❌ Missing env vars: APOLLO_API_KEY and ATTIO_API_KEY');
    process.exit(1);
}

const APOLLO_BASE = "https://api.apollo.io/v1"; // mixed_people/api_search endpoint
const ATTIO_BASE = "https://api.attio.com/v2";

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function getApolloContacts(page = 1) {
    // Use mixed_people/api_search (correct endpoint as of 2026-03-04)
    // The /lists/{id}/contacts endpoint is deprecated/non-functional
    const res = await fetch(
        `${APOLLO_BASE}/mixed_people/api_search`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": APOLLO_KEY
            },
            body: JSON.stringify({
                page,
                per_page: 50,
                q_organization_locations: ["Rwanda", "Kenya", "Nigeria", "Uganda", "Ghana", "Tanzania", "Zambia"],
                q_organization_size: ["10-50", "51-200", "201-1000"],
                q_organization_industry: ["logistics", "construction", "manufacturing"],
                q_job_title: ["COO"]
            })
        }
    );
    
    if (!res.ok) throw new Error(`Apollo error: ${res.status} ${res.statusText}`);
    return res.json();
}

async function createAttioContact(apolloContact) {
    // Use new Apollo API response format (mixed_people/api_search)
    const last_name = apolloContact.last_name || apolloContact.last_name_obfuscated || '';
    const name = `${apolloContact.first_name || ''} ${last_name}`.trim() || "Unknown Contact";
    const PEOPLE_ID = "54328dbe-54e4-4b47-8f68-372d7f7d1da3";
    
    const res = await fetch(
        `${ATTIO_BASE}/objects/${PEOPLE_ID}/records`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ATTIO_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data: {
                    values: {
                        name,
                        nddl_apollo_person_id: apolloContact.id,
                        nddl_apollo_headline: apolloContact.title,
                        nddl_apollo_location: apolloContact.city,
                        nddl_apollo_org_name: apolloContact.organization?.name
                    }
                }
            })
        }
    );
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Attio error: ${err.message}`);
    }
    
    return res.json();
}

async function main() {
    console.log("🚀 Importing Huza HR COO contacts from Apollo to Attio...\n");
    
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    
    // Fetch all contacts from Apollo search
    while (hasMore && page <= 5) { // Limit to 5 pages (250 contacts max)
        console.log(`Fetching page ${page}...`);
        const data = await getApolloContacts(page);
        const contacts = data.people || [];
        
        if (contacts.length === 0) break;
        allContacts.push(...contacts);
        console.log(`  Got ${contacts.length} contacts (total: ${allContacts.length})`);
        
        // Check if there are more pages (Apollo returns total_entries but we'll stop at reasonable limit)
        hasMore = contacts.length >= 50;
        page += 1;
        
        if (hasMore) await sleep(1000);
    }
    
    console.log(`\n✅ Fetched ${allContacts.length} contacts from Apollo\n`);
    
    // Import to Attio
    let created = 0;
    let failed = 0;
    
    for (let i = 0; i < allContacts.length; i++) {
        const contact = allContacts[i];
        process.stdout.write(`\r[${i + 1}/${allContacts.length}] Importing ${contact.first_name || 'Contact'}...`);
        
        try {
            await createAttioContact(contact);
            created++;
        } catch (e) {
            console.log(`\n  ⚠️ ${contact.first_name}: ${e.message}`);
            failed++;
        }
        
        // Rate limiting
        if ((i + 1) % 10 === 0) await sleep(500);
    }
    
    console.log(`\n\n📊 Import Results:`);
    console.log(`  ✅ Created: ${created}/${allContacts.length}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`\n✨ Done!`);
}

main().catch(e => {
    console.error("\n❌ Fatal error:", e.message);
    process.exit(1);
});
