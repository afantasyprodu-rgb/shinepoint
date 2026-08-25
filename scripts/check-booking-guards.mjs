// Static regression tripwire for the bookings column guards — no database
// needed, safe to run in CI on every push.
//
// WHY THIS EXISTS: migration guards here get wholesale-rewritten per
// feature, and each rewrite has silently dropped protections added in
// between (054 rebuilt 041's 15-column guard with 6; 053/054 dropped 039's
// promo nulling; 022 dropped 010's admin bypass). This script parses the
// migration history the way Postgres would apply it — last definition of a
// function wins — and fails if the FINAL version of either bookings guard
// no longer covers every column any prior migration protected.
//
// The SQL twin (supabase/tests/060_guard_regression.sql) checks the live
// database; this one catches the problem at PR time before anything is
// deployed. When you add a new server-managed bookings column, add it to
// BOTH lists in the same commit that extends the guard.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

// Every column any migration has ever guarded on UPDATE. ADD ONLY.
const REQUIRED_UPDATE_COLS = [
  'total_price',
  'platform_cut',
  'detailer_payout',
  'paid_at',
  'promo_discount',
  'promo_code_id',
  'tip_paid_at',
  'tip_payment_intent',
  'tip_amount',
  'stripe_payment_method',
  'stripe_payment_intent',
  'mileage_fee',
  'payout_hold_until',
  'transferred_at',
  'stripe_transfer_id',
  'payout_requires_approval',
  'payout_approved_at',
  'payout_approved_by',
]

// Fields the INSERT guard must strip from client inserts.
const REQUIRED_INSERT_STRIPS = [
  ['promo_code_id', ':= null'],
  ['promo_discount', ':= null'],
  ['platform_cut', ':= null'],
  ['detailer_payout', ':= null'],
  ['stripe_payment_intent', ':= null'],
  ['paid_at', ':= null'],
]

// Last definition wins, mirroring CREATE OR REPLACE semantics applied in
// filename order (migrations are zero-padded, so lexicographic == numeric).
function finalFunctionBody(migrations, fnName) {
  let last = null
  for (const file of migrations) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const marker = `function public.${fnName}(`
    let idx = sql.indexOf(marker)
    while (idx !== -1) {
      const end = sql.indexOf('$$;', idx)
      if (end === -1) break
      last = { file, body: sql.slice(idx, end) }
      idx = sql.indexOf(marker, end)
    }
  }
  return last
}

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
let failed = false

const update = finalFunctionBody(files, 'guard_bookings_update')
if (!update) {
  console.error('FAIL: no guard_bookings_update definition found in migrations')
  process.exit(1)
}

if (!update.body.includes('is_admin()')) {
  console.error(
    "FAIL (" + update.file + "): guard_bookings_update lost the is_admin() bypass."
  )
  failed = true
}
for (const col of REQUIRED_UPDATE_COLS) {
  if (!update.body.includes("new." + col)) {
    console.error(
      "FAIL (" + update.file + "): guard_bookings_update no longer guards \"" + col + "\"."
    )
    failed = true
  }
}

const insert = finalFunctionBody(files, 'guard_bookings_insert')
if (!insert) {
  console.error('FAIL: no guard_bookings_insert definition found in migrations')
  process.exit(1)
}
for (const [col, assignment] of REQUIRED_INSERT_STRIPS) {
  if (!insert.body.includes("new." + col) || !insert.body.includes(assignment)) {
    console.error(
      "FAIL (" + insert.file + "): guard_bookings_insert no longer strips " + col + " " + assignment + "."
    )
    failed = true
  }
}

if (failed) process.exit(1)
console.log(
  "OK: bookings guards intact - " + REQUIRED_UPDATE_COLS.length + " columns guarded on UPDATE " +
    "(incl. admin bypass), INSERT strips verified (checked through " + files[files.length - 1] + ")"
)
