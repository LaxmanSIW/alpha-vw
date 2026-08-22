# Alpha VW — Enterprise Batch Topology & Job Monitoring System

A modern, high-performance enterprise batch processing dashboard, visual flow topology canvas, and job scheduling management platform built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **React Flow**, and a **Node.js/SQLite** backend.

---

## 🌟 Key Features

### 1. Interactive Flow Canvas (`React Flow`)
- **Flat Enterprise Design**: Clean, shadowless, high-contrast node styling.
- **Dynamic Resizing**: Real-time control over Node Width, Node Expanded Height, Node Collapsed Height, and Horizontal/Vertical Gap spacing.
- **Perfect Handle Alignment**: Edge arrowheads land precisely on card borders regardless of card collapse or expansion state.
- **Relation Highlighting**: Highlights selected node, predecessors, and successors with customizable outline colors.

### 2. Server-Side Business Date & Rule-Based Schedule Engine
- **Configurable Day-Start Threshold**: Rollover threshold setting (e.g. 03:00 AM) to maintain yesterday's business date before threshold.
- **Rule-Based Calendar (RBC) Engine**: Supports workdays, holidays, monthly shifts, confirmation calendars, and activity periods.
- **Server-Side Schedule Caching**: Automatically evaluates schedule configs against active business date and caches `is_scheduled_today` (`Yes` / `No` / `N/A`) without per-node overhead.
- **Automatic Cache Invalidation**: Schedule evaluations instantly update whenever schedule rules, calendars, or business date thresholds change.

### 3. Database Admin & Dynamic Field Definitions (EAV)
- **Dynamic Field Definitions**: Create custom database fields (`key`, `label`, `section_title`, `role`, `format`, `show_on_card`, `show_in_details`) on the fly.
- **Instant UI Flow-Down**: Custom fields automatically populate across Canvas cards, Details Side Panel, and List View columns without code changes.
- **Bulk CSV Import**: Import/Export Navigation Nodes and Edges using CSV files with automatic UTF-8 BOM cleanup.
- **Graphical Field Guide**: Built-in visual diagram modal explaining field roles (`title`, `subtitle`, `detail`) and schema placement.

### 4. Job Monitoring Grid (List View)
- **Drag-and-Drop Column Reordering**: Re-order visible grid columns dynamically.
- **Add/Remove Column Chooser**: Custom column visibility selector driven by database field definitions.
- **CSV Data Export**: Export visible grid data to formatted CSV files.

---

## 🏦 Sample Enterprise Banking Dataset

The workspace includes pre-generated CSV seed files representing an end-to-end **Enterprise Banking Batch Processing Architecture**:

- [`sample_nodes.csv`](file:///c:/Development/Alpha%20VW/sample_nodes.csv): 112 nodes (100 job cards + 12 domain folders) spanning:
  - 💳 **Core Banking & Payments** (`SWIFT Parser`, `ISO20022 Validator`, `FEDWire`, `ACH`, `SEPA`, `RTGS`, `CHIPS`, `Escrow Reval`)
  - 🏧 **Cards & Retail Banking** (`Visa/Mastercard Sync`, `Interchange Fee Calc`, `ATM/POS Settlement`, `Mortgage EMI`, `Loan Delinquency`)
  - 🛡️ **Risk, Treasury & AML** (`AML Scraper`, `PEP Screening`, `ML Fraud Detector`, `VaR Simulator`, `LCR Calc`, `Stress Testing`)
  - 📊 **GL & EOD Financial Reporting** (`Subledger Poster`, `Trial Balance Engine`, `Intercompany Elimination`, `Basel III Exporter`, `FED Y-9C`, `SEC 10-K`, `EOD Completion Signal`)
- [`sample_edges.csv`](file:///c:/Development/Alpha%20VW/sample_edges.csv): 95 dependency edges linking the end-to-end pipeline.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v18+` or `v20+`
- **npm**: `v9+`

### Installation

```bash
# Clone the repository
git clone https://github.com/LaxmanSIW/alpha-vw.git
cd alpha-vw

# Install dependencies
npm install
```

### Running the Application

1. **Start the API Server** (Backend & SQLite):
   ```bash
   npm run api
   # Server starts on http://localhost:3001
   ```

2. **Start Vite Dev Server** (Frontend):
   ```bash
   npm run dev
   # App opens on http://localhost:5173
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 📁 Data Seeding Guide

To seed the 100+ Enterprise Banking Batch pipeline:

1. Click **Database Admin Management** (database icon in ActionBar).
2. Go to **Bulk CSV Import** tab.
3. Target **Navigation Nodes (nav_nodes)** → Choose [`sample_nodes.csv`](file:///c:/Development/Alpha%20VW/sample_nodes.csv) → Click **Import**.
4. Target **Edges / Dependencies (edges)** → Choose [`sample_edges.csv`](file:///c:/Development/Alpha%20VW/sample_edges.csv) → Click **Import**.

---

## 🛠️ Project Structure

```
alpha-vw/
├── api/
│   ├── db.js             # SQLite database initialization, schemas & EAV queries
│   ├── schedule.js       # Rule-Based Calendar (RBC) schedule evaluation engine
│   └── server.js         # Express REST API endpoints & business date sync
├── src/
│   ├── components/       # React components (Canvas, Admin, Settings, Details, List View)
│   ├── config/           # Viewport, design tokens & default app configurations
│   ├── styles/           # CSS tokens & React Flow custom styling
│   └── types.ts          # TypeScript interfaces & domain models
├── sample_nodes.csv      # Sample 100+ Banking Node dataset
├── sample_edges.csv      # Sample 95 Banking Edge dataset
└── README.md
```

---

## 📄 License

MIT License. Designed for enterprise batch flow topology visualization and job monitoring.
