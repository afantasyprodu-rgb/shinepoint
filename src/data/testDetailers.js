import { fuzzyPinForZip } from '../lib/fuzzyPin'

// Hardcoded test detailers (Blueprint Phase 1). Replaced by a Supabase
// query against detailer_profiles in Phase 2.
const rows = [
  {
    id: 'test-1',
    name: "Marco's Mobile Shine",
    rating: 4.9,
    reviews: 128,
    zip: '90026',
    area: 'Echo Park',
    status: 'available',
    acceptsWhenBusy: false,
    services: ['Exterior Wash', 'Interior Deep Clean', 'Wax & Seal'],
  },
  {
    id: 'test-2',
    name: 'Westside Detail Co.',
    rating: 4.7,
    reviews: 86,
    zip: '90405',
    area: 'Santa Monica',
    status: 'busy',
    acceptsWhenBusy: true,
    services: ['Full Detail', 'Pet Hair Removal'],
  },
  {
    id: 'test-3',
    name: 'Crown Auto Spa',
    rating: 4.8,
    reviews: 204,
    zip: '90008',
    area: 'Baldwin Hills',
    status: 'available',
    acceptsWhenBusy: false,
    services: ['Exterior Wash', 'Ceramic Coating'],
  },
  {
    id: 'test-4',
    name: 'Valley Gloss',
    rating: 4.5,
    reviews: 41,
    zip: '91401',
    area: 'Van Nuys',
    status: 'offline',
    acceptsWhenBusy: false,
    services: ['Exterior Wash', 'Engine Bay Clean'],
  },
  {
    id: 'test-5',
    name: 'Pearl Finish Detailing',
    rating: 5.0,
    reviews: 67,
    zip: '90291',
    area: 'Venice',
    status: 'available',
    acceptsWhenBusy: false,
    services: ['Full Detail', 'Headlight Restoration'],
  },
  {
    id: 'test-6',
    name: 'DTLA Detail Lab',
    rating: 4.6,
    reviews: 152,
    zip: '90013',
    area: 'Downtown LA',
    status: 'busy',
    acceptsWhenBusy: false,
    services: ['Interior Deep Clean', 'Odor Removal'],
  },
]

export const TEST_DETAILERS = rows.map((d) => ({
  ...d,
  pin: fuzzyPinForZip(d.zip, d.id),
}))
