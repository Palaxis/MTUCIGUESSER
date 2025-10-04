import { Link, Outlet, useLocation } from 'react-router-dom'

export default function App() {
  const loc = useLocation()
  return (
    <div className="container">
      <nav className="nav">
        <div className="brand">MTU Campus GeoGuesser</div>
        <div className="links">
          <Link className={loc.pathname === '/' ? 'active' : ''} to="/">Play</Link>
          <Link className={loc.pathname.startsWith('/admin') ? 'active' : ''} to="/admin">Admin</Link>
        </div>
      </nav>
      <Outlet />
    </div>
  )
}


