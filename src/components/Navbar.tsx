import { NavLink as RouterNavLink } from "react-router-dom";
import { Shield } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Analyze" },
  { to: "/compare", label: "Compare" },
  { to: "/about", label: "About" },
];

export function Navbar() {
  return (
    <nav className="glass-panel sticky top-0 z-[60] border-b border-cyan-500/10 px-4 h-14">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
        <RouterNavLink
          to="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Shield className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="font-display text-sm font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            AudioNotary
          </span>
        </RouterNavLink>

        <div className="flex items-center gap-1">
          {links.map(link => (
            <RouterNavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`
              }
            >
              {link.label}
            </RouterNavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
