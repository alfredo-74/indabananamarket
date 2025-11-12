import { LayoutDashboard } from "lucide-react";

export function NavigationHeader() {
  return (
    <header className="border-b bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">OF</span>
          </div>
          <h1 className="text-lg font-semibold">
            <LayoutDashboard className="w-5 h-5 inline-block mr-2" />
            OrderFlow AI - Live Trading
          </h1>
        </div>
      </div>
    </header>
  );
}
