// Known-answer smoke tests for the Ask AI retrieval path.
//
// Why this exists: prose chunks were once stored truncated to 1000 chars while
// their embeddings covered the whole chunk. Every component reported success —
// the chunk ranked #1, Pinecone accepted the write, the model correctly said it
// lacked the information — and nothing logged an error. Unit-testing the
// indexer would not have caught it, because the indexer was doing exactly what
// it was told. Only an end-to-end question with a known answer surfaces it.
//
// Each case asserts on the deployed endpoint, so this exercises chunking,
// embedding, retrieval, metadata storage AND prompt assembly together. That
// costs Anthropic tokens per run, so this is a smoke test to run after
// indexing or touching the retrieval path — not something to put in a loop.
//
// Usage: npm run smoke-test [-- --base https://staging.example.com]

const DEFAULT_BASE = 'https://www.richardthomchick.com';
const TIMEOUT_MS = 150_000;

const baseFlag = process.argv.indexOf('--base');
const BASE = baseFlag !== -1 ? process.argv[baseFlag + 1] : DEFAULT_BASE;

// `expect` strings must all appear; `reject` strings must NOT appear.
//
// The negative cases are the point. A retrieval bug makes the model say it
// cannot see something; a prompting bug makes it invent something. Only the
// second kind is dangerous on a public site, and only a negative case catches
// it. "5m 47s" is deliberately absent from the corpus: the case study records
// token counts but never elapsed time, so a figure appearing here is fabricated.
const CASES = [
  {
    name: 'Findings table is readable (the regression this suite exists for)',
    slug: 'claims-desk',
    context: 'project',
    query: 'What did the Arm B panel report for total tokens?',
    expect: ['322'],
    reject: [],
  },
  {
    name: 'Declines on a figure absent from the corpus rather than inventing one',
    slug: 'claims-desk',
    context: 'project',
    query: 'What elapsed time did the Arm B panel report?',
    expect: [],
    // Any concrete duration here is fabricated — the corpus has no elapsed time.
    rejectPattern: /\b\d+\s*m\s*\d+\s*s\b|\b\d+\s*(minutes|seconds)\b/i,
  },
  {
    name: 'Coordination token comparison is explained with its real figures',
    slug: 'claims-desk',
    context: 'project',
    query: 'How much did plan-in-context cost in coordination tokens versus plan-in-script?',
    expect: ['445', '0'],
    reject: [],
  },
  {
    name: 'Mid-chunk journal content is reachable (the 1000-char cliff)',
    slug: 'week-19-memory-retest',
    context: 'journal',
    query: 'What did the retest find, and what happened to the memory hypothesis?',
    // "207 of 207" sits past the old 1000-char boundary in its section.
    expect: ['207'],
    reject: [],
  },
];

async function askAI({ query, context, slug }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context, slug }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} from ${BASE}/api/search`);

    // The route streams SSE; collect the ai-chunk payloads into one answer.
    const raw = await res.text();
    let answer = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === 'done') continue;
      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed === 'string') answer += parsed;
      } catch {
        // sources/done frames are not answer text
      }
    }
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

const results = [];

for (const testCase of CASES) {
  process.stdout.write(`\n▶ ${testCase.name}\n  ? ${testCase.query}\n`);

  let answer;
  try {
    answer = await askAI(testCase);
  } catch (err) {
    results.push({ name: testCase.name, ok: false, reason: `request failed: ${err.message}` });
    console.log(`  ✗ request failed: ${err.message}`);
    continue;
  }

  const problems = [];
  for (const needle of testCase.expect ?? []) {
    if (!answer.includes(needle)) problems.push(`missing expected "${needle}"`);
  }
  for (const needle of testCase.reject ?? []) {
    if (answer.includes(needle)) problems.push(`contains rejected "${needle}"`);
  }
  if (testCase.rejectPattern) {
    const hit = answer.match(testCase.rejectPattern);
    if (hit) problems.push(`fabricated a figure matching ${testCase.rejectPattern}: "${hit[0]}"`);
  }

  const ok = problems.length === 0;
  results.push({ name: testCase.name, ok, reason: problems.join('; '), answer });

  console.log(`  ${ok ? '✓ pass' : '✗ FAIL'}${ok ? '' : ' — ' + problems.join('; ')}`);
  console.log(`  answer: ${answer.replace(/\s+/g, ' ').slice(0, 220)}${answer.length > 220 ? '…' : ''}`);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${'─'.repeat(60)}`);
console.log(`${results.length - failed.length}/${results.length} passed against ${BASE}`);

if (failed.length > 0) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  ✗ ${f.name}\n    ${f.reason}`);
  process.exit(1);
}
