import { useState } from 'react'
import { createRequest } from '../api'
import { URGENCY } from '../constants'

export default function RequestModal({ donor, onClose }) {
  const [form, setForm] = useState({
    requesterName: '',
    requesterPhone: '',
    hospital: '',
    units: 1,
    urgency: 'urgent',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createRequest({ donorId: donor.id, ...form })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not send request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {done ? (
          <div className="success">
            <div className="big">✅</div>
            <h3>Request sent to {donor.name}</h3>
            <p>
              To protect privacy we never share the donor’s number. {donor.name} gets your
              request and will message you on WhatsApp if they can help.
            </p>
            <button className="btn primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>
              Request <span className="blood-badge sm">{donor.blood_group}</span> from {donor.name}
            </h3>
            <p className="muted small">📍 {donor.area}, {donor.city}</p>

            <label>
              Your name
              <input required value={form.requesterName} onChange={set('requesterName')} />
            </label>
            <label>
              Your WhatsApp number
              <input
                required
                value={form.requesterPhone}
                onChange={set('requesterPhone')}
                placeholder="e.g. 919812345678"
              />
            </label>
            <div className="grid two">
              <label>
                Hospital
                <input value={form.hospital} onChange={set('hospital')} placeholder="Hospital / location" />
              </label>
              <label>
                Units needed
                <input type="number" min="1" value={form.units} onChange={set('units')} />
              </label>
            </div>
            <label>
              Urgency
              <select value={form.urgency} onChange={set('urgency')}>
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </label>
            <label>
              Note (optional)
              <textarea rows="2" value={form.note} onChange={set('note')} placeholder="Any details for the donor" />
            </label>

            {error && <div className="alert error">{error}</div>}

            <p className="privacy-note">🔒 The donor’s phone stays private. They contact you if available.</p>
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
