import { useState } from 'react'
import { isConfigured } from './supabaseClient'
import Header from './components/Header'
import SearchDonors from './components/SearchDonors'
import RegisterDonor from './components/RegisterDonor'
import DonorDashboard from './components/DonorDashboard'

const TABS = [
  { id: 'find', label: 'Find donors' },
  { id: 'register', label: 'Become a donor' },
  { id: 'dashboard', label: 'Donor dashboard' },
]

export default function App() {
  const [tab, setTab] = useState('find')

  return (
    <div className="app">
      <Header />

      {!isConfigured && (
        <div className="container">
          <div className="banner">
            <strong>Supabase not configured.</strong> Add your{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the{' '}
            <code>.env</code> file, then restart <code>npm run dev</code>. See{' '}
            <code>README.md</code> for the 3-minute setup.
          </div>
        </div>
      )}

      <nav className="tabs container">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="container">
        {tab === 'find' && <SearchDonors />}
        {tab === 'register' && <RegisterDonor onDone={() => setTab('find')} />}
        {tab === 'dashboard' && <DonorDashboard />}
      </main>

      <footer className="footer">
        BloodLink · privacy-first donor matching · built to save lives
      </footer>
    </div>
  )
}
