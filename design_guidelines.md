# OrderFlowAI Trading System - Design Guidelines

## Design Approach

**Framework Selected:** Carbon Design System + Financial Trading UI Patterns

**Rationale:** This is a data-intensive, professional trading platform requiring maximum information density, real-time data visualization, and operational efficiency. Drawing from Carbon Design (IBM) for enterprise data applications and financial terminal UI patterns (Bloomberg, TradingView, Interactive Brokers TWS).

**Design Principles:**
1. **Data First:** Maximize information density without clutter
2. **Scan-ability:** Critical metrics (price, P&L, regime) must be instantly recognizable
3. **Visual Stability:** Minimize layout shifts during real-time updates
4. **Professional Aesthetic:** Clean, utilitarian, high-contrast for long trading sessions
5. **Performance:** Optimized for 500ms refresh cycles without visual flicker

---

## Typography System

**Font Families:**
- **Primary:** IBM Plex Mono (monospaced for numerical data alignment)
- **Secondary:** IBM Plex Sans (UI labels and headers)
- **Rationale:** Monospaced fonts critical for financial data tables where number alignment aids rapid scanning

**Type Scale:**
- **Display (Regime/Status):** text-2xl font-bold tracking-tight
- **Data Values (Price/P&L):** text-xl font-semibold tabular-nums
- **Labels:** text-sm font-medium uppercase tracking-wide
- **Table Data:** text-base tabular-nums
- **Metadata:** text-xs

**Key Principles:**
- Use `tabular-nums` utility class for all numeric displays
- Uppercase labels with increased tracking for section headers
- Bold weights for critical real-time data (current price, open P&L)
- Regular weights for historical/static data

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- **Tight spacing (2, 4):** Between related data points, table cells
- **Medium spacing (6, 8):** Between component groups, card padding
- **Loose spacing (12, 16):** Between major sections

**Grid Structure:**

**Desktop Layout (Primary):**
```
┌─────────────────────────────────────────────┐
│  Header: System Status + Market Data Ticker │ h-16, px-6
├─────────────────────────────────────────────┤
│ ┌─────────────────┬───────────────────────┐ │
│ │                 │   Regime Indicator    │ │ h-12
│ │                 │   + CD Display        │ │
│ │                 ├───────────────────────┤ │
│ │                 │                       │ │
│ │  Main Chart     │   Live Stats Panel    │ │ 
│ │  (Volumetric    │   - Current Price     │ │ flex-1
│ │   Candles +     │   - VWAP Levels       │ │
│ │   VWAP)         │   - Position Status   │ │
│ │                 │   - P&L               │ │
│ │  (8/12 width)   │   (4/12 width)        │ │
│ └─────────────────┴───────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │  Trade History Table + Controls         │ │ h-64
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Component Spacing:**
- Dashboard container: `max-w-full px-4 py-2`
- Chart area: `p-4` 
- Stats panels: `p-6 space-y-4`
- Between sections: `gap-4`

---

## Core Components

### 1. System Header
**Structure:** Fixed top bar, full-width
- **Left:** System name + connection status indicator
- **Center:** Real-time market data ticker (scrolling or static)
- **Right:** Capital, Daily P&L, timestamp
- **Height:** h-16
- **Layout:** `flex items-center justify-between px-6`

### 2. Chart Component (Primary Focus)
**Framework:** Chart.js with custom candlestick + line overlays
- **Container:** `aspect-[16/9]` minimum, expandable
- **Padding:** p-4 for axis breathing room
- **Candlesticks:** Custom rendering with wicks, bodies
- **VWAP Lines:** 7 overlays (VWAP + SD ±1, ±2, ±3) using dashed patterns
- **Tooltip:** Appears on hover showing OHLC, Volume, CD for candle
- **Y-Axis:** Right-aligned, price levels
- **X-Axis:** Time labels (09:30, 10:00, etc.)

### 3. Regime Indicator (Critical Component)
**Position:** Top-right of chart or in stats panel
**States:** ROTATIONAL | DIRECTIONAL_BULLISH | DIRECTIONAL_BEARISH | TRANSITIONING
- **Display:** Large badge/pill shape
- **Typography:** text-sm font-bold uppercase tracking-wider
- **Layout:** `inline-flex items-center gap-2 px-4 py-2 rounded-full`
- **Icon:** Optional directional arrow or status dot

### 4. Live Stats Panel
**Structure:** Right sidebar, sticky positioning
**Sections (vertical stack with `space-y-6`):**

**Current Market Data:**
- Price: text-2xl font-bold tabular-nums
- VWAP: text-lg tabular-nums
- Cumulative Delta: text-lg tabular-nums (with +/- prefix)

**Standard Deviation Levels Table:**
- Headers: text-xs uppercase
- Values: tabular-nums text-sm
- Layout: 2-column grid (label | value)

**Position Status:**
- Contracts: text-base
- Entry Price: tabular-nums
- Current P&L: text-xl font-bold (dynamic)
- Stop Loss / Take Profit levels

**Each stat group:** Card-style with `p-4 rounded-lg` border

### 5. Trade History Table
**Structure:** Full-width data table
**Columns:** Time | Type | Entry | Exit | Contracts | P&L | Duration
- **Header:** text-xs uppercase font-medium, sticky top
- **Rows:** text-sm tabular-nums, alternating row treatment
- **Layout:** `w-full border-collapse`
- **Cell padding:** px-4 py-2
- **Scroll:** If > 10 rows, max-h-64 overflow-y-auto

### 6. Control Panel (Optional Toggle)
**Position:** Below chart or in expandable drawer
**Elements:**
- Auto-trading toggle switch
- Volume target input (100 for test, 5000 for production)
- CD threshold adjustment
- Emergency stop button (prominent)
- **Layout:** `grid grid-cols-4 gap-4`

---

## Interactive States & Real-time Updates

**Update Strategy (500ms refresh):**
- Use CSS transitions for smooth value changes
- Avoid layout shifts: fixed width containers for numeric displays
- Flash animations for significant changes (new trade, regime shift)

**Flash Pattern for Updates:**
- Price updates: Brief pulse effect (150ms) on value change
- New candle completion: Subtle highlight of latest candle
- Regime changes: Animated transition of indicator badge

**Loading States:**
- Skeleton screens for initial chart load
- Shimmer effect for pending data
- Spinner only for connection/system operations

---

## Responsive Considerations

**Desktop (1920px+):** Primary target, full layout as described
**Laptop (1440px):** Reduce chart aspect ratio slightly, maintain sidebar
**Tablet (1024px):** Stack sidebar below chart, reduce stat panel columns
**Mobile (768px):** Single column, chart first, abbreviated stats table

**Breakpoint approach:**
- `lg:grid-cols-3` for stats panels (3 cols desktop, stack mobile)
- Chart maintains minimum readable size, never below 600px width

---

## Accessibility & Usability

**High Contrast Mode:** Assume enabled by default for trading visibility
**Keyboard Navigation:** 
- Tab through key metrics
- Hotkeys for critical actions (Space: pause/resume, Esc: emergency stop)
- Arrow keys for chart time navigation

**Focus States:** Prominent 2px outline on interactive elements
**ARIA Labels:** All data points properly labeled for screen readers
**Tooltips:** Hover reveals full metric names and descriptions

---

## Animation & Performance

**Constraints:**
- **Minimal animations** - only for critical state changes
- **No decorative animations** - data visibility paramount
- **Transitions:** Use `transition-all duration-150` for value updates
- **No auto-play carousels or distracting motion**

**Allowed animations:**
- Regime indicator state change (fade)
- Flash on price/P&L update
- Chart zoom/pan (user-initiated)

---

## Component Library Summary

**Data Display:**
- Stat Cards (metric + value + trend)
- Data Tables (sortable, filterable)
- Real-time Ticker

**Charts:**
- Candlestick chart with custom drawing
- VWAP line overlays
- Volume histogram (optional below chart)

**Controls:**
- Toggle switches (auto-trade on/off)
- Number inputs (volume target, thresholds)
- Emergency action button

**Indicators:**
- Connection status badge
- Regime indicator pill
- Loading spinners

**Layout:**
- Grid containers for stat panels
- Flex layouts for headers/toolbars
- Sticky positioning for headers/sidebars

---

## Images & Visual Assets

**No hero images** - This is a utility application, not marketing

**Icon Usage:**
- Status indicators (connected/disconnected): filled circles or WiFi-style icons
- Regime arrows: directional chevrons (up/down/horizontal)
- Trade type icons: Simple geometric shapes (triangle up for long, down for short)
- Use icon library: Heroicons or Material Icons (system/status icons)

**Chart Assets:**
- Candlestick bodies and wicks drawn via Chart.js
- VWAP lines programmatically rendered
- No background images or decorative graphics

---

This design creates a professional, data-dense trading interface optimized for rapid decision-making during live market hours, drawing from established financial terminal patterns while maintaining modern web standards.