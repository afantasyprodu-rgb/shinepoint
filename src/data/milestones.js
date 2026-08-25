// Business-plan milestone TARGETS — the one piece of DEMO_ADMIN a real
// admin legitimately consumes (progress bars read current-vs-target; the
// "current" half comes from live tables). Targets are product decisions,
// not seed data, so they live here instead of inside demoData.js — which
// is dynamically imported and must never be needed by real sessions.
export const MILESTONES = {
  detailers: { target: 25 },
  customers: { target: 500 },
  jobs: { target: 1000 },
  revenue: { target: 25000 },
}
