import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Droplets, Plus, Menu, X, Shield, BookOpen, Compass, Search } from 'lucide-react';
import PartnerLogo from './PartnerLogo';
import Button from './Button';

/**
 * SiteHeader Component - SIPEPES v2.0
 * Header situs publik warga untuk laptop & browser HP.
 */
export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Beranda & Peta', icon: Compass },
    { to: '/lapor', label: 'Buat Laporan', icon: Plus },
    { to: '/lacak', label: 'Lacak Laporan', icon: Search },
    { to: '/panduan', label: 'Panduan', icon: BookOpen }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-garis shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
        
        {/* Brand Kiri: Logo GG River Care + SIPEPES x Green Generation Palembang */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 sm:gap-3 group select-none cursor-pointer"
          >
            <PartnerLogo size={40} className="group-hover:scale-105 transition-transform duration-150 ease-halus" />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-lg sm:text-xl font-extrabold text-ink tracking-tight block leading-none">
                  SIPEPES
                </span>
                <span className="text-xs sm:text-sm font-bold text-musi-600 block leading-none">
                  &times; Green Generation Palembang
                </span>
              </div>
              <span className="text-xs font-semibold text-ink-muted leading-tight mt-1 block">
                Program GG River Care &bull; Sungai Musi
              </span>
            </div>
          </Link>
        </div>

        {/* Navigasi Desktop (>= 768px) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-full text-xs lg:text-sm font-semibold transition-all duration-150 ease-halus select-none ${
                  isActive
                    ? 'bg-musi-100 text-musi-800'
                    : 'text-ink-soft hover:text-ink hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Tombol Kanan: Masuk Admin & Menu Mobile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Tombol Masuk Admin */}
          <Link to="/admin/login">
            <Button variant="garis" size="sm" className="hidden lg:inline-flex">
              <Shield className="w-3.5 h-3.5 text-ink-soft" />
              <span>Admin</span>
            </Button>
          </Link>

          {/* Hamburger Menu Toggle (Mobile < 768px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-2xl border border-garis bg-white flex items-center justify-center text-ink hover:bg-slate-50 transition cursor-pointer"
            aria-label="Buka Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown (< 768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-garis bg-white px-4 py-4 space-y-3 shadow-lembut animate-fade-in">
          {/* Partner Info on Mobile */}
          <div className="pb-3 border-b border-garis flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Inisiatif Mandiri Komunitas</span>
            <span className="px-2.5 py-0.5 rounded-full bg-toska-100 text-toska-800 text-xs font-bold">GG River Care</span>
          </div>

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-musi-100 text-musi-800'
                      : 'text-ink-soft hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-garis flex flex-col gap-2">
            <Link to="/lapor" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ajakan" size="md" className="w-full">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Laporkan Pencemaran</span>
              </Button>
            </Link>

            <Link to="/admin/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="garis" size="md" className="w-full">
                <Shield className="w-4 h-4 text-ink-soft" />
                <span>Masuk Portal Admin</span>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

