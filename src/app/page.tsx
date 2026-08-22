'use client'

import dynamic from 'next/dynamic'

// The dashboard is a heavy client-side app (React Flow + many modals).
// Dynamic-import with ssr:false so the server doesn't try to render it
// (which would fail for window/document references in zustand persist).
const DashboardShell = dynamic(() => import('@/components/dashboard/dashboard-shell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-canvas text-text-muted">
      <div className="label-caps">Loading Alpha VW…</div>
    </div>
  ),
})

export default function Home() {
  return <DashboardShell />
}
