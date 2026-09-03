#!/usr/bin/env node
/**
 * generate-claims-manifest.mjs
 *
 * Builds public/projects/claims-desk/demo/claims-manifest.json from the live
 * Claims Desk registry. Manual only — deliberately NOT wired into `prebuild`,
 * because the build should never depend on a third-party service being up.
 *
 * Run:  node scripts/generate-claims-manifest.mjs
 *
 * Fails the whole run (nonzero exit) if any claim fetch fails. The manifest is
 * only written once every claim has been fetched and shaped, so a partial or
 * stale-mixed manifest can never land on disk.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://claims-desk-production-8424.up.railway.app';
const MCP_ENDPOINT = `${API_BASE}/mcp`;
const SITE_BASE = 'https://www.richardthomchick.com';
const PAGE = '/projects/claims-desk/demo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  __dirname,
  '../public/projects/claims-desk/demo/claims-manifest.json'
);

const CLAIM_SLUGS = [
  'kalder_resolve-performance-01',
  'kalder_resolve-performance-06',
  'kalder_resolve-comparative-01',
  'kalder_vendor-compliance-01',
  'salesforce_govcloud-compliance-01',
];

/**
 * Subject disclosure per claim. Kalder is a fictional company invented for the
 * Claims Desk demo corpus; the Salesforce claim is a real, publicly made
 * compliance claim about a real product, so it is not marked synthetic.
 */
const SYNTHETIC_SUBJECTS = {
  kalder_resolve: {
    name: 'Kalder Resolve',
    is_synthetic: true,
    note: 'Fictional company used for demonstration',
  },
  kalder_vendor: {
    name: 'Kalder Vendor',
    is_synthetic: true,
    note: 'Fictional company used for demonstration',
  },
  salesforce_govcloud: {
    name: 'Salesforce Government Cloud Plus',
    is_synthetic: false,
  },
};

function subjectFor(claim) {
  const subject = SYNTHETIC_SUBJECTS[claim.product_key];
  if (!subject) {
    throw new Error(
      `No subject disclosure mapped for product_key "${claim.product_key}" ` +
        `(claim ${claim.claim_slug}). Refusing to emit an undisclosed subject.`
    );
  }
  return subject;
}

/**
 * The registry's claim JSON does not expose the adversarial loop's convergence
 * mode or round count as structured fields — the ruling record carries only
 * ruling_id, verdict, rationale, reviewed_by, created_at. Both facts are stated
 * in the ruling's own prose, so we read them from there rather than hardcoding
 * a number that could silently drift out of sync with the registry.
 */
function convergenceFrom(rationale) {
  if (/attack[_ ]exhaustion/i.test(rationale)) return 'attack_exhaustion';
  if (/stable[_ ]verdict|held .* in all three|held .* across all/i.test(rationale)) {
    return 'stable_verdict';
  }
  return 'stable_verdict';
}

function roundsFrom(rationale) {
  const ordinal = rationale.match(/round[- ](\d+)/gi) ?? [];
  const numeric = ordinal.map((m) => parseInt(m.match(/\d+/)[0], 10));
  if (/all three rounds|in all three|three rounds/i.test(rationale)) {
    numeric.push(3);
  }
  if (numeric.length === 0) return null;
  return Math.max(...numeric);
}

async function fetchClaim(slug) {
  const url = `${API_BASE}/claims/${slug}.json`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Network failure fetching ${url}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${err.message}`);
  }
  if (!body?.claim?.claim_slug) {
    throw new Error(`Malformed payload from ${url}: missing claim.claim_slug`);
  }
  if (body.claim.claim_slug !== slug) {
    throw new Error(
      `Slug mismatch from ${url}: requested "${slug}", got "${body.claim.claim_slug}"`
    );
  }
  return body;
}

function toManifestEntry(payload) {
  const { claim, latest_ruling: ruling } = payload;

  const entry = {
    claim_slug: claim.claim_slug,
    claim_text: claim.claim_text,
    claim_type: claim.claim_type,
    risk_class: claim.risk_class,
    page_anchor: `#claim-${claim.claim_slug}`,
    subject: subjectFor(claim),
    verification: claim.verification,
  };

  // provenance is present only when a ruling exists. Unreviewed claims omit the
  // key entirely rather than carrying nulls — absence is the honest signal.
  if (ruling) {
    entry.provenance = {
      instrument: ruling.reviewed_by,
      ruled_at: ruling.created_at,
      convergence: convergenceFrom(ruling.rationale ?? ''),
      rounds: roundsFrom(ruling.rationale ?? ''),
    };
  }

  // No rationale field anywhere: substantiation_url carries that hop.
  entry.substantiation_url = `${API_BASE}/claims/${claim.claim_slug}.json`;

  return entry;
}

async function main() {
  const payloads = [];
  for (const slug of CLAIM_SLUGS) {
    process.stderr.write(`fetching ${slug} ... `);
    const payload = await fetchClaim(slug);
    process.stderr.write('ok\n');
    payloads.push(payload);
  }

  const manifest = {
    manifest_version: '1.0',
    base_url: SITE_BASE,
    page: PAGE,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    registry: {
      api_base: API_BASE,
      mcp_endpoint: MCP_ENDPOINT,
    },
    claims: payloads.map(toManifestEntry),
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  process.stderr.write(`\nwrote ${OUT_PATH} (${manifest.claims.length} claims)\n`);
}

main().catch((err) => {
  process.stderr.write(`\nERROR: ${err.message}\n`);
  process.stderr.write('No manifest written.\n');
  process.exit(1);
});
