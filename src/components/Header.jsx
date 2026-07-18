export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <div className="portal" aria-hidden="true">
            <span className="portal-ring" />
            <span className="portal-ring r2" />
            <span className="logo">🩸</span>
          </div>
          <div>
            <h1><span className="grad-text">Hemyra</span></h1>
            <p>Find verified blood &amp; plasma donors near you</p>
          </div>
        </div>
        <div className="header-tag">⚡ Real-time &nbsp;·&nbsp; 📍 Hyperlocal &nbsp;·&nbsp; 🔒 Privacy-first</div>
      </div>
    </header>
  )
}
