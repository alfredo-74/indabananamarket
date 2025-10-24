import { BacktestPanel } from "@/components/BacktestPanel";
import { NavigationHeader } from "@/components/NavigationHeader";

export default function Backtest() {
  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <NavigationHeader />
      <div className="flex-1 overflow-auto">
        <BacktestPanel />
      </div>
    </div>
  );
}
