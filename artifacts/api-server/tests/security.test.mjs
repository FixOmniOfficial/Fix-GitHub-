/**
 * Security Integration Tests
 * Tests: Phone validation, Test data isolation, Panel guard, Auth gates
 *
 * Run: node artifacts/api-server/tests/security.test.mjs
 */

import { execSync } from 'child_process';

const BASE = 'http://localhost:8080';
const DB = process.env.DATABASE_URL;

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌  ${name}`);
    console.error(`       → ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(path, body) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sql(query) {
  execSync(`psql "${DB}" -c "${query}"`, { stdio: 'pipe' });
}

// ── Cleanup: remove any test artifacts from a previous run ────────────────────
async function cleanup() {
  try {
    sql("DELETE FROM professionals WHERE name = 'SecurityTestTech' OR phone = '9999900099'");
  } catch { /* ignore */ }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Security Test Suite\n');

// ── GROUP 1: Phone Validation ─────────────────────────────────────────────────
console.log('── Phone Validation ──────────────────────────────────────────');

await test('9-digit phone → 400', async () => {
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech', phone: '987654321', professionType: 'plumber',
  });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
  const j = await r.json();
  assert(j.error, `Expected error message, got: ${JSON.stringify(j)}`);
});

await test('11-digit phone → 400', async () => {
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech', phone: '91987654321', professionType: 'plumber',
  });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await test('Phone starting with 5 → 400 (invalid Indian mobile)', async () => {
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech', phone: '5123456789', professionType: 'plumber',
  });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await test('Phone starting with 1 → 400', async () => {
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech', phone: '1234567890', professionType: 'plumber',
  });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

await test('Valid 10-digit phone (starts with 9) → 201', async () => {
  await cleanup();
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech', phone: '9999900099', professionType: 'plumber',
  });
  const j = await r.json();
  assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(j)}`);
  assert(j.uniqueCode?.startsWith('TECH-'), `Expected TECH- code, got: ${j.uniqueCode}`);
});

await test('Duplicate phone → 409 Conflict', async () => {
  // Try to create another technician with the same phone
  const r = await post('/api/booking/technician/signup', {
    name: 'SecurityTestTech Duplicate', phone: '9999900099', professionType: 'electrician',
  });
  assert(r.status === 409, `Expected 409 for duplicate phone, got ${r.status}`);
  const j = await r.json();
  assert(j.error?.toLowerCase().includes('already'), `Expected "already registered" error, got: ${j.error}`);
});

await cleanup(); // clean up the valid entry

// ── GROUP 2: Test Data Isolation ──────────────────────────────────────────────
console.log('\n── Test Data Isolation ────────────────────────────────────────');

await test('is_test_data=true rows absent from GET /booking/professionals', async () => {
  // Insert a test entry directly in DB
  sql("INSERT INTO professionals (name, profession_type, unique_code, is_test_data, avatar_emoji) VALUES ('ISOLATION_TEST', 'plumber', 'ISOL-0001', true, '🤖') ON CONFLICT DO NOTHING");

  const r = await fetch(`${BASE}/api/booking/professionals`);
  assert(r.ok, `GET /booking/professionals failed: ${r.status}`);
  const rows = await r.json();
  const leaked = rows.filter(p => p.uniqueCode === 'ISOL-0001' || p.name === 'ISOLATION_TEST');
  // Clean up
  sql("DELETE FROM professionals WHERE unique_code = 'ISOL-0001'");
  assert(leaked.length === 0, `Test entry leaked into public API! Found: ${JSON.stringify(leaked)}`);
});

await test('Real technicians still visible after is_test_data filter', async () => {
  // Insert a real entry
  sql("INSERT INTO professionals (name, profession_type, unique_code, is_test_data, avatar_emoji) VALUES ('REAL_TEST', 'electrician', 'REAL-0001', false, '⚡') ON CONFLICT DO NOTHING");
  const r = await fetch(`${BASE}/api/booking/professionals`);
  const rows = await r.json();
  const found = rows.find(p => p.uniqueCode === 'REAL-0001');
  sql("DELETE FROM professionals WHERE unique_code = 'REAL-0001'");
  assert(found !== undefined, 'Real technician not found in public API after is_test_data filter');
});

// ── GROUP 3: Panel Guard ──────────────────────────────────────────────────────
console.log('\n── Panel Guard ────────────────────────────────────────────────');

await test('panel_enabled=false → GET /api/admin/users returns 503', async () => {
  sql("UPDATE app_settings SET panel_enabled = false WHERE id = 1");
  try {
    const r = await fetch(`${BASE}/api/admin/users`);
    assert(r.status === 503, `Expected 503 when panel disabled, got ${r.status}`);
    const j = await r.json();
    assert(j.error?.toLowerCase().includes('disabled'), `Expected "disabled" in error, got: ${j.error}`);
  } finally {
    sql("UPDATE app_settings SET panel_enabled = true WHERE id = 1");
  }
});

await test('panel_enabled=false → GET /api/admin/staff returns 503', async () => {
  sql("UPDATE app_settings SET panel_enabled = false WHERE id = 1");
  try {
    const r = await fetch(`${BASE}/api/admin/staff`);
    assert(r.status === 503, `Expected 503, got ${r.status}`);
  } finally {
    sql("UPDATE app_settings SET panel_enabled = true WHERE id = 1");
  }
});

await test('panel_enabled=false → /api/admin/panel-toggle NOT blocked (bypass)', async () => {
  sql("UPDATE app_settings SET panel_enabled = false WHERE id = 1");
  try {
    const r = await fetch(`${BASE}/api/admin/panel-toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    // Should get 401 (no auth) not 503 (panel blocked)
    assert(r.status !== 503, `Panel-toggle should bypass panel guard, got 503`);
    assert(r.status === 401 || r.status === 200, `Expected 401 (no auth) or 200, got ${r.status}`);
  } finally {
    sql("UPDATE app_settings SET panel_enabled = true WHERE id = 1");
  }
});

await test('panel_enabled=false → /api/admin/ensure-first-admin NOT blocked (bypass)', async () => {
  sql("UPDATE app_settings SET panel_enabled = false WHERE id = 1");
  try {
    const r = await fetch(`${BASE}/api/admin/ensure-first-admin`, { method: 'POST' });
    assert(r.status !== 503, `ensure-first-admin should bypass panel guard, got 503`);
  } finally {
    sql("UPDATE app_settings SET panel_enabled = true WHERE id = 1");
  }
});

await test('panel re-enabled → admin routes accessible again', async () => {
  // Panel is already back to true, just verify 401 (not 503)
  const r = await fetch(`${BASE}/api/admin/users`);
  assert(r.status === 401 || r.status === 200, `Expected 401 (no Clerk token), got ${r.status}`);
});

// ── GROUP 4: Auth Gates ───────────────────────────────────────────────────────
console.log('\n── Auth Gates ─────────────────────────────────────────────────');

await test('GET /api/admin/sandbox/data without auth → 401', async () => {
  const r = await fetch(`${BASE}/api/admin/sandbox/data`);
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

await test('DELETE /api/admin/sandbox/clear without auth → 401', async () => {
  const r = await fetch(`${BASE}/api/admin/sandbox/clear`, { method: 'DELETE' });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

await test('GET /api/admin/technicians without auth → 401', async () => {
  const r = await fetch(`${BASE}/api/admin/technicians`);
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

await test('POST /api/admin/technicians without auth → 401', async () => {
  const r = await fetch(`${BASE}/api/admin/technicians`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauth', professionType: 'plumber' }),
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
  console.error('Failed tests:');
  failures.forEach(f => console.error(`  • ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log('🎉 All security tests passed!\n');
}
