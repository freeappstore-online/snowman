import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_LINKS = [
  { to: "https://freeappstore.online", label: "Apps", external: true },
  { to: "https://freegamestore.online", label: "Games", external: true },
  { to: "https://freeappstore.online/about.html", label: "About", external: true },
  { to: "https://freeappstore.online/contribute.html", label: "Build", external: true },
  { to: "/", label: "VibeCode" },
  { to: "https://proappstore.online", label: "Pro", external: true, className: "pro-link" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signIn } = useAuth();
  const location = useLocation();

  return (
    <header className="border-b border-[var(--line)] py-3">
      <div className="container flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold tracking-tight no-underline text-[var(--ink)]">
          Free <span className="text-[var(--accent)]">Apps</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-5">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                className={`text-sm font-semibold no-underline ${link.className === 'pro-link' ? 'text-[var(--pro)]' : 'text-[var(--muted)]'} ${link.className || ''}`}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-semibold no-underline ${location.pathname === link.to ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
              >
                {link.label}
              </Link>
            ),
          )}
          {user ? (
            <Link to="/profile">
              <img
                src={user.photo_url || ""}
                alt={user.name}
                className="w-7 h-7 rounded-full border-2 border-[var(--line)]"
              />
            </Link>
          ) : (
            <button
              onClick={signIn}
              className="text-sm font-semibold text-[var(--accent)] bg-transparent border-0 cursor-pointer"
            >
              Sign in
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden bg-transparent border-0 text-[1.2rem] text-[var(--ink)] cursor-pointer"
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
        >
          &#9776;
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed top-0 right-0 z-50 flex flex-col gap-1 p-4 w-[220px] h-[100dvh] bg-[var(--surface)] border-l border-[var(--line)] shadow-[−4px_0_20px_rgba(0,0,0,0.1)]"
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="self-end mb-2 bg-transparent border-0 text-[var(--muted)] text-base cursor-pointer"
            >
              &#10005;
            </button>
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.to}
                  href={link.to}
                  className={`block py-2 text-base font-semibold no-underline ${link.className === 'pro-link' ? 'text-[var(--pro)]' : 'text-[var(--muted)]'}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block py-2 text-base font-semibold no-underline ${location.pathname === link.to ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
            {user ? (
              <Link to="/profile" className="flex items-center gap-2 mt-4" onClick={() => setMenuOpen(false)}>
                <img src={user.photo_url || ""} alt={user.name} className="w-6 h-6 rounded-full" />
                <span className="text-sm font-semibold text-[var(--ink)]">{user.name}</span>
              </Link>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); signIn(); }}
                className="mt-4 text-sm font-semibold text-[var(--accent)] bg-transparent border-0 cursor-pointer text-left"
              >
                Sign in
              </button>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
