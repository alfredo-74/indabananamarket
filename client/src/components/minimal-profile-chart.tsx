import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";

Chart.register(...registerables);

interface MinimalProfileChartProps {
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  cva?: {
    poc: number;
    vah: number;
    val: number;
  };
  dva?: {
    poc: number;
    vah: number;
    val: number;
  };
  vwap?: {
    value: number;
    sd1_upper: number;
    sd1_lower: number;
  };
  absorptionEvents?: Array<{
    timestamp: number;
    price: number;
    side: "BUY_ABSORPTION" | "SELL_ABSORPTION";
    ratio: number;
  }>;
  currentPrice?: number;
}

export default function MinimalProfileChart({
  candles,
  cva,
  dva,
  vwap,
  absorptionEvents,
  currentPrice,
}: MinimalProfileChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Prepare candlestick data - filter out invalid timestamps
    const validCandles = candles.filter(c => c.timestamp > 0);
    if (validCandles.length === 0) return;
    
    const candleData = validCandles.map((c) => ({
      x: c.timestamp,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));

    // Prepare absorption markers (force field effect) - filter out invalid timestamps
    const buyAbsorption = absorptionEvents
      ?.filter((e) => e.side === "BUY_ABSORPTION" && e.timestamp > 0)
      .map((e) => ({ x: e.timestamp, y: e.price })) || [];
    
    const sellAbsorption = absorptionEvents
      ?.filter((e) => e.side === "SELL_ABSORPTION" && e.timestamp > 0)
      .map((e) => ({ x: e.timestamp, y: e.price })) || [];

    const datasets: any[] = [
      // Candlesticks (minimal, thin)
      {
        type: "candlestick" as const,
        label: "Price",
        data: candleData,
        borderColor: "#22c55e",
        color: {
          up: "rgba(34, 197, 94, 0.8)",
          down: "rgba(239, 68, 68, 0.8)",
          unchanged: "rgba(156, 163, 175, 0.8)",
        },
        barThickness: 2,
      },
    ];

    // Buy Absorption Force Field (green glow)
    if (buyAbsorption.length > 0) {
      datasets.push({
        type: "bubble" as const,
        label: "Buy Absorption",
        data: buyAbsorption.map((point) => ({
          ...point,
          r: 12, // Bubble radius for force field effect
        })),
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        borderColor: "rgba(34, 197, 94, 0.8)",
        borderWidth: 2,
      });
    }

    // Sell Absorption Force Field (red glow)
    if (sellAbsorption.length > 0) {
      datasets.push({
        type: "bubble" as const,
        label: "Sell Absorption",
        data: sellAbsorption.map((point) => ({
          ...point,
          r: 12,
        })),
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        borderColor: "rgba(239, 68, 68, 0.8)",
        borderWidth: 2,
      });
    }

    // CVA levels (5-day composite - cyan)
    if (cva && cva.poc > 0) {
      datasets.push(
        {
          type: "line" as const,
          label: "CVA POC",
          data: validCandles.map((c) => ({ x: c.timestamp, y: cva.poc })),
          borderColor: "rgba(6, 182, 212, 0.8)",
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "CVA VAH",
          data: validCandles.map((c) => ({ x: c.timestamp, y: cva.vah })),
          borderColor: "rgba(6, 182, 212, 0.5)",
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "CVA VAL",
          data: validCandles.map((c) => ({ x: c.timestamp, y: cva.val })),
          borderColor: "rgba(6, 182, 212, 0.5)",
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
        }
      );
    }

    // DVA levels (daily value area - yellow)
    if (dva && dva.poc > 0) {
      datasets.push(
        {
          type: "line" as const,
          label: "DVA POC",
          data: validCandles.map((c) => ({ x: c.timestamp, y: dva.poc })),
          borderColor: "rgba(234, 179, 8, 0.8)",
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "DVA VAH",
          data: validCandles.map((c) => ({ x: c.timestamp, y: dva.vah })),
          borderColor: "rgba(234, 179, 8, 0.5)",
          borderWidth: 1,
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "DVA VAL",
          data: validCandles.map((c) => ({ x: c.timestamp, y: dva.val })),
          borderColor: "rgba(234, 179, 8, 0.5)",
          borderWidth: 1,
          pointRadius: 0,
        }
      );
    }

    // VWAP with SD bands (white)
    if (vwap && vwap.value) {
      datasets.push(
        {
          type: "line" as const,
          label: "VWAP",
          data: validCandles.map((c) => ({ x: c.timestamp, y: vwap.value })),
          borderColor: "rgba(255, 255, 255, 0.8)",
          borderWidth: 1,
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "VWAP +SD1",
          data: validCandles.map((c) => ({ x: c.timestamp, y: vwap.sd1_upper })),
          borderColor: "rgba(255, 255, 255, 0.3)",
          borderWidth: 1,
          borderDash: [2, 2],
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "VWAP -SD1",
          data: validCandles.map((c) => ({ x: c.timestamp, y: vwap.sd1_lower })),
          borderColor: "rgba(255, 255, 255, 0.3)",
          borderWidth: 1,
          borderDash: [2, 2],
          pointRadius: 0,
        }
      );
    }

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: "#000",
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
              display: false,
            },
            ticks: {
              color: "#4b5563",
              font: { size: 9 },
            },
          },
          y: {
            position: "right",
            grid: {
              color: "rgba(75, 85, 99, 0.2)",
            },
            ticks: {
              color: "#4b5563",
              font: { size: 9 },
              callback: (value) => typeof value === 'number' ? value.toFixed(2) : value,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            titleColor: "#22c55e",
            bodyColor: "#d1d5db",
            borderColor: "#22c55e",
            borderWidth: 1,
            padding: 8,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || "";
                const value = context.parsed.y ? context.parsed.y.toFixed(2) : "N/A";
                return `${label}: ${value}`;
              },
            },
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [candles, cva, dva, vwap, absorptionEvents, currentPrice]);

  return (
    <div className="h-full w-full bg-black rounded">
      <canvas ref={chartRef} />
    </div>
  );
}
