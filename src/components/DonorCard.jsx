import { DONOR_TYPES } from '../constants'

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function DonorCard({ donor, onRequest }) {
  const type = DONOR_TYPES.find((t) => t.value === donor.donor_type)?.label || 'Blood'
  return (
    <div className="card donor">
      <div className="donor-top">
        <span className="blood-badge">{donor.blood_group}</span>
        <div className="donor-info">
          <h3>{donor.name}</h3>
          <p className="muted">📍 {donor.area}, {donor.city}</p>
          <p className="muted small">Donates: {type}</p>
        </div>
        <span className={donor.available ? 'status on' : 'status off'}>
          {donor.available ? 'Available now' : 'Unavailable'}
        </span>
      </div>
      <div className="donor-bottom">
        <span className="muted small">
          {donor.available
            ? `Verified ${timeAgo(donor.last_available_at)}`
            : 'Not available right now'}
        </span>
        <button className="btn primary sm" disabled={!donor.available} onClick={onRequest}>
          Request donor
        </button>
      </div>
    </div>
  )
}
