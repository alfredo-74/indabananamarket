import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { VolumetricCandle, VWAPData } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  LineController,
  LineElement,
  PointElement,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { CandlestickController, CandlestickElement } from "chartjs-chart-financial";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
  CandlestickController,
  CandlestickElement
);

interface ChartComponentProps {
  candles: VolumetricCandle[];
  vwap: VWAPData | null;
  isLoading?: boolean;
}

export function ChartComponent({ candles, vwap, isLoading = false }: ChartComponentProps) {
  const chartRef = useRef<ChartJS>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (candles.length === 0) return;

    const labels = candles.map((c) => new Date(c.timestamp));

    const candlestickData = candles.map((c, i) => ({
      x: labels[i],
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));

    const datasets: any[] = [
      {
        label: "Price",
        data: candlestickData,
        type: "candlestick",
        color: {
          up: "rgb(34, 197, 94)",
          down: "rgb(239, 68, 68)",
          unchanged: "rgb(156, 163, 175)",
        },
        borderColor: {
          up: "rgb(34, 197, 94)",
          down: "rgb(239, 68, 68)",
          unchanged: "rgb(156, 163, 175)",
        },
      },
    ];

    if (vwap && vwap.vwap !== null) {
      const vwapLine = candles.map((c, i) => ({ x: labels[i], y: vwap.vwap }));
      datasets.push({
        label: "VWAP",
        data: vwapLine,
        type: "line",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      });

      if (vwap.sd1_upper !== null && vwap.sd1_lower !== null) {
        datasets.push(
          {
            label: "+1 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd1_upper })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.5)",
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false,
          },
          {
            label: "-1 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd1_lower })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.5)",
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false,
          }
        );
      }

      if (vwap.sd2_upper !== null && vwap.sd2_lower !== null) {
        datasets.push(
          {
            label: "+2 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd2_upper })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.3)",
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
          },
          {
            label: "-2 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd2_lower })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.3)",
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
          }
        );
      }

      if (vwap.sd3_upper !== null && vwap.sd3_lower !== null) {
        datasets.push(
          {
            label: "+3 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd3_upper })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.2)",
            borderWidth: 1,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false,
          },
          {
            label: "-3 SD",
            data: candles.map((c, i) => ({ x: labels[i], y: vwap.sd3_lower })),
            type: "line",
            borderColor: "rgba(59, 130, 246, 0.2)",
            borderWidth: 1,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false,
          }
        );
      }
    }

    setChartData({
      labels,
      datasets,
    });
  }, [candles, vwap]);

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time",
        time: {
          unit: "minute",
          displayFormats: {
            minute: "HH:mm",
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            family: "IBM Plex Mono, monospace",
            size: 11,
          },
        },
      },
      y: {
        position: "right",
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            family: "IBM Plex Mono, monospace",
            size: 11,
          },
          callback: function (value) {
            return Number(value).toFixed(2);
          },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          font: {
            family: "IBM Plex Sans, sans-serif",
            size: 12,
          },
          padding: 15,
          usePointStyle: true,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.8)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleFont: {
          family: "IBM Plex Sans, sans-serif",
          size: 13,
        },
        bodyFont: {
          family: "IBM Plex Mono, monospace",
          size: 12,
        },
        callbacks: {
          label: function (context: any) {
            if (context.raw.o !== undefined) {
              const candle = candles[context.dataIndex];
              return [
                `O: ${context.raw.o.toFixed(2)}`,
                `H: ${context.raw.h.toFixed(2)}`,
                `L: ${context.raw.l.toFixed(2)}`,
                `C: ${context.raw.c.toFixed(2)}`,
                `Vol: ${candle.accumulated_volume}`,
                `CD: ${candle.cumulative_delta >= 0 ? "+" : ""}${candle.cumulative_delta}`,
              ];
            }
            return `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}`;
          },
        },
      },
    },
  };

  if (isLoading) {
    return (
      <Card className="p-4 h-full" data-testid="container-chart-loading">
        <Skeleton className="w-full h-full rounded-md" />
      </Card>
    );
  }

  if (!chartData || candles.length === 0) {
    return (
      <Card className="p-4 h-full flex items-center justify-center" data-testid="container-chart-empty">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No market data available</p>
          <p className="text-xs mt-1">Waiting for IBKR connection...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 h-full" data-testid="container-chart">
      <div className="h-full">
        <Chart ref={chartRef} type="line" data={chartData} options={options} />
      </div>
    </Card>
  );
}
