# UX laws cheat sheet — reusable across projects

A quick-reference for applying classic UX/psychology laws to interface design.
Not tied to any one codebase — copy this file into any project's `docs/` folder
(or paste into its CLAUDE.md) as a shared checklist during design/review passes.

---

## Jakob's Law
**Users spend most of their time on *other* apps.** They expect yours to work the
same way — same icon meanings, same gesture conventions, same place for "back."
Don't get clever with navigation just to be different.
- Audit: does back/close/menu sit where every other app puts it? Do standard
  icons (hamburger, bell, gear, chevron) mean what they always mean?
- Deviating from convention should be a deliberate, justified choice — not an
  accident of not checking what's normal.

## Hick's Law
**More choices/options = longer it takes to decide.** Every extra item in a menu
or extra field on a form adds decision latency, not just scroll length.
- Audit: can any list be trimmed, defaulted, or split into a "common" vs.
  "advanced" tier? Progressive disclosure (hide the rare 20% until asked for)
  beats showing everything at once.

## Fitts's Law
**Time to reach a target is a function of its size and distance from the
current pointer/finger position.** Bigger and closer = faster and more accurate.
- Audit: primary/time-critical actions should be large ($\geq$44px tap targets
  on mobile) and positioned within comfortable thumb reach, not tucked in a
  corner or shrunk to fit alongside secondary actions.
- The more consequential or urgent the action, the less it should be punished
  with a tiny hitbox.

## Miller's Law
**Working memory holds about 7±2 chunks at once.** A flat list of 12 items
is harder to scan than the same 12 items in 3 labeled groups of 4.
- Audit: group and label long lists/menus instead of presenting one flat run.
  Chunking (not just shortening) is the fix — the total information can stay
  the same if it's organized.

## Von Restorff Effect (isolation effect)
**An item that visually stands out from its surroundings is disproportionately
remembered/noticed.** If everything is emphasized, nothing is.
- Audit: is there exactly one clearly distinct element per screen for the
  thing you most want noticed (a primary CTA, a best-value plan, a flagship
  option)? Reserve the "different" treatment — color, size, badge — for that
  one thing.

## Serial Position Effect
**People best remember the first and last items in a list/sequence** (primacy +
recency), and forget the middle disproportionately.
- Audit: put the most important option first, the second-most-important last,
  and bury lower-priority items in the middle — don't order alphabetically or
  arbitrarily when order affects what gets chosen/remembered.

## Tesler's Law (conservation of complexity)
**Every process has inherent complexity that can't be removed, only moved** —
the question is whether the user or the system absorbs it.
- Audit: for every "the user has to figure this out" moment, ask whether the
  system could compute/default/infer it instead (smart defaults, autofill,
  inferred values) rather than pushing raw complexity onto the person least
  equipped to handle it.

## Doherty Threshold
**Keep system response under ~400ms** — above that, the user's attention drifts
and perceived productivity drops, even if the eventual result is correct.
- Audit: does every tap get *some* feedback (spinner, disabled state, optimistic
  UI update) within 400ms, even if the real operation takes longer? A silent
  gap reads as broken, not "loading."

## Peak-End Rule
**People judge an experience mostly by its most intense moment (peak) and how
it ends** — not by the average of every step along the way.
- Audit: what's the peak moment of this flow (the payoff), and does the ending
  land well (confirmation, celebration, clear next step)? A rough middle is
  forgivable if the peak and the ending are strong; a flat/abrupt ending
  undersells an otherwise good flow.

---

## Applying these together
They frequently reinforce each other in the same piece of UI:
- Chunk a long list (Miller's) → put the best item first/last in each chunk
  (serial position) → make the single best item in the whole screen visually
  distinct (Von Restorff).
- Make the primary action big and reachable (Fitts's) → give it instant
  feedback on tap (Doherty) → make its completion moment feel rewarding
  (Peak-End).
- Reduce the choices shown at once (Hick's) by pushing the complexity of
  picking a sensible default onto the system instead of the user (Tesler's).

## Worked example (from ShinePoint's detailer onboarding)
- **Miller's + Serial position**: an 8-item flat service checklist became two
  labeled groups of 4 ("Core services" / "Premium add-ons"), with the
  flagship service leading the first group and the best-margin service
  leading the second.
- **Von Restorff**: that best-margin service also got a distinct amber "Best
  margin" badge + ring — the one visually different card on the screen.
- **Fitts's**: a time-critical Accept/Decline button pair (30-minute response
  window) was bumped from a 40px to a 44px tap target.
- **Peak-End** (already in place, worth preserving as a pattern): a full-screen
  "Thank you 💚" moment after a tip is sent, not just a toast — the flow's
  peak and its end are the same beat.
