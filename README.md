# Alpha VW — Enterprise Batch Topology & Job Monitoring System

An enterprise-grade batch job topology visualization and monitoring dashboard built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, and **SQLite**.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-Time Installation & Setup](#2-first-time-installation--setup)
3. [Running in Development Mode](#3-running-in-development-mode)
4. [Building for Production](#4-building-for-production)
5. [Production Deployment & Package Installation](#5-production-deployment--package-installation)
   - [Method 1: Running Without PM2 (Direct Node.js / Systemd)](#method-1-running-without-pm2-direct-nodejs--systemd)
   - [Method 2: Running With PM2 (Optional Process Manager)](#method-2-running-with-pm2-optional-process-manager)
6. [External Packages & Native Assets (Cannot be Packaged in Build)](#6-external-packages--native-assets)
7. [Project Structure](#7-project-structure)
8. [Available Scripts](#8-available-scripts)

---

## 1. Prerequisites

Before installing the project, ensure you have the following installed on your machine:

- **Node.js**: `v18.17.0` or higher (v20+ recommended)
- **Package Manager**: `npm` (v9+) or `bun` (v1.0+)
- **OS**: Windows, macOS, or Linux

---

## 2. First-Time Installation & Setup

Follow these steps to set up the project locally for the first time:

### Step 1: Install Dependencies
Run the package manager to install node modules:

```bash
npm install
```
*(Or if using Bun: `bun install`)*

### Step 2: Configure Environment Variables
Create or verify the `.env` file in the root directory:

```env
DATABASE_URL="file:./db/custom.db"
```

> **Note for Windows users**: Ensure the file path uses valid slashes. Relative path `file:../db/custom.db` (relative to `prisma/schema.prisma`) or absolute path `file:C:/path/to/project/db/custom.db` can be used.

### Step 3: Generate Prisma ORM Client
Generate the TypeScript Prisma Client bindings:

```bash
npx prisma generate
```

### Step 4: Setup / Sync Database
Initialize or sync the SQLite database schema:

```bash
npm run db:push
```

---

## 3. Running in Development Mode

Start the Next.js development server with hot-reloading:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to access the dashboard.

---

## 4. Building for Production

To compile and optimize the web application for production deployment:

```bash
npm run build
```

This command performs:
1. Type checking and Next.js compilation via Turbopack.
2. Standalone server output bundle generation at `.next/standalone/`.
3. Copying of `.next/static` and `public/` assets into the standalone directory for production serving.

---

## 5. Production Deployment & Package Installation

When deploying the application to a target computer (such as a production server or another workstation) where **only Node.js is installed**, you can use the built-in standalone deployment configuration.

The `run.bat` utility script automates the installation of native platform-specific packages (`sharp`, `@prisma/client`, and `prisma`), sets up the database, and boots the production server.

---

### Step 1: Copy Deployment Files to the Target Computer

Build the project on your development machine first (`npm run build`). Then, transfer only the following folders and files to a new directory (e.g. `C:\alpha-vw\`) on the target computer:

* **`.next/standalone/`** (Copy all contents—including `server.js` and `package.json`—directly to the root of the deployment folder)
* **`.next/static/`** (Copy the directory to `.next/static/` relative to the root of the deployment folder)
* **`public/`** (Copy the directory to `public/` relative to the root of the deployment folder)
* **`prisma/`** (Copy the directory containing `schema.prisma` to the root of the deployment folder)
* **`db/`** (Copy the directory containing `custom.db` to the root of the deployment folder)
* **`run.bat`** (Copy the script to the root of the deployment folder)

#### Resulting Folder Structure on the Target Computer:
```text
C:\alpha-vw\
├── db\
│   └── custom.db           <-- SQLite database
├── prisma\
│   └── schema.prisma       <-- Prisma database schema definition
├── public\
│   └── (static logo/imgs)  <-- Public static files
├── .next\
│   └── static\             <-- Next.js client-side assets
├── node_modules\           <-- Bundled server dependencies
├── package.json            <-- Bundled package config
├── server.js               <-- Standalone entry point file
└── run.bat                 <-- Setup and startup script
```

---

### Step 2: Bootstrap and Start the Server on Target OS

Open the Command Prompt or PowerShell in the deployment directory on the target computer and execute:

```cmd
run.bat -e p -d y -p <port>
```

#### Example (Running on Port 8080):
```cmd
run.bat -e p -d y -p 8080
```

#### What this command does automatically on the target OS:
1. **`-e p` (Production Mode)**: Automatically sets `NODE_ENV=production` and tells the script to bypass the Next.js compile/build phase (since it has already been pre-compiled).
2. **`-d y` (Dependency Setup)**: Since only Node.js is installed on the target machine, it executes `npm install --omit=dev sharp @prisma/client prisma` to compile the platform-specific native C++ bindings for the target OS, generates the local query engines (`npx prisma generate`), and syncs the SQLite database.
3. **`-p 8080` (Port)**: Binds the web server to the specified port number.
4. **Boot Server**: Immediately starts the standalone production server.

---

### Method 1: Running Without PM2 (Direct Node.js / Systemd)

If you prefer **not to use PM2**, you can run the server directly using Node.js, Bun, or standard OS system services (like Linux `systemd` or Windows Task Scheduler).

#### Option 1A: Direct Node.js Command (Linux/macOS)
```bash
NODE_ENV=production PORT=3000 node .next/standalone/server.js
```

#### Option 1B: Direct Node.js Command (Windows PowerShell)
```powershell
$env:NODE_ENV="production"
$env:PORT="3000"
node .next/standalone/server.js
```

#### Option 1C: Direct Bun Command
```bash
bun .next/standalone/server.js
```

#### Option 1D: Linux `systemd` Service (Auto-restart on boot WITHOUT PM2)
Create a service file `/etc/systemd/system/alpha-vw.service`:

```ini
[Unit]
Description=Alpha VW Next.js Standalone Production Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/alpha-vw
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production PORT=3000 DATABASE_URL=file:./db/custom.db

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl start alpha-vw
sudo systemctl enable alpha-vw
```

---

### Method 2: Running With PM2 (Optional Process Manager)

If you prefer using **PM2** for background daemonization and auto-restart:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start the Next.js standalone server with PM2
pm2 start .next/standalone/server.js --name "alpha-vw" --env production

# 3. Save process list & enable auto-restart on system reboot
pm2 save
pm2 startup
```

---

## 6. External Packages & Native Assets (Cannot be Packaged in Build)

When compiling Next.js applications into standalone bundles, certain native binaries, C++ extensions, databases, and assets **cannot be bundled directly into a single JavaScript file**. These dependencies must remain on the host filesystem or environment alongside the build output:

### 1. **Native C++ Addons (`sharp`)**
- **Package**: `sharp` (High-performance image processing library).
- **Why it can't be bundled**: `sharp` relies on compiled native platform C++ binary bindings (`.node` files such as `libvips` binaries). Native code is compiled specifically for target operating systems (Windows `.dll`/`.node`, Linux `.so`, macOS `.dylib`) and cannot be cross-compiled into standard Webpack/Turbopack JavaScript bundles.
- **Deployment requirement**: The `sharp` package and its platform-specific native binaries must exist in `node_modules` on the server runtime.

### 2. **Prisma Query Engine Binaries (`@prisma/client`)**
- **Package**: `@prisma/client` & `prisma`.
- **Why it can't be bundled**: Prisma ORM executes database operations through a native query engine binary (e.g. `query_engine-windows.dll.node` or `libquery_engine-debian-openssl.so`). These are compiled executable binaries outside JavaScript runtime.
- **Deployment requirement**: `npx prisma generate` must be run on the target deployment machine, or the target platform query engines must be specified in `prisma/schema.prisma` (`binaryTargets`).

### 3. **SQLite Database File (`db/custom.db`)**
- **Asset**: `db/custom.db` (SQLite relational database file).
- **Why it can't be bundled**: SQLite is a file-backed embedded database. The data is read and updated dynamically at runtime by the application process.
- **Deployment requirement**: The `db/custom.db` database file must be deployed on persistent disk storage on the target server, and `DATABASE_URL` in `.env` must point to its exact path.

### 4. **Static & Public Assets (`public/` & `.next/static/`)**
- **Asset**: Client JavaScript chunks, CSS stylesheets, images, and fonts.
- **Why it can't be bundled**: Standalone Next.js Node server handles dynamic SSR routes, but serves client-side assets directly from the filesystem.
- **Deployment requirement**: `.next/static` must be located at `.next/standalone/.next/static/` and `public` must be located at `.next/standalone/public/`.

### 5. **Runtime Environment Variables (`.env`)**
- **Asset**: Configuration keys and connection strings (`DATABASE_URL`).
- **Why it can't be bundled**: Environment variables vary between staging, production, and local environments and must be injected dynamically at runtime.

---

## 7. Project Structure

```
├── api/                   # Standalone node backend services
├── db/                    # SQLite database storage (custom.db)
├── prisma/
│   └── schema.prisma      # Prisma ORM data models & schema
├── public/                # Static public assets (images, icons)
├── src/
│   ├── app/               # Next.js App Router pages & API routes
│   │   └── api/           # REST endpoints (/api/data, /api/crud/[table])
│   ├── components/        # React components & modals
│   │   ├── dashboard/     # Dashboard shell & viewpoint views
│   │   ├── modals/        # Schedule Manager & Viewpoint Form modals
│   │   ├── schedule-builder/ # Visual Rule-Based Schedule Builder UI
│   │   └── ui-custom/     # Shared design system components
│   └── lib/               # Utility functions, stores, & DB client
├── package.json           # Scripts & dependency definitions
└── tsconfig.json          # TypeScript configuration
```

---

## 8. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` |
| `npm run build` | Builds the production application and copies static assets |
| `npm run start` | Runs the production standalone server using Bun/Node |
| `npm run db:generate` | Generates Prisma Client TypeScript definitions (`prisma generate`) |
| `npm run db:push` | Pushes Prisma schema changes directly to SQLite database |
| `npm run db:reset` | Resets SQLite database and re-applies migrations |
| `npm run lint` | Runs ESLint to check for code style and syntax issues |
