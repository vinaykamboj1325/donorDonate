import { useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from '../supabaseClient'
import { searchDonors } from '../api'
import { BLOOD_GROUPS, DONOR_TYPES } from '../constants'
import DonorCard from './DonorCard'
import RequestModal from './RequestModal'

export default function SearchDonors() {
  const [bloodGroup, setBloodGroup] = useState('')
  const [donorType, setDonorType] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(true)

  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState(null)

  const runSearch = useCallback(async () => {
    if (!isConfigured) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const data = await searchDonors({ bloodGroup, donorType, city, area, onlyAvailable })
      setDonors(data || [])
    } catch (e) {
      setError(e.message || 'Search failed.')
    } finally {
      setLoading(false)
    }
  }, [bloodGroup, donorType, city, area, onlyAvailable])

  // Real-time: refresh results whenever any donor's availability changes.
  useEffect(() => {
    if (!isConfigured || !searched) return
    const channel = supabase
      .channel('donors-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donors' }, runSearch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [searched, runSearch])

  return (
    <section>
      <form
        className="card search"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch()
        }}
      >
        <div className="grid">
          <label>
            Blood group
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
              <option value="">Any</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Need
            <select value={donorType} onChange={(e) => setDonorType(e.target.value)}>
              <option value="">Blood or plasma</option>
              {DONOR_TYPES.filter((t) => t.value !== 'both').map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Jaipur" />
          </label>
          <label>
            Area / locality
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Vaishali Nagar" />
          </label>
        </div>

        <div className="row between wrap">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            Show only donors available now
          </label>
          <button className="btn primary" type="submit" disabled={loading || !isConfigured}>
            {loading ? 'Searching…' : 'Search donors'}
          </button>
        </div>
      </form>

      {error && <div className="alert error">{error}</div>}

      {searched && !loading && !error && donors.length === 0 && (
        <div className="empty">
          <p>No donors found for this filter.</p>
          <p className="muted">Try widening the area, or turn off “available now”.</p>
        </div>
      )}

      {donors.length > 0 && (
        <p className="muted result-count">
          {donors.length} donor{donors.length > 1 ? 's' : ''} found · updates live
        </p>
      )}

      <div className="results">
        {donors.map((d) => (
          <DonorCard key={d.id} donor={d} onRequest={() => setSelected(d)} />
        ))}
      </div>

      {selected && <RequestModal donor={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
