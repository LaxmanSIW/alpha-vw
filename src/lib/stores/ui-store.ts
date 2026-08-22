/**
 * UI store — theme, density, modal open-state.
 *
 * Theme/density also writes to <html> data-attributes so the CSS variables flip.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeName, DensityName, Viewpoint } from '../types'
import type { Node } from '@xyflow/react'

interface UIState {
  // Theme & density
  theme: ThemeName
  density: DensityName
  toggleTheme: () => void
  toggleDensity: () => void
  setTheme: (t: ThemeName) => void
  setDensity: (d: DensityName) => void

  // Modals (booleans + the data they need)
  isAdminOpen: boolean
  isSettingsOpen: boolean
  isCalendarManagerOpen: boolean
  isScheduleManagerOpen: boolean
  isCreateViewpointOpen: boolean
  editingViewpoint: Viewpoint | null
  scheduleModalNode: Node | null

  openAdmin: () => void
  closeAdmin: () => void
  openSettings: () => void
  closeSettings: () => void
  openCalendarManager: () => void
  closeCalendarManager: () => void
  openScheduleManager: () => void
  closeScheduleManager: () => void
  openCreateViewpoint: () => void
  closeCreateViewpoint: () => void
  openEditViewpoint: (vp: Viewpoint) => void
  closeEditViewpoint: () => void
  openScheduleModal: (node: Node) => void
  closeScheduleModal: () => void
}

function applyTheme(theme: ThemeName) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

function applyDensity(density: DensityName) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.density = density
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      density: 'compact',
      toggleTheme: () => set((s) => {
        const next: ThemeName = s.theme === 'light' ? 'dark' : 'light'
        applyTheme(next)
        return { theme: next }
      }),
      toggleDensity: () => set((s) => {
        const next: DensityName = s.density === 'compact' ? 'comfortable' : 'compact'
        applyDensity(next)
        return { density: next }
      }),
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setDensity: (density) => {
        applyDensity(density)
        set({ density })
      },

      // Modals
      isAdminOpen: false,
      isSettingsOpen: false,
      isCalendarManagerOpen: false,
      isScheduleManagerOpen: false,
      isCreateViewpointOpen: false,
      editingViewpoint: null,
      scheduleModalNode: null,

      openAdmin: () => set({ isAdminOpen: true }),
      closeAdmin: () => set({ isAdminOpen: false }),
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      openCalendarManager: () => set({ isCalendarManagerOpen: true }),
      closeCalendarManager: () => set({ isCalendarManagerOpen: false }),
      openScheduleManager: () => set({ isScheduleManagerOpen: true }),
      closeScheduleManager: () => set({ isScheduleManagerOpen: false }),
      openCreateViewpoint: () => set({ isCreateViewpointOpen: true }),
      closeCreateViewpoint: () => set({ isCreateViewpointOpen: false }),
      openEditViewpoint: (editingViewpoint) => set({ editingViewpoint }),
      closeEditViewpoint: () => set({ editingViewpoint: null }),
      openScheduleModal: (scheduleModalNode) => set({ scheduleModalNode }),
      closeScheduleModal: () => set({ scheduleModalNode: null }),
    }),
    {
      name: 'alpha-vw-ui',
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences
      partialize: (s) => ({ theme: s.theme, density: s.density }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          applyDensity(state.density)
        }
      },
    },
  ),
)
