import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../auth'
import {
  LayoutDashboard, FileText, Briefcase, Mail, Image, Settings, LogOut, Users,
} from 'lucide-react'

const nav = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/blog',       icon: FileText,        label: 'Blog' },
  { to: '/cases',      icon: Briefcase,       label: 'Cases' },
  { to: '/forms',      icon: Mail,            label: 'Forms' },
  { to: '/newsletter', icon: Users,           label: 'Newsletter' },
  { to: '/media',      icon: Image,           label: 'Media' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]

export default function Layout() {
  const navigate = useNavigate()
  function logout() { clearToken(); navigate('/login') }

  return (
    <div className="flex h-screen" style={{ background: 'var(--paper)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0"
        style={{ background: 'var(--ink)' }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span
            className="font-serif-italic text-white text-2xl leading-none"
          >
            Lumiva
          </span>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
            admin panel
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'text-white'
                    : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                background: isActive ? 'rgba(255,255,255,0.08)' : undefined,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full"
                      style={{ height: '60%', background: 'var(--orange)' }}
                    />
                  )}
                  <Icon size={16} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 500 : 400 }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-5 py-4 text-sm transition-colors"
          style={{
            color: 'rgba(255,255,255,0.35)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
        >
          <LogOut size={16} />Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--paper)' }}>
        <Outlet />
      </main>
    </div>
  )
}
