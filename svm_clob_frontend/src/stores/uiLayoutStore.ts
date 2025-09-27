import { create } from 'zustand';

interface WidgetState {
  id: string;
  visible: boolean;
}

export interface UiLayoutState {
  theme: 'dark' | 'light';
  collapsedPanels: Record<string, boolean>;
  widgets: Record<string, WidgetState>;
  toggleTheme: () => void;
  setPanelCollapsed: (panelId: string, collapsed: boolean) => void;
  registerWidget: (widgetId: string) => void;
  setWidgetVisibility: (widgetId: string, visible: boolean) => void;
}

export const useUiLayoutStore = create<UiLayoutState>((set) => ({
  theme: 'dark',
  collapsedPanels: {},
  widgets: {},
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setPanelCollapsed: (panelId, collapsed) => set((state) => ({
    collapsedPanels: { ...state.collapsedPanels, [panelId]: collapsed },
  })),
  registerWidget: (widgetId) => set((state) => ({
    widgets: state.widgets[widgetId]
      ? state.widgets
      : { ...state.widgets, [widgetId]: { id: widgetId, visible: true } },
  })),
  setWidgetVisibility: (widgetId, visible) => set((state) => ({
    widgets: {
      ...state.widgets,
      [widgetId]: { id: widgetId, visible },
    },
  })),
}));
