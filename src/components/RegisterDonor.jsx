import { useState } from 'react'
import { registerDonor } from '../api'
import { isConfigured } from '../supabaseClient'
import { BLOOD_GROUPS, DONOR_TYPES } from '../constants'

export default function RegisterDonor({ onDone }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    pin: '',
    blood_group: '',
    donor_type: 'blood',
    city: '',
    area: '',
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
      await registerDonor(form)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="card success">
        <div className="big">🎉</div>
        <h2>You’re a registered donor!</h2>
        <p>
          Thank you for helping save lives. Manage your availability anytime in the{' '}
          <strong>Donor dashboard</strong> using your phone number.
        </p>
        <button className="btn primary" onClick={onDone}>Find donors</button>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Become a donor</h2>
      <p className="muted">Your phone number stays private — seekers never see it. You choose who to help.</p>
      <form onSubmit={submit}>
        <div className="grid two">
          <label>
            Full name
            <input required value={form.name} onChange={set('name')} />
          </label>
          <label>
            Phone (private) 🔒
            <input required value={form.phone} onChange={set('phone')} placeholder="e.g. 919812345678" />
          </label>
        </div>
        <label>
          Secret PIN (4-6 digits) — for your dashboard login
          <input
            required
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,6}"
            maxLength="6"
            value={form.pin}
            onChange={set('pin')}
            placeholder="e.g. 4821 — remember this!"
          />
        </label>
        <div className="grid two">
          <label>
            Blood group
            <select required value={form.blood_group} onChange={set('blood_group')}>
              <option value="">Select</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            I can donate
            <select value={form.donor_type} onChange={set('donor_type')}>
              {DONOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid two">
          <label>
            City
            <input required value={form.city} onChange={set('city')} placeholder="e.g. Jaipur" />
          </label>
          <label>
            Area / locality
            <input required value={form.area} onChange={set('area')} placeholder="e.g. Vaishali Nagar" />
          </label>
        </div>

        {error && <div className="alert error">{error}</div>}

        <button className="btn primary block" disabled={busy || !isConfigured}>
          {busy ? 'Registering…' : 'Register as donor'}
        </button>
      </form>
    </section>
  )
}
