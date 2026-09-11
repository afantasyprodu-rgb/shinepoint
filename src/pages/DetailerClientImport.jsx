import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  parseCsv,
  suggestCsvMapping,
  mapCsvRecord,
  normalizePhone,
  fetchDetailerClients,
  insertDetailerClientsBulk,
  formatPhoneDisplay,
} from '../lib/detailerClients'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const FIELD_KEYS = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'notes', label: 'Notes' },
  { key: 'vehicle', label: 'Vehicle' },
]

export default function DetailerClientImport() {
  const navigate = useNavigate()
  const { detailerProfile, isDemo } = useStore()
  const detailerId = detailerProfile?.id

  const [headers, setHeaders] = useState([])
  const [records, setRecords] = useState([])
  const [mapping, setMapping] = useState({
    full_name: '', phone: '', email: '', notes: '', vehicle: '',
  })
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const preview = useMemo(() => {
    return records.slice(0, 40).map((rec, idx) => {
      const mapped = mapCsvRecord(rec, mapping)
      return { idx, mapped, raw: rec }
    })
  }, [records, mapping])

  async function onFile(e) {
    setError('')
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      const text = await file.text()
      const { headers: hdrs, records: rows } = parseCsv(text)
      if (!hdrs.length) {
        setError('Could not find a header row in that CSV.')
        return
      }
      setHeaders(hdrs)
      setRecords(rows)
      setMapping(suggestCsvMapping(hdrs))
    } catch (err) {
      setError(err.message ?? String(err))
    }
  }

  function setMapField(key, value) {
    setMapping((m) => ({ ...m, [key]: value }))
  }

  async function runImport() {
    setError('')
    setResult(null)
    if (!mapping.full_name) {
      setError('Map a column to Full name before importing.')
      return
    }
    if (isDemo) {
      setResult({ inserted: preview.filter((p) => p.mapped.full_name).length, skipped: 0, dupes: 0 })
      return
    }
    if (!detailerId) {
      setError('Detailer profile not loaded yet.')
      return
    }

    setImporting(true)
    try {
      const existing = await fetchDetailerClients(detailerId)
      const phoneSet = new Set(
        existing.map((c) => normalizePhone(c.phone)).filter(Boolean),
      )
      const batchPhones = new Set()
      const toInsert = []
      let skipped = 0
      let dupes = 0

      for (const rec of records) {
        const mapped = mapCsvRecord(rec, mapping)
        if (!mapped.full_name) {
          skipped += 1
          continue
        }
        const norm = normalizePhone(mapped.phone)
        if (norm && (phoneSet.has(norm) || batchPhones.has(norm))) {
          dupes += 1
          continue
        }
        if (norm) batchPhones.add(norm)
        toInsert.push({
          detailer_id: detailerId,
          full_name: mapped.full_name,
          phone: norm || null,
          email: mapped.email,
          notes: mapped.notes,
          vehicles: mapped.vehicles,
          sms_opt_in: false,
          imported_from: fileName ? `csv:${fileName}` : 'csv',
        })
      }

      // Chunk inserts to avoid payload limits
      let inserted = 0
      const CHUNK = 100
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK)
        const rows = await insertDetailerClientsBulk(chunk)
        inserted += rows.length
      }
      setResult({ inserted, skipped, dupes })
      if (inserted > 0) {
        window.setTimeout(() => navigate('/detailer/clients'), 1200)
      }
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setImporting(false)
    }
  }

  // Flag preview rows that collide with each other on normalized phone
  const previewPhoneCounts = useMemo(() => {
    const counts = new Map()
    for (const p of preview) {
      const n = normalizePhone(p.mapped.phone)
      if (!n) continue
      counts.set(n, (counts.get(n) || 0) + 1)
    }
    return counts
  }, [preview])

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.blobB} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to="/detailer/clients" className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>CRM</span>
            </div>
          </div>

          <h1 className={styles.title}>Import clients</h1>
          <p className={styles.tag}>Upload a CSV (Square export works). Map columns, preview, then import.</p>
          <div className={styles.wave} aria-hidden="true" />

          {error && <div className={styles.error} role="alert">{error}</div>}
          {result && (
            <div className={styles.success} role="status">
              Imported {result.inserted}. Skipped empty name: {result.skipped}. Phone dupes skipped: {result.dupes}.
            </div>
          )}
          {isDemo && (
            <div className={styles.stubBanner}>Demo mode — import counts only; nothing is written.</div>
          )}

          <div className={styles.field}>
            <label htmlFor="cb-csv">CSV file</label>
            <input id="cb-csv" type="file" accept=".csv,text/csv" onChange={onFile} />
            {fileName && <p className={styles.meta}>{fileName} · {records.length} rows</p>}
          </div>

          {headers.length > 0 && (
            <>
              <h2 className={styles.sectionTitle}>Column map</h2>
              {FIELD_KEYS.map(({ key, label, required }) => (
                <div className={styles.field} key={key}>
                  <label htmlFor={`map-${key}`}>
                    {label}{required && <span className={styles.req}>*</span>}
                  </label>
                  <select
                    id={`map-${key}`}
                    value={mapping[key]}
                    onChange={(e) => setMapField(key, e.target.value)}
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}

              <h2 className={styles.sectionTitle}>Preview</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ idx, mapped }) => {
                      const norm = normalizePhone(mapped.phone)
                      const dupeInFile = norm && (previewPhoneCounts.get(norm) || 0) > 1
                      return (
                        <tr key={idx}>
                          <td>{mapped.full_name || <em className={styles.dupe}>missing</em>}</td>
                          <td>{mapped.phone ? formatPhoneDisplay(mapped.phone) : '—'}</td>
                          <td>
                            {dupeInFile && <span className={styles.dupe}>dupe phone</span>}
                            {!mapped.full_name && <span className={styles.dupe}> skip</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {records.length > preview.length && (
                <p className={styles.meta}>Showing first {preview.length} of {records.length}.</p>
              )}

              <button
                type="button"
                className={styles.btnPink}
                style={{ width: '100%', marginTop: '0.75rem' }}
                onClick={runImport}
                disabled={importing || !records.length}
              >
                {importing ? 'Importing…' : `Import ${records.length} rows`}
              </button>
            </>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}
