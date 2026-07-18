import { useState } from 'react'
import { getMyProfile, getMyRequests, setAvailability, updateRequestStatus } from '../api'
import { isConfigured } from '../supabaseClient'
import { URGENCY } from '../constants'
import { pushSupported, enablePushForDonor } from '../push'

const waLink = (num) => `https://wa.me/${String(num).replace(/[^0-9]/g, '')}`

export default function DonorDashboard() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 'off' until we have actually saved a subscription for this donor —
  // browser permission alone doesn't mean the database has one.
  const [pushState, setPushState] = useState('off')

  async function enableAlerts() {
    setPushState('busy')
    try {
      await enablePushForDonor(phone, pin)
      setPushState('on')
    } catch (err) {
      setError(err.message)
      setPushState('off')
    }
  }

  async function load(e) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const [p, r] = await Promise.all([getMyProfile(phone, pin), getMyRequests(phone, pin)])
      setProfile(p)
      setRequests(r || [])
      // Permission already granted: silently re-save the subscription so the
      // database always has a current one for this device (no prompt shown).
      if (pushSupported() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        enablePushForDonor(phone, pin)
          .then(() => setPushState('on'))
          .catch(() => setPushState('off'))
      }
    } catch (err) {
      setError(err.message || 'Could not load your profile.')
      setProfile(null)
    } finally {
      setBusy(false)
    }
  }

  async function toggle() {
    setBusy(true)
    try {
      const updated = await setAvailability(phone, pin, !profile.available)
      setProfile(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function act(id, status) {
    try {
      await updateRequestStatus(id, phone, pin, status)
      setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!profile) {
    return (
      <section className="card">
        <h2>Donor dashboard</h2>
        <p className="muted">
          Log in with your registered phone number and secret PIN to manage availability and requests.
        </p>
        <form onSubmit={load} className="row wrap">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Registered phone number"
            required
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength="6"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            required
            style={{ maxWidth: 120 }}
          />
          <button className="btn primary" disabled={busy || !isConfigured}>
            {busy ? 'Loading…' : 'Open dashboard'}
          </button>
        </form>
        {error && <div className="alert error">{error}</div>}
      </section>
    )
  }

  return (
    <section>
      <div className="card">
        <div className="row between wrap">
          <div>
            <h2>
              {profile.name} <span className="blood-badge sm">{profile.blood_group}</span>
            </h2>
            <p className="muted">📍 {profile.area}, {profile.city}</p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={profile.available} onChange={toggle} disabled={busy} />
            <span className={profile.available ? 'switch-label on' : 'switch-label'}>
              {profile.available ? 'Available now' : 'Unavailable'}
            </span>
          </label>
        </div>
        {pushSupported() && pushState !== 'on' && (
          <div className="push-banner">
            <span>🔔 Get an instant alert on this device when someone needs your blood.</span>
            <button className="btn primary sm" onClick={enableAlerts} disabled={pushState === 'busy'}>
              {pushState === 'busy' ? 'Enabling…' : 'Enable notifications'}
            </button>
          </div>
        )}
        {pushSupported() && pushState === 'on' && (
          <p className="muted small note">🔔 Request alerts are ON for this device.</p>
        )}
        {error && <div className="alert error">{error}</div>}
      </div>

      <h3 className="section-title">Requests for you ({requests.length})</h3>
      {requests.length === 0 && <p className="muted">No requests yet.</p>}

      <div className="results">
        {requests.map((r) => (
          <div className="card req" key={r.id}>
            <div className="row between">
              <strong>{r.requester_name}</strong>
              <span className={`pill ${r.urgency}`}>
                {URGENCY.find((u) => u.value === r.urgency)?.label || r.urgency}
              </span>
            </div>
            <p className="muted small">
              {r.hospital ? `🏥 ${r.hospital} · ` : ''}{r.units} unit(s)
            </p>
            {r.note && <p className="small quote">“{r.note}”</p>}
            <span className={`badge ${r.status}`}>{r.status}</span>
            <div className="row actions">
              <a
                className="btn wa sm"
                href={waLink(r.requester_phone)}
                target="_blank"
                rel="noreferrer"
                onClick={() => act(r.id, 'accepted')}
              >
                💬 Reply on WhatsApp
              </a>
              {r.status !== 'declined' && (
                <button className="btn ghost sm" onClick={() => act(r.id, 'declined')}>
                  Decline
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
