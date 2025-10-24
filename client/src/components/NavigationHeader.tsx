import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BarChart3 } from "lucide-react";

export function NavigationHeader() {
  const [location] = useLocation();

  return (
    <header className="border-b bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">OF</span>
          </div>
          <h1 className="text-lg font-semibold">OrderFlow AI</h1>
        </div>

        <nav className="flex gap-1">
          <Link href="/">
            <Button
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              className="gap-2"
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/backtest">
            <Button
              variant={location === "/backtest" ? "default" : "ghost"}
              size="sm"
              className="gap-2"
              data-testid="nav-backtest"
            >
              <BarChart3 className="w-4 h-4" />
              Backtest
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
