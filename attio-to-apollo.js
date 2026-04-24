#!/usr/bin/env node
// attio-to-apollo.js — Attio Customers → Apollo accounts sync
// Pulls companies where Customer Status = "Customer" → upserts as Apollo accounts
// Run: node attio-to-apollo.js

import https from 'https';

const APOLLO_KEY = process.env.APOLLO_API_KEY;
const ATTIO_KEY  = process.env.ATTIO_API_KEY;
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT    = process.env.TELEGRAM_CHAT_ID;

// Attio status_id for "Customer" on Customer Status field
const CUSTOMER_STATUS_ID = '249d8e55-54e5-4b98-813c-a2dba569dbb9';
const APOLLO_LABEL       = 'Huza Customer';

if (!APOLLO_KEY) { console.error('❌ APOLLO_API_KEY missing'); process.exit(1); }
if (!ATTIO_KEY)  { console.error('❌ ATTIO_API_KEY missing');  process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function request(hostname, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname, method, path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...headers
      },
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
    { chat_id: TG_CHAT, text, parse_mode: 'HTML' }, {}).catch(() => {});

// Pre-load all existing Apollo accounts with "Huza Customer" label into a domain→id map
async function loadExistingApolloAccounts() {
  console.log('🔍 Loading existing Apollo "Huza Customer" accounts...');
  const domainMap = {};  // domain → account id
  const nameMap   = {};  // lowercase name → account id
  let page = 1;

  while (true) {
    const r = await apollo('POST', '/api/v1/accounts/search', {
      label_names: [APOLLO_LABEL],
      per_page: 100,
      page
    });
    if (r.status !== 200) break;
    const accounts = r.body.accounts || [];
    for (const a of accounts) {
      if (a.domain) domainMap[a.domain.toLowerCase()] = a.id;
      if (a.name)   nameMap[a.name.toLowerCase()]     = a.id;
    }
    if (accounts.length < 100) break;
    page++;
  }

  console.log(`✅ Found ${Object.keys(domainMap).length} existing accounts by domain, ${Object.keys(nameMap).length} by name`);
  return { domainMap, nameMap };
}

// Pull all companies where Customer Status = "Customer" (paginated)
async function getAttioCustomers() {
  console.log('📋 Fetching Attio companies with Customer Status = Customer...');
  const companies = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const r = await attio('POST', '/v2/objects/companies/records/query', {
      filter: { status: { $eq: CUSTOMER_STATUS_ID } },
      limit,
      offset
    });

    if (r.status !== 200) {
      throw new Error(`Attio query failed: ${r.status} ${JSON.stringify(r.body)}`);
    }

    const batch = r.body.data || [];
    companies.push(...batch);
    console.log(`  Fetched ${companies.length} so far...`);

    if (batch.length < limit) break; // no more pages
    offset += limit;
  }

  console.log(`✅ Total Customer companies: ${companies.length}`);
  return companies;
}

// Extract relevant fields from Attio company record
function extractCompanyData(record) {
  const vals = record.values || {};
  const name   = vals.name?.[0]?.value || '';
  const domain = vals.domains?.[0]?.domain || '';
  const loc    = vals.primary_location?.[0] || {};
  const city    = typeof loc === 'object' ? (loc.city || '') : '';
  const country = typeof loc === 'object' ? (loc.country_name || '') : '';
  const website = domain ? `https://${domain}` : '';
  return { name, domain, website, city, country };
}

// Upsert company in Apollo — uses pre-loaded map to prevent duplicates
async function upsertApolloAccount(company, domainMap, nameMap) {
  if (!company.name && !company.domain) {
    return { status: 'skipped', reason: 'no name or domain' };
  }

  // Match by domain first, then by name — no per-company API search needed
  const existingId =
    (company.domain && domainMap[company.domain.toLowerCase()]) ||
    (company.name   && nameMap[company.name.toLowerCase()])     ||
    null;

  const payload = {
    name: company.name || undefined,
    domain: company.domain || undefined,
    website_url: company.website || undefined,
    city: company.city || undefined,
    country: company.country || undefined,
    label_names: [APOLLO_LABEL]
  };

  if (existingId) {
    const r = await apollo('PUT', `/api/v1/accounts/${existingId}`, payload);
    return {
      status: r.status === 200 ? 'updated' : 'error',
      id: existingId,
      httpStatus: r.status
    };
  } else {
    const r = await apollo('POST', '/api/v1/accounts', payload);
    const id = r.body.account?.id;
    if (id) {
      // label_names doesn't apply on POST — follow-up PUT to apply label
      await apollo('PUT', `/api/v1/accounts/${id}`, { label_names: [APOLLO_LABEL] });
      // Add to local map so subsequent entries in same run don't duplicate
      if (company.domain) domainMap[company.domain.toLowerCase()] = id;
      if (company.name)   nameMap[company.name.toLowerCase()]     = id;
    }
    return {
      status: (r.status === 200 || r.status === 201) ? 'created' : 'error',
      id,
      httpStatus: r.status,
      error: r.status >= 400 ? JSON.stringify(r.body).slice(0, 100) : undefined
    };
  }
}

// Main
async function main() {
  console.log('🚀 Attio → Apollo customer sync starting...\n');

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

  // Step 1: Get all customer companies from Attio
  const records = await getAttioCustomers();
  const companies = records.map(extractCompanyData).filter(c => c.name || c.domain);

  console.log(`\n📤 Upserting ${companies.length} companies into Apollo as "${APOLLO_LABEL}"...\n`);

  // Step 2: Pre-load existing Apollo accounts to avoid duplicates
  const { domainMap, nameMap } = await loadExistingApolloAccounts();

  // Step 3: Upsert each into Apollo
  for (const company of companies) {
    const result = await upsertApolloAccount(company, domainMap, nameMap);
    const icon = result.status === 'created' ? '✨' : result.status === 'updated' ? '🔄' : result.status === 'skipped' ? '⏭️' : '❌';
    console.log(`  ${icon} ${company.name || company.domain} → ${result.status}${result.error ? ` (${result.error})` : ''}`);

    if (result.status === 'created') results.created++;
    else if (result.status === 'updated') results.updated++;
    else if (result.status === 'skipped') results.skipped++;
    else results.errors++;

    await sleep(300); // Apollo rate limit
  }

  const summary = `🏢 <b>Attio → Apollo Customer Sync</b>

✨ Created: ${results.created}
🔄 Updated: ${results.updated}
⏭️ Skipped: ${results.skipped}
❌ Errors: ${results.errors}

Label applied: <b>"${APOLLO_LABEL}"</b>
Total processed: ${companies.length}`;

  console.log('\n' + summary.replace(/<[^>]+>/g, ''));

  if (TG_TOKEN && TG_CHAT) {
    await telegram(summary);
    console.log('📱 Telegram notification sent');
  }

  console.log('\n✅ Sync complete.');
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
