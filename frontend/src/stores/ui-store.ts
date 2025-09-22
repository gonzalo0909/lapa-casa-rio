// src/stores/ui-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Tipos para modales
export interface ModalConfig {
  id: string;
  title: string;
  content: React.ReactNode | null;
  size: 'sm' | 'md' | 'lg' | 'xl';
  closable: boolean;
  onClose?: () => void;
}

// Tipos para notificaciones
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = permanent
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

// Tipos para estado de carga
export interface LoadingState {
  [key: string]: boolean;
}

// Tipos para filtros y ordenamiento
export interface TableFilters {
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, any>;
}

export interface UIState {
  // Responsive
  isMobile: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  // Tema y configuración visual
  theme: 'light' | 'dark' | 'auto';
  language: 'pt' | 'en' | 'es';
  
  // Sidebar y navegación
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // Modales
  modals: ModalConfig[];
  
  // Notificaciones (toasts)
  notifications: Notification[];
  
  // Estados de carga globales
  loadingStates: LoadingState;
  
  // Formularios
  formTouched: Record<string, boolean>;
  formErrors: Record<string, Record<string, string>>;
  
  // Tablas y listados
  tableFilters: Record<string, TableFilters>;
  
  // Calendario
  calendarView: 'month' | 'week' | 'day';
  calendarDate: Date;
  
  // Booking UI específico
  bookingStepperExpanded: boolean;
  roomSelectorView: 'grid' | 'list';
  showGroupDiscountInfo: boolean;
  showPriceBreakdown: boolean;
  
  // Acciones de configuración general
  setScreenSize: (size: UIState['screenSize']) => void;
  setIsMobile: (isMobile: boolean) => void;
  setTheme: (theme: UIState['theme']) => void;
  setLanguage: (language: UIState['language']) => void;
  
  // Acciones de navegación
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  
  // Acciones de modales
  openModal: (config: Omit<ModalConfig, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  
  // Acciones de notificaciones
  showNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Acciones de estados de carga
  setLoading: (key: string, loading: boolean) => void;
  clearLoading: (key: string) => void;
  
  // Acciones de formularios
  setFormTouched: (formId: string, touched: boolean) => void;
  setFormError: (formId: string, field: string, error: string) => void;
  clearFormError: (formId: string, field?: string) => void;
  clearFormErrors: (formId: string) => void;
  
  // Acciones de tablas
  setTableFilter: (tableId: string, filters: Partial<TableFilters>) => void;
  clearTableFilters: (tableId: string) => void;
  
  // Acciones de calendario
  setCalendarView: (view: UIState['calendarView']) => void;
  setCalendarDate: (date: Date) => void;
  
  // Acciones específicas de booking
  setBookingStepperExpanded: (expanded: boolean) => void;
  setRoomSelectorView: (view: UIState['roomSelectorView']) => void;
  toggleGroupDiscountInfo: () => void;
  togglePriceBreakdown: () => void;
}

const initialState = {
  isMobile: false,
  screenSize: 'lg' as const,
  theme: 'light' as const,
  language: 'pt' as const,
  sidebarOpen: false,
  sidebarCollapsed: false,
  modals: [],
  notifications: [],
  loadingStates: {},
  formTouched: {},
  formErrors: {},
  tableFilters: {},
  calendarView: 'month' as const,
  calendarDate: new Date(),
  bookingStepperExpanded: false,
  roomSelectorView: 'grid' as const,
  showGroupDiscountInfo: false,
  showPriceBreakdown: false,
};

export const useUIStore = create<UIState>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Configuración general
      setScreenSize: (size: UIState['screenSize']) => {
        set((state) => {
          state.screenSize = size;
          state.isMobile = size === 'xs' || size === 'sm';
        });
      },

      setIsMobile: (isMobile: boolean) => {
        set((state) => {
          state.isMobile = isMobile;
        });
      },

      setTheme: (theme: UIState['theme']) => {
        set((state) => {
          state.theme = theme;
        });
      },

      setLanguage: (language: UIState['language']) => {
        set((state) => {
          state.language = language;
        });
      },

      // Navegación
      toggleSidebar: () => {
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        });
      },

      setSidebarOpen: (open: boolean) => {
        set((state) => {
          state.sidebarOpen = open;
        });
      },

      toggleSidebarCollapsed: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      // Modales
      openModal: (config: Omit<ModalConfig, 'id'>) => {
        const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => {
          state.modals.push({ ...config, id });
        });
        return id;
      },

      closeModal: (id: string) => {
        set((state) => {
          const modal = state.modals.find(m => m.id === id);
          if (modal?.onClose) {
            modal.onClose();
          }
          state.modals = state.modals.filter(m => m.id !== id);
        });
      },

      closeAllModals: () => {
        set((state) => {
          state.modals.forEach(modal => {
            if (modal.onClose) {
              modal.onClose();
            }
          });
          state.modals = [];
        });
      },

      // Notificaciones
      showNotification: (notification: Omit<Notification, 'id'>) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const duration = notification.duration ?? 5000;
        
        set((state) => {
          state.notifications.push({ ...notification, id });
        });

        // Auto-remove después del tiempo especificado
        if (duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, duration);
        }

        return id;
      },

      removeNotification: (id: string) => {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
        });
      },

      clearNotifications: () => {
        set((state) => {
          state.notifications = [];
        });
      },

      // Estados de carga
      setLoading: (key: string, loading: boolean) => {
        set((state) => {
          if (loading) {
            state.loadingStates[key] = true;
          } else {
            delete state.loadingStates[key];
          }
        });
      },

      clearLoading: (key: string) => {
        set((state) => {
          delete state.loadingStates[key];
        });
      },

      // Formularios
      setFormTouched: (formId: string, touched: boolean) => {
        set((state) => {
          state.formTouched[formId] = touched;
        });
      },

      setFormError: (formId: string, field: string, error: string) => {
        set((state) => {
          if (!state.formErrors[formId]) {
            state.formErrors[formId] = {};
          }
          state.formErrors[formId][field] = error;
        });
      },

      clearFormError: (formId: string, field?: string) => {
        set((state) => {
          if (!state.formErrors[formId]) return;
          
          if (field) {
            delete state.formErrors[formId][field];
          } else {
            state.formErrors[formId] = {};
          }
        });
      },

      clearFormErrors: (formId: string) => {
        set((state) => {
          delete state.formErrors[formId];
        });
      },

      // Tablas
      setTableFilter: (tableId: string, filters: Partial<TableFilters>) => {
        set((state) => {
          if (!state.tableFilters[tableId]) {
            state.tableFilters[tableId] = {
              search: '',
              sortBy: '',
              sortOrder: 'asc',
              filters: {},
            };
          }
          
          Object.assign(state.tableFilters[tableId], filters);
        });
      },

      clearTableFilters: (tableId: string) => {
        set((state) => {
          delete state.tableFilters[tableId];
        });
      },

      // Calendario
      setCalendarView: (view: UIState['calendarView']) => {
        set((state) => {
          state.calendarView = view;
        });
      },

      setCalendarDate: (date: Date) => {
        set((state) => {
          state.calendarDate = date;
        });
      },

      // Booking específico
      setBookingStepperExpanded: (expanded: boolean) => {
        set((state) => {
          state.bookingStepperExpanded = expanded;
        });
      },

      setRoomSelectorView: (view: UIState['roomSelectorView']) => {
        set((state) => {
          state.roomSelectorView = view;
        });
      },

      toggleGroupDiscountInfo: () => {
        set((state) => {
          state.showGroupDiscountInfo = !state.showGroupDiscountInfo;
        });
      },

      togglePriceBreakdown: () => {
        set((state) => {
          state.showPriceBreakdown = !state.showPriceBreakdown;
        });
      },
    })),
    {
      name: 'lapa-casa-ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        roomSelectorView: state.roomSelectorView,
        calendarView: state.calendarView,
      }),
    }
  )
);

// Selectores útiles
export const useTheme = () => useUIStore((state) => state.theme);
export const useLanguage = () => useUIStore((state) => state.language);
export const useIsMobile = () => useUIStore((state) => state.isMobile);
export const useModals = () => useUIStore((state) => state.modals);
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useLoadingStates = () => useUIStore((state) => state.loadingStates);
export const useIsLoading = (key: string) => useUIStore((state) => state.loadingStates[key] || false);
export const useFormErrors = (formId: string) => useUIStore((state) => state.formErrors[formId] || {});
export const useTableFilters = (tableId: string) => useUIStore((state) => state.tableFilters[tableId]);

// Hook personalizado para notificaciones
export const useNotify = () => {
  const showNotification = useUIStore((state) => state.showNotification);
  
  return {
    success: (title: string, message?: string) =>
      showNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      showNotification({ type: 'error', title, message, duration: 8000 }),
    warning: (title: string, message?: string) =>
      showNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      showNotification({ type: 'info', title, message }),
  };
};
