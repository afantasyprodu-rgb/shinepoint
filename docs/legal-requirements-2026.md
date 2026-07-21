# Legal requirements: California + other states (2026)

Researched at the user's request, scoped to the three areas that matter most for a
two-sided marketplace connecting customers with independent detailers: **worker
classification**, **consumer privacy law**, and **marketplace facilitator sales tax**.

**This is not legal advice.** It's a research summary to orient a conversation with an
actual employment/tax attorney before launch — misclassification and privacy exposure
here carry real financial risk, not just app-store rejection risk.

---

## 1. Worker classification — the biggest risk, and it's not solved by Prop 22

**Prop 22 does not cover this app.** It's narrowly written for "app-based rideshare and
delivery" (Uber, Lyft, DoorDash, Instacart). A detailing marketplace gets none of its
protection — full ABC-test exposure applies.

**AB5's referral-agency exemption also does not cover this app.** AB5 carved out ~16
specific service categories (house cleaning, moving, minor home repair, dog walking,
pool cleaning, yard cleanup, tutoring, etc.) where a platform can treat providers as
contractors if it meets ~12 additional conditions. **Car detailing is not on that list**,
and the exemption separately excludes several outright-disqualified categories. So even
if ShinePoint tried to structure itself as a "referral agency" rather than an employer,
detailing isn't an eligible service.

**What that leaves: the plain ABC test** (Dynamex/AB5, codified in CA Labor Code §2775).
A worker is a contractor only if the hiring entity proves **all three**:
- **A** — free from the marketplace's control/direction in performing the work
- **B** — performs work **outside the usual course of the hiring entity's business**
- **C** — customarily engaged in an independently established trade of the same nature

**Prong B is the problem.** ShinePoint's business *is* connecting customers to
detailing — a detailer performing detailing is not "outside the usual course" of that
business, by the same logic that got Dynamex (a delivery company) in trouble using
contractor drivers. This is the same theoretical exposure TaskRabbit/Handy/Thumbtack
have faced in ongoing worker-misclassification disputes — an unresolved, still-litigated
question industry-wide, not unique to this app.

**Consequences of misclassification in CA**: civil penalties $5,000–$25,000 per willful
violation, plus back wages/overtime/meal-rest-break premiums reaching back up to 4 years,
under active EDD/DLSE/DIR enforcement (enforcement budget increased for 2026).

**Other states**: California, Massachusetts, and New Jersey apply the strictest
"prong B" version of the ABC test across most employment law (NJ's final ABC-test rules
take effect Oct 1, 2026). A modified ABC test (drop prong B) applies in Colorado, Idaho,
Montana, Pennsylvania, Wisconsin, Wyoming. Full/partial ABC test states also include
Connecticut, Illinois, Nevada, Oregon, Washington, and others — so expanding beyond LA
doesn't generally get easier; a few states (using the older multi-factor "right to
control" test instead) are lower-risk, but that has to be checked state by state before
operating there.

**Practical takeaway** (not legal advice, but the shape of what founders in this
position typically do): talk to an employment attorney about (a) restructuring the
relationship to strengthen prongs A/C — genuine schedule/pricing/equipment independence,
detailers working for multiple platforms/direct clients, real business licenses per
detailer — and/or (b) whether a different business model (staffing/W-2, or a true
lead-referral fee structure) is safer than the current "marketplace takes 15%" framing
before scaling past the demo.

---

## 2. Consumer privacy law (CCPA/CPRA + the other 19 states)

**CCPA/CPRA (California)** applies once a business crosses *any* of: >$26,625,000 annual
gross revenue, buys/sells/shares personal info of 100,000+ CA consumers/households/year,
or derives 50%+ of revenue from selling/sharing personal info. A pre-launch/early-stage
marketplace likely won't hit these thresholds immediately, but the data ShinePoint
collects (name, email, address, precise location, vehicle photos) is exactly the kind
CCPA singles out:
- **Precise geolocation** is classified as Sensitive Personal Information under CPRA;
  consumers can request the business limit its use to what's necessary for the service.
  A new CA rule bans *selling* precise geolocation (accurate to within ~1,750 ft) as of
  2026 — not a concern unless ShinePoint ever sold location data to a third party, which
  it doesn't.
- As of Jan 1, 2026, CCPA's risk-assessment and mandatory cybersecurity-audit
  requirements phase in for businesses that meet the processing thresholds above.
- Privacy policy must stay accurate/up to date on what's actually collected (name,
  email, address, vehicle/job photos, live location for tracking) — same accuracy bar
  the App Store/Play Store data-safety forms already require (see
  `docs/store-requirements-2026.md`).

**No CA physical presence required** — CCPA applies to any business, anywhere, that
targets/processes CA residents' data at the thresholds above. Relevant the moment
detailers or customers based in California use the app, regardless of where ShinePoint
itself is incorporated.

**Other states**: 20 states now have comprehensive consumer privacy laws in effect in
2026 (Indiana, Kentucky, Rhode Island newly effective Jan 1, 2026; Connecticut, Arkansas,
Utah amendments effective July 1, 2026), alongside the original Virginia (CDPA), Colorado
(CPA), Connecticut (CTDPA), Utah (UCPA) group from 2023. Each has its own thresholds
(most gate on processing 25,000–100,000+ residents' data, similar shape to CCPA but not
identical numbers or rights). **Practical rule of thumb**: a single, honest, CCPA-grade
privacy policy plus a real data-subject-request process (access/delete/correct/opt-out)
tends to satisfy the large majority of these laws' actual requirements even before
checking each one's specific numeric threshold — but the thresholds should be checked
against actual user counts before expanding state by state.

---

## 3. Marketplace facilitator sales tax

**Doesn't apply to ShinePoint's detailing service revenue.** California's Marketplace
Facilitator Act (CDTFA, effective Oct 2019) requires platforms to collect/remit sales tax
on transactions they facilitate — but only for sales of **tangible personal property**.
Pure labor/service charges (a detailer washing and detailing a car) are **not taxable**
in California; only physical products sold (e.g., detailing supplies, if ShinePoint ever
sold merchandise through the app) would trigger this. Since a detailer's own use tax on
supplies they buy is the detailer's problem, not the platform's, there's currently
nothing here for ShinePoint to collect or remit.

**Other states**: most states' marketplace facilitator laws are also anchored to sales of
tangible goods (built originally to catch Amazon/eBay-style resellers), so a pure
service marketplace is generally out of scope nationwide — but a few states tax certain
services broadly (e.g., Hawaii, New Mexico, South Dakota tax most services under general
excise/gross-receipts tax regimes) and would need a state-specific check if/when
detailers or customers operate there. Revisit this specifically before launching in any
state that isn't a "services generally untaxed" state.

---

## Sources

- [Gig Workers Misclassification under California Law Updates](https://www.serendiblaw.com/gig-workers-misclassification/)
- [California AB5 Worker Classification Complete Guide — Terms.Law](https://terms.law/AB5/ca-worker-classification-hub-pillar.html)
- [Worker classification and AB 5 FAQ — FTB.ca.gov](https://www.ftb.ca.gov/file/business/industries/worker-classification-and-ab-5-faq.html)
- [California Proposition 22 Overturns Employee Classification for Rideshare/Delivery](https://seed.csg.org/california-proposition-22-overturns-employee-classification-for-rideshare-and-delivery-gig-workers/)
- [California ABC Test: Employee vs Contractor Under AB5](https://paycheckcalculatorcalifornia.com/california-abc-test-2026-guide/)
- [AB 2257 Enacts Significant Changes to AB 5 — Ogletree](https://ogletree.com/insights-resources/blog-posts/ab-2257-enacts-significant-changes-to-ab-5-on-classification-of-workers-as-independent-contractors/)
- [What California's AB5 Law Means for Cleaning Service Referral — Cleanfax](https://cleanfax.com/what-californias-ab5-law-means-for-cleaning-service-referral/)
- [Who is exempt from AB5? — Everee](https://www.everee.com/blog/who-is-exempt-from-ab5/)
- [Independent Contractor Laws by State 2026 — World Population Review](https://worldpopulationreview.com/state-rankings/independent-contractor-laws-by-state)
- [New Jersey Finalizes ABC Test Worker Classification Rules](https://www.nj.gov/labor/lwdhome/press/2026/20260505_ABC.shtml)
- [What States Use the ABC Test for Independent Contractors? — LegalClarity](https://legalclarity.org/what-states-use-the-abc-test-for-independent-contractors/)
- [TaskRabbit Contractor Problems — The Class Action News](https://theclassactionnews.com/blog/taskrabbit-contractor-problems/)
- [CCPA in 2026: New Requirements and Compliance Impacts — Pandectes](https://pandectes.io/blog/ccpa-in-2026-new-requirements-and-compliance-impacts/)
- [CCPA Requirements 2026: Complete Compliance Guide — Secure Privacy](https://secureprivacy.ai/blog/ccpa-requirements-2026-complete-compliance-guide)
- [20 State Privacy Laws in Effect in 2026 — MultiState](https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026)
- [U.S. State Privacy Laws: The 2026 Comparison Guide — Clym](https://www.clym.io/blog/us-privacy-law-comparison-map)
- [California's marketplace facilitator sales tax law, explained — TaxJar](https://www.taxjar.com/blog/california-marketplace-facilitator-sales-tax-law)
- [Marketplace Facilitator Laws 101: State By State (2026) — Numeral](https://www.numeral.com/blog/marketplace-facilitator)
- [Tax Guide for Marketplace Facilitator Act — CDTFA](https://cdtfa.ca.gov/industry/MPFAct.htm)
- [Tax Guide for Auto Repair Garages Industry Topics — CDTFA](https://cdtfa.ca.gov/industry/auto-repair-garages/industry-topics.htm)
- [Specialty Repairs or Services — CDTFA](https://cdtfa.ca.gov/industry/auto-repair-garages/specialty-repairs-or-services.htm)
