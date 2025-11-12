import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ControlSettings } from "@shared/schema";
import { AlertTriangle } from "lucide-react";

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
          Order Flow Trading Controls
        </h3>
      </div>

      {/* Auto Trading Toggle */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-md bg-muted/50">
        <div className="flex flex-col gap-1">
          <Label htmlFor="auto-trading" className="text-sm font-medium font-sans">
            Auto Trading
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable automated trade execution based on order flow signals
          </p>
        </div>
        <Switch
          id="auto-trading"
          checked={settings.auto_trading}
          onCheckedChange={(checked) => onSettingsChange({ auto_trading: checked })}
          data-testid="switch-auto-trading"
        />
      </div>

      <Tabs defaultValue="absorption" className="mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="absorption" data-testid="tab-absorption">Absorption</TabsTrigger>
          <TabsTrigger value="dom" data-testid="tab-dom">DOM</TabsTrigger>
          <TabsTrigger value="tape" data-testid="tab-tape">Tape</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risk</TabsTrigger>
        </TabsList>

        {/* Absorption Settings */}
        <TabsContent value="absorption" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="absorption-threshold" className="text-sm font-medium font-sans">
                Absorption Ratio Threshold
              </Label>
              <Input
                id="absorption-threshold"
                type="number"
                step="0.1"
                value={settings.absorption_threshold}
                onChange={(e) => onSettingsChange({ absorption_threshold: parseFloat(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-absorption-threshold"
              />
              <p className="text-xs text-muted-foreground">
                Minimum absorption ratio to trigger signal (e.g., 2.0 = 2:1)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="absorption-lookback" className="text-sm font-medium font-sans">
                Lookback Period (minutes)
              </Label>
              <Input
                id="absorption-lookback"
                type="number"
                value={settings.absorption_lookback}
                onChange={(e) => onSettingsChange({ absorption_lookback: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-absorption-lookback"
              />
              <p className="text-xs text-muted-foreground">
                How far back to look for absorption events
              </p>
            </div>
          </div>
        </TabsContent>

        {/* DOM Settings */}
        <TabsContent value="dom" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dom-imbalance" className="text-sm font-medium font-sans">
                Imbalance Ratio Threshold
              </Label>
              <Input
                id="dom-imbalance"
                type="number"
                step="0.1"
                value={settings.dom_imbalance_threshold}
                onChange={(e) => onSettingsChange({ dom_imbalance_threshold: parseFloat(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-dom-imbalance"
              />
              <p className="text-xs text-muted-foreground">
                Minimum bid/ask imbalance (e.g., 2.0 = 2:1 bid stack)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="dom-depth" className="text-sm font-medium font-sans">
                Depth Levels to Analyze
              </Label>
              <Input
                id="dom-depth"
                type="number"
                value={settings.dom_depth_levels}
                onChange={(e) => onSettingsChange({ dom_depth_levels: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-dom-depth"
              />
              <p className="text-xs text-muted-foreground">
                Number of price levels to analyze (typically 10)
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Tape Settings */}
        <TabsContent value="tape" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tape-volume" className="text-sm font-medium font-sans">
                Large Order Size
              </Label>
              <Input
                id="tape-volume"
                type="number"
                value={settings.tape_volume_threshold}
                onChange={(e) => onSettingsChange({ tape_volume_threshold: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-tape-volume"
              />
              <p className="text-xs text-muted-foreground">
                Contracts to mark as "large" (MES: 10+)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tape-ratio" className="text-sm font-medium font-sans">
                Buy/Sell Ratio Threshold
              </Label>
              <Input
                id="tape-ratio"
                type="number"
                step="0.1"
                value={settings.tape_ratio_threshold}
                onChange={(e) => onSettingsChange({ tape_ratio_threshold: parseFloat(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-tape-ratio"
              />
              <p className="text-xs text-muted-foreground">
                Buy/sell pressure ratio (e.g., 1.5 = 60/40)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tape-lookback" className="text-sm font-medium font-sans">
                Lookback (seconds)
              </Label>
              <Input
                id="tape-lookback"
                type="number"
                value={settings.tape_lookback_seconds}
                onChange={(e) => onSettingsChange({ tape_lookback_seconds: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-tape-lookback"
              />
              <p className="text-xs text-muted-foreground">
                Time window for tape analysis
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="use-poc" className="text-sm font-medium font-sans">
                  Use POC as Magnet
                </Label>
                <p className="text-xs text-muted-foreground">
                  Point of Control attracts price
                </p>
              </div>
              <Switch
                id="use-poc"
                checked={settings.use_poc_magnet}
                onCheckedChange={(checked) => onSettingsChange({ use_poc_magnet: checked })}
                data-testid="switch-poc-magnet"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="use-vah-val" className="text-sm font-medium font-sans">
                  Use VAH/VAL Boundaries
                </Label>
                <p className="text-xs text-muted-foreground">
                  Value Area as support/resistance
                </p>
              </div>
              <Switch
                id="use-vah-val"
                checked={settings.use_vah_val_boundaries}
                onCheckedChange={(checked) => onSettingsChange({ use_vah_val_boundaries: checked })}
                data-testid="switch-vah-val"
              />
            </div>
          </div>
        </TabsContent>

        {/* Risk Management */}
        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="stop-loss" className="text-sm font-medium font-sans">
                Stop Loss (ticks)
              </Label>
              <Input
                id="stop-loss"
                type="number"
                value={settings.stop_loss_ticks}
                onChange={(e) => onSettingsChange({ stop_loss_ticks: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-stop-loss"
              />
              <p className="text-xs text-muted-foreground">
                MES: 0.25 per tick (8 = 2 points)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="take-profit" className="text-sm font-medium font-sans">
                Take Profit (ticks)
              </Label>
              <Input
                id="take-profit"
                type="number"
                value={settings.take_profit_ticks}
                onChange={(e) => onSettingsChange({ take_profit_ticks: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-take-profit"
              />
              <p className="text-xs text-muted-foreground">
                MES: 0.25 per tick (16 = 4 points)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="min-confidence" className="text-sm font-medium font-sans">
                Minimum Confidence (%)
              </Label>
              <Input
                id="min-confidence"
                type="number"
                value={settings.min_confidence}
                onChange={(e) => onSettingsChange({ min_confidence: parseInt(e.target.value) || 0 })}
                className="font-mono tabular-nums"
                data-testid="input-min-confidence"
              />
              <p className="text-xs text-muted-foreground">
                Only trade signals above this %
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator className="my-6" />

      <div className="flex items-center justify-between gap-4">
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
