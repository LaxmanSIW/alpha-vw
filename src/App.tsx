import { ReactFlowProvider } from '@xyflow/react'
import DashboardShell from './components/DashboardShell'

/**
 * ReactFlowProvider is hoisted above the shell (rather than living inside
 * FlowCanvas) so chrome outside the canvas -- the action bar's fit-to-view, the
 * status bar's counts -- can reach the flow instance via useReactFlow.
 */
function App() {
  return (
    <ReactFlowProvider>
      <DashboardShell />
    </ReactFlowProvider>
  )
}

export default App
