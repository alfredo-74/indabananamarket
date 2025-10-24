import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ControlSettings } from "@shared/schema";
import { Power, AlertTriangle } from "lucide-react";

interface ControlPanelProps {
  settings: ControlSettings;
  onSettingsChange: (settings: Partial<ControlSettings>) => void;
  onEmergencyStop: () => void;
}

export function ControlPanel({ settings, onSettingsChange, onEmergencyStop }: ControlPanelProps) {
  return (
    <Card className="p-6" data-testid="container-control-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trading Controls
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-trading" className="text-sm font-medium font-sans">
              Auto Trading
            </Label>
            <Switch
              id="auto-trading"
              checked={settings.auto_trading}
              onCheckedChange={(checked) => onSettingsChange({ auto_trading: checked })}
              data-testid="switch-auto-trading"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enable automated trade execution
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="volume-target" className="text-sm font-medium font-sans">
            Volume Target
          </Label>
          <Input
            id="volume-target"
            type="number"
            value={settings.volume_target}
            onChange={(e) => onSettingsChange({ volume_target: parseInt(e.target.value) || 0 })}
            className="font-mono tabular-nums"
            data-testid="input-volume-target"
          />
          <p className="text-xs text-muted-foreground">
            Test: 100 | Production: 5000
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cd-threshold" className="text-sm font-medium font-sans">
            CD Threshold
          </Label>
          <Input
            id="cd-threshold"
            type="number"
            value={settings.cd_threshold}
            onChange={(e) => onSettingsChange({ cd_threshold: parseInt(e.target.value) || 0 })}
            className="font-mono tabular-nums"
            data-testid="input-cd-threshold"
          />
          <p className="text-xs text-muted-foreground">
            Cumulative delta trigger (±50)
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="symbol" className="text-sm font-medium font-sans">
            Symbol
          </Label>
          <Input
            id="symbol"
            value={settings.symbol}
            onChange={(e) => onSettingsChange({ symbol: e.target.value })}
            className="font-mono uppercase"
            data-testid="input-symbol"
          />
          <p className="text-xs text-muted-foreground">
            Trading instrument
          </p>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium font-sans">Emergency Stop</p>
          <p className="text-xs text-muted-foreground">
            Immediately close all positions and halt trading
          </p>
        </div>

        <Button
          variant="destructive"
          size="lg"
          onClick={onEmergencyStop}
          className="gap-2"
          data-testid="button-emergency-stop"
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">STOP</span>
        </Button>
      </div>
    </Card>
  );
}
