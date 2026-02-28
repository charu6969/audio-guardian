import { Link, useLocation } from "react-router-dom";
import { Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Audio<span className="text-primary">Notary</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {[
            { to: "/", label: "Analysis" },
            { to: "/compare", label: "Compare" },
            { to: "/about", label: "About" },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors ${
                isActive(link.to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Generate Report</span>
        </Button>
      </nav>
    </header>
  );
}
