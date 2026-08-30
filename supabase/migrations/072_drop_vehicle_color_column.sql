-- ============================================================
-- 072: Drop customer_profiles.vehicle_color, added moments ago in 071.
--
-- Turns out the app already has a purpose-built system for this — a
-- device-local paint accent (PaintContext.jsx, PAINTS, --accent CSS var,
-- "Your garage" card in CustomerSettings.jsx) that was designed for
-- exactly "detect the car's color and theme the personal UI to match,"
-- with its own richer 14-color named palette and its own manual-override
-- picker already built. A second, DB-persisted color field would just be
-- a competing, unused source of truth. The onboarding photo scan (071's
-- actual purpose, extract-vehicle-photo) now feeds its detected color
-- straight into that existing system via usePaint().setAccent() instead.
-- vehicle_year (071's other addition) stays — there was no prior feature
-- for that at all.
-- ============================================================

alter table public.customer_profiles drop column if exists vehicle_color;
