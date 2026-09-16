// Static tripwire for column-level SELECT grants — no database needed.
//
// WHY THIS EXISTS: detailer_profiles has table-level SELECT revoked (019) and
// re-granted column by column, so a new column is UNREADABLE by the app until
// someone remembers `grant select (col)`. Forgetting it doesn't fail the
// migration — it fails every client query that selects the column, with
// "permission denied", which PostgREST turns into an empty list. That has
// shipped five times (045, 056, 069, 070, 093); 086's deposit_percent
// emptied the map, search and the admin detailer list at once.
//
// Rule: for any table whose SELECT was revoked from anon/authenticated, every
// column added AFTER that revoke must be granted in some migration, or be
// listed in PRIVATE below as deliberately hidden from clients.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Columns intentionally NOT readable by anon/authenticated. Add with a reason.
const PRIVATE = {
  detailer_profiles: [
    'fcm_token',        // 059: device push token — a credential; written by push.js, read only by send-push (service role)
    // 064: onboarding survey answers — written via submit_detailer_onboarding,
    // read by admin/service code only; not public profile data.
    'years_experience',
    'equipment_type',
    'certifications',
    'team_size',
    'referral_source',
    // 094: insurance document AI-check result — read only via the
    // admin_get_insurance_document RPC (SECURITY DEFINER, admin-checked),
    // never a direct column grant; row-level SELECT on this table is `true`
    // for every authenticated user, so granting these would let any
    // logged-in user read any OTHER detailer's insurance document/AI note.
    'insurance_ai_flagged',
    'insurance_ai_note',
    'insurance_uploaded_at',
  ],
}

const dir = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

// Drop `--` comments so commented-out SQL doesn't count.
const strip = (sql) => sql.replace(/--[^\n]*/g, '')
const idents = (list) => list.split(',').map((c) => c.trim().replace(/"/g, '').toLowerCase()).filter(Boolean)

const revokedAt = new Map() // table -> file index of the revoke
const added = new Map()     // table -> [{ col, file }]
const granted = new Map()   // table -> Set(col)

files.forEach((file, i) => {
  const sql = strip(readFileSync(join(dir, file), 'utf8'))

  for (const m of sql.matchAll(/revoke\s+select\s+on\s+(?:table\s+)?public\.(\w+)\s+from\s+([^;]+);/gi)) {
    if (/\b(anon|authenticated)\b/i.test(m[2]) && !revokedAt.has(m[1].toLowerCase())) revokedAt.set(m[1].toLowerCase(), i)
  }
  for (const m of sql.matchAll(/grant\s+select\s*\(([^)]*)\)\s*on\s+(?:table\s+)?public\.(\w+)/gi)) {
    const t = m[2].toLowerCase()
    if (!granted.has(t)) granted.set(t, new Set())
    idents(m[1]).forEach((c) => granted.get(t).add(c))
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.(\w+)([^;]*);/gi)) {
    const t = m[1].toLowerCase()
    for (const a of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) {
      if (!added.has(t)) added.set(t, [])
      added.get(t).push({ col: a[1].toLowerCase(), i, file })
    }
  }
})

const problems = []
for (const [table, revokeIdx] of revokedAt) {
  const ok = granted.get(table) ?? new Set()
  const priv = new Set(PRIVATE[table] ?? [])
  for (const { col, i, file } of added.get(table) ?? []) {
    if (i <= revokeIdx) continue // predates the column-grant regime; 019 decided those explicitly
    if (!ok.has(col) && !priv.has(col)) problems.push(`  public.${table}.${col} (added in ${file})`)
  }
}

if (problems.length) {
  console.error('FAIL: columns added to column-granted tables with no SELECT grant:\n' + problems.join('\n'))
  console.error('\nFix: add `grant select (<col>) on public.<table> to anon, authenticated;` in a migration,')
  console.error('or, if clients must never read it, list it in PRIVATE in scripts/check-column-grants.mjs.')
  process.exit(1)
}
console.log(`OK: column grants intact for ${[...revokedAt.keys()].join(', ') || '(no column-granted tables)'} (checked through ${files.at(-1)})`)
