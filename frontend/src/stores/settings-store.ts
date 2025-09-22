// src/stores/settings-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Configuración de habitaciones
export interface RoomSettings {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
  basePrice: number;
  isActive: boolean;
  autoConvertHours?: number; // Para habitación flexible
  description?: string;
  amenities?: string[];
}

// Configuración de precios
export interface PricingSettings {
  basePrice: number;
  currency: 'BRL' | 'USD' | 'EUR';
  groupDiscounts: {
    beds7to15: number;  // 0.10 = 10%
    beds16to25: number; // 0.15 = 15%
    beds26plus: number; // 0.20 = 20%
  };
  seasonMultipliers: {
    high: number;    // 1.50 = +50%
    medium: number;  // 1.00 = base
    low: number;     // 0.80 = -20%
    carnival: number; // 2.00 = +100%
  };
  depositRules: {
    standard: number;     // 0.30 = 30%
    largeGroup: number;   // 0.50 = 50% for 15+ people
    largeGroupThreshold: number; // 15 people
    autoChargeDate: number; // 7 days before check-in
    retryAttempts: number;  // 3 attempts
  };
  minimumStay: {
    standard: number;    // 1 night
    carnival: number;    // 5 nights
    newYear: number;     // 3 nights
  };
}

// Configuración de temporadas
export interface SeasonSettings {
  high: {
    startMonth: number; // 12 = Diciembre
    startDay: number;   // 1
    endMonth: number;   // 3 = Marzo
    endDay: number;     // 31
  };
  low: {
    startMonth: number; // 6 = Junio
    startDay: number;   // 1
    endMonth: number;   // 9 = Septiembre
    endDay: number;     // 30
  };
  carnival: {
    enabled: boolean;
    dates: Array<{
      year: number;
      startDate: string; // ISO date
      endDate: string;   // ISO date
    }>;
  };
}

// Configuración de integraciones
export interface IntegrationsSettings {
  stripe: {
    enabled: boolean;
    publicKey: string;
    webhookEndpoint: string;
    supportedCurrencies: string[];
    supportedMethods: string[];
  };
  mercadoPago: {
    enabled: boolean;
    publicKey: string;
    accessToken: string;
    webhookEndpoint: string;
    pixEnabled: boolean;
    installmentsMax: number;
  };
  googleSheets: {
    enabled: boolean;
    spreadsheetId: string;
    worksheetName: string;
    serviceAccountEmail: string;
    autoSync: boolean;
    syncInterval: number; // minutes
  };
  email: {
    enabled: boolean;
    provider: 'resend' | 'sendgrid' | 'ses';
    fromEmail: string;
    fromName: string;
    templatesEnabled: boolean;
  };
  whatsapp: {
    enabled: boolean;
    apiToken: string;
    phoneNumber: string;
    businessAccountId: string;
    templateIds: {
      confirmation: string;
      reminder: string;
      welcome: string;
      cancellation: string;
    };
  };
  analytics: {
    googleAnalytics: {
      enabled: boolean;
      measurementId: string;
    };
    facebookPixel: {
      enabled: boolean;
      pixelId: string;
    };
    hotjar: {
      enabled: boolean;
      siteId: string;
    };
  };
}

// Configuración del sitio
export interface SiteSettings {
  general: {
    name: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
    defaultLanguage: 'pt' | 'en' | 'es';
    supportedLanguages: Array<'pt' | 'en' | 'es'>;
  };
  booking: {
    maxAdvanceBooking: number; // days
    minAdvanceBooking: number; // hours
    cutoffTime: string; // "14:00"
    checkInTime: string; // "15:00"
    checkOutTime: string; // "11:00"
    allowSameDayBooking: boolean;
    requirePhoneNumber: boolean;
    requireCountry: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    whatsappNotifications: boolean;
    pushNotifications: boolean;
    adminEmailAlerts: boolean;
    bookingAlerts: boolean;
    paymentAlerts: boolean;
    systemAlerts: boolean;
  };
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoUrl?: string;
    faviconUrl?: string;
    customCSS?: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    ogImage?: string;
    structuredData: boolean;
    sitemap: boolean;
    robots: boolean;
  };
}

export interface SettingsState {
  // Configuraciones
  rooms: RoomSettings[];
  pricing: PricingSettings;
  seasons: SeasonSettings;
  integrations: IntegrationsSettings;
  site: SiteSettings;
  
  // Estado de carga y sincronización
  isLoading: boolean;
  isSaving: boolean;
  lastSync: Date | null;
  hasUnsavedChanges: boolean;
  
  // Errores
  errors: Record<string, string>;
  
  // Acciones de habitaciones
  addRoom: (room: Omit<RoomSettings, 'id'>) => void;
  updateRoom: (id: string, updates: Partial<RoomSettings>) => void;
  deleteRoom: (id: string) => void;
  toggleRoomActive: (id: string) => void;
  reorderRooms: (roomIds: string[]) => void;
  
  // Acciones de precios
  updatePricing: (updates: Partial<PricingSettings>) => void;
  updateGroupDiscount: (tier: keyof PricingSettings['groupDiscounts'], value: number) => void;
  updateSeasonMultiplier: (season: keyof PricingSettings['seasonMultipliers'], value: number) => void;
  updateDepositRules: (updates: Partial<PricingSettings['depositRules']>) => void;
  
  // Acciones de temporadas
  updateSeasons: (updates: Partial<SeasonSettings>) => void;
  addCarnivalDate: (year: number, startDate: string, endDate: string) => void;
  removeCarnivalDate: (year: number) => void;
  
  // Acciones de integraciones
  updateIntegration: <K extends keyof IntegrationsSettings>(
    integration: K, 
    updates: Partial<IntegrationsSettings[K]>
  ) => void;
  toggleIntegration: (integration: keyof IntegrationsSettings, enabled: boolean) => void;
  testIntegration: (integration: keyof IntegrationsSettings) => Promise<boolean>;
  
  // Acciones del sitio
  updateSiteSettings: <K extends keyof SiteSettings>(
    section: K, 
    updates: Partial<SiteSettings[K]>
  ) => void;
  
  // Acciones de estado
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLastSync: (date: Date) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Acciones de errores
  setError: (key: string, error: string) => void;
  clearError: (key: string) => void;
  clearAllErrors: () => void;
  
  // Acciones de persistencia
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
  resetToDefaults: () => void;
  exportSettings: () => string;
  importSettings: (data: string) => boolean;
  
  // Helpers
  getRoomById: (id: string) => RoomSettings | undefined;
  getActiveRooms: () => RoomSettings[];
  getTotalCapacity: () => number;
  isIntegrationEnabled: (integration: keyof IntegrationsSettings) => boolean;
  getCurrentSeason: () => 'high' | 'medium' | 'low' | 'carnival';
  calculateGroupDiscount: (beds: number) => number;
  getSeasonMultiplier: (date: Date) => number;
}

const initialRooms: RoomSettings[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    isFlexible: false,
    basePrice: 60.00,
    isActive: true,
    description: 'Habitación mixta con 12 camas',
    amenities: ['aire_acondicionado', 'lockers', 'wifi'],
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    isFlexible: false,
    basePrice: 60.00,
    isActive: true,
    description: 'Habitación mixta con 12 camas',
    amenities: ['aire_acondicionado', 'lockers', 'wifi'],
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    isFlexible: false,
    basePrice: 60.00,
    isActive: true,
    description: 'Habitación mixta con 7 camas',
    amenities: ['aire_acondicionado', 'lockers', 'wifi'],
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female',
    isFlexible: true,
    basePrice: 60.00,
    isActive: true,
    autoConvertHours: 48,
    description: 'Habitación femenina que se convierte a mixta automáticamente',
    amenities: ['aire_acondicionado', 'lockers', 'wifi'],
  },
];

const initialPricing: PricingSettings = {
  basePrice: 60.00,
  currency: 'BRL',
  groupDiscounts: {
    beds7to15: 0.10,
    beds16to25: 0.15,
    beds26plus: 0.20,
  },
  seasonMultipliers: {
    high: 1.50,
    medium: 1.00,
    low: 0.80,
    carnival: 2.00,
  },
  depositRules: {
    standard: 0.30,
    largeGroup: 0.50,
    largeGroupThreshold: 15,
    autoChargeDate: 7,
    retryAttempts: 3,
  },
  minimumStay: {
    standard: 1,
    carnival: 5,
    newYear: 3,
  },
};

const initialSeasons: SeasonSettings = {
  high: {
    startMonth: 12,
    startDay: 1,
    endMonth: 3,
    endDay: 31,
  },
  low: {
    startMonth: 6,
    startDay: 1,
    endMonth: 9,
    endDay: 30,
  },
  carnival: {
    enabled: true,
    dates: [
      {
        year: 2025,
        startDate: '2025-02-28',
        endDate: '2025-03-04',
      },
      {
        year: 2026,
        startDate: '2026-02-13',
        endDate: '2026-02-17',
      },
    ],
  },
};

const initialIntegrations: IntegrationsSettings = {
  stripe: {
    enabled: false,
    publicKey: '',
    webhookEndpoint: '',
    supportedCurrencies: ['BRL', 'USD', 'EUR'],
    supportedMethods: ['card', 'apple_pay', 'google_pay'],
  },
  mercadoPago: {
    enabled: false,
    publicKey: '',
    accessToken: '',
    webhookEndpoint: '',
    pixEnabled: true,
    installmentsMax: 12,
  },
  googleSheets: {
    enabled: false,
    spreadsheetId: '',
    worksheetName: 'Reservas',
    serviceAccountEmail: '',
    autoSync: true,
    syncInterval: 5,
  },
  email: {
    enabled: false,
    provider: 'resend',
    fromEmail: 'reservas@lapacasahostel.com',
    fromName: 'Lapa Casa Hostel',
    templatesEnabled: true,
  },
  whatsapp: {
    enabled: false,
    apiToken: '',
    phoneNumber: '',
    businessAccountId: '',
    templateIds: {
      confirmation: '',
      reminder: '',
      welcome: '',
      cancellation: '',
    },
  },
  analytics: {
    googleAnalytics: {
      enabled: false,
      measurementId: '',
    },
    facebookPixel: {
      enabled: false,
      pixelId: '',
    },
    hotjar: {
      enabled: false,
      siteId: '',
    },
  },
};

const initialSite: SiteSettings = {
  general: {
    name: 'Lapa Casa Hostel',
    description: 'Hostel especializado en grupos en Santa Teresa, Rio de Janeiro',
    address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro',
    phone: '+55 21 XXXX-XXXX',
    email: 'contato@lapacasahostel.com',
    website: 'lapacasahostel.com',
    timezone: 'America/Sao_Paulo',
    defaultLanguage: 'pt',
    supportedLanguages: ['pt', 'en', 'es'],
  },
  booking: {
    maxAdvanceBooking: 365,
    minAdvanceBooking: 2,
    cutoffTime: '14:00',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    allowSameDayBooking: false,
    requirePhoneNumber: true,
    requireCountry: true,
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    whatsappNotifications: false,
    pushNotifications: false,
    adminEmailAlerts: true,
    bookingAlerts: true,
    paymentAlerts: true,
    systemAlerts: true,
  },
  appearance: {
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    accentColor: '#f59e0b',
    fontFamily: 'Inter',
  },
  seo: {
    metaTitle: 'Lapa Casa Hostel - Especialistas em Grupos | Santa Teresa, Rio de Janeiro',
    metaDescription: 'Hostel em Santa Teresa especializado em grupos de 7+ pessoas. 45 camas, localização privilegiada, reservas online.',
    keywords: ['hostel', 'rio de janeiro', 'santa teresa', 'grupos', 'reservas'],
    structuredData: true,
    sitemap: true,
    robots: true,
  },
};

const initialState = {
  rooms: initialRooms,
  pricing: initialPricing,
  seasons: initialSeasons,
  integrations: initialIntegrations,
  site: initialSite,
  isLoading: false,
  isSaving: false,
  lastSync: null,
  hasUnsavedChanges: false,
  errors: {},
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Acciones de habitaciones
      addRoom: (room) => {
        const id = `room_${Date.now()}`;
        set((state) => {
          state.rooms.push({ ...room, id });
          state.hasUnsavedChanges = true;
        });
      },

      updateRoom: (id, updates) => {
        set((state) => {
          const room = state.rooms.find(r => r.id === id);
          if (room) {
            Object.assign(room, updates);
            state.hasUnsavedChanges = true;
          }
        });
      },

      deleteRoom: (id) => {
        set((state) => {
          state.rooms = state.rooms.filter(r => r.id !== id);
          state.hasUnsavedChanges = true;
        });
      },

      toggleRoomActive: (id) => {
        set((state) => {
          const room = state.rooms.find(r => r.id === id);
          if (room) {
            room.isActive = !room.isActive;
            state.hasUnsavedChanges = true;
          }
        });
      },

      reorderRooms: (roomIds) => {
        set((state) => {
          const orderedRooms = roomIds.map(id => state.rooms.find(r => r.id === id)).filter(Boolean) as RoomSettings[];
          state.rooms = orderedRooms;
          state.hasUnsavedChanges = true;
        });
      },

      // Acciones de precios
      updatePricing: (updates) => {
        set((state) => {
          Object.assign(state.pricing, updates);
          state.hasUnsavedChanges = true;
        });
      },

      updateGroupDiscount: (tier, value) => {
        set((state) => {
          state.pricing.groupDiscounts[tier] = value;
          state.hasUnsavedChanges = true;
        });
      },

      updateSeasonMultiplier: (season, value) => {
        set((state) => {
          state.pricing.seasonMultipliers[season] = value;
          state.hasUnsavedChanges = true;
        });
      },

      updateDepositRules: (updates) => {
        set((state) => {
          Object.assign(state.pricing.depositRules, updates);
          state.hasUnsavedChanges = true;
        });
      },

      // Acciones de temporadas
      updateSeasons: (updates) => {
        set((state) => {
          Object.assign(state.seasons, updates);
          state.hasUnsavedChanges = true;
        });
      },

      addCarnivalDate: (year, startDate, endDate) => {
        set((state) => {
          const existingIndex = state.seasons.carnival.dates.findIndex(d => d.year === year);
          if (existingIndex >= 0) {
            state.seasons.carnival.dates[existingIndex] = { year, startDate, endDate };
          } else {
            state.seasons.carnival.dates.push({ year, startDate, endDate });
          }
          state.hasUnsavedChanges = true;
        });
      },

      removeCarnivalDate: (year) => {
        set((state) => {
          state.seasons.carnival.dates = state.seasons.carnival.dates.filter(d => d.year !== year);
          state.hasUnsavedChanges = true;
        });
      },

      // Acciones de integraciones
      updateIntegration: (integration, updates) => {
        set((state) => {
          Object.assign(state.integrations[integration], updates);
          state.hasUnsavedChanges = true;
        });
      },

      toggleIntegration: (integration, enabled) => {
        set((state) => {
          (state.integrations[integration] as any).enabled = enabled;
          state.hasUnsavedChanges = true;
        });
      },

      testIntegration: async (integration) => {
        // Mock implementation
        console.log(`Testing integration: ${integration}`);
        return true;
      },

      // Acciones del sitio
      updateSiteSettings: (section, updates) => {
        set((state) => {
          Object.assign(state.site[section], updates);
          state.hasUnsavedChanges = true;
        });
      },

      // Acciones de estado
      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setSaving: (saving) => {
        set((state) => {
          state.isSaving = saving;
        });
      },

      setLastSync: (date) => {
        set((state) => {
          state.lastSync = date;
        });
      },

      setHasUnsavedChanges: (hasChanges) => {
        set((state) => {
          state.hasUnsavedChanges = hasChanges;
        });
      },

      // Acciones de errores
      setError: (key, error) => {
        set((state) => {
          state.errors[key] = error;
        });
      },

      clearError: (key) => {
        set((state) => {
          delete state.errors[key];
        });
      },

      clearAllErrors: () => {
        set((state) => {
          state.errors = {};
        });
      },

      // Acciones de persistencia
      saveSettings: async () => {
        set((state) => {
          state.isSaving = true;
        });

        try {
          // Aquí se implementaría la lógica de guardado en el backend
          await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
          
          set((state) => {
            state.hasUnsavedChanges = false;
            state.lastSync = new Date();
          });
        } catch (error) {
          get().setError('save', 'Error guardando configuración');
          throw error;
        } finally {
          set((state) => {
            state.isSaving = false;
          });
        }
      },

      loadSettings: async () => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          // Aquí se implementaría la lógica de carga desde el backend
          await new Promise(resolve => setTimeout(resolve, 500)); // Mock delay
          
          set((state) => {
            state.lastSync = new Date();
          });
        } catch (error) {
          get().setError('load', 'Error cargando configuración');
          throw error;
        } finally {
          set((state) => {
            state.isLoading = false;
          });
        }
      },

      resetToDefaults: () => {
        set((state) => {
          Object.assign(state, initialState);
          state.hasUnsavedChanges = true;
        });
      },

      exportSettings: () => {
        const state = get();
        const exportData = {
          rooms: state.rooms,
          pricing: state.pricing,
          seasons: state.seasons,
          integrations: state.integrations,
          site: state.site,
          exportedAt: new Date().toISOString(),
          version: '1.0',
        };
        return JSON.stringify(exportData, null, 2);
      },

      importSettings: (data) => {
        try {
          const parsedData = JSON.parse(data);
          
          // Validar estructura básica
          if (!parsedData.rooms || !parsedData.pricing || !parsedData.site) {
            get().setError('import', 'Formato de archivo inválido');
            return false;
          }

          set((state) => {
            state.rooms = parsedData.rooms;
            state.pricing = parsedData.pricing;
            state.seasons = parsedData.seasons || initialSeasons;
            state.integrations = parsedData.integrations || initialIntegrations;
            state.site = parsedData.site;
            state.hasUnsavedChanges = true;
          });

          return true;
        } catch (error) {
          get().setError('import', 'Error procesando archivo de configuración');
          return false;
        }
      },

      // Helpers
      getRoomById: (id) => {
        return get().rooms.find(room => room.id === id);
      },

      getActiveRooms: () => {
        return get().rooms.filter(room => room.isActive);
      },

      getTotalCapacity: () => {
        return get().rooms
          .filter(room => room.isActive)
          .reduce((total, room) => total + room.capacity, 0);
      },

      isIntegrationEnabled: (integration) => {
        return (get().integrations[integration] as any)?.enabled || false;
      },

      getCurrentSeason: () => {
        const now = new Date();
        const month = now.getMonth() + 1; // 1-based
        const day = now.getDate();
        const { seasons } = get();

        // Verificar si es carnaval
        if (seasons.carnival.enabled) {
          const currentYear = now.getFullYear();
          const carnivalDate = seasons.carnival.dates.find(d => d.year === currentYear);
          if (carnivalDate) {
            const startDate = new Date(carnivalDate.startDate);
            const endDate = new Date(carnivalDate.endDate);
            if (now >= startDate && now <= endDate) {
              return 'carnival';
            }
          }
        }

        // Verificar temporada alta (Dic-Mar)
        if (
          (month === 12 && day >= seasons.high.startDay) ||
          (month <= 3 && (month < 3 || day <= seasons.high.endDay))
        ) {
          return 'high';
        }

        // Verificar temporada baja (Jun-Sep)
        if (
          month >= seasons.low.startMonth &&
          month <= seasons.low.endMonth &&
          (month > seasons.low.startMonth || day >= seasons.low.startDay) &&
          (month < seasons.low.endMonth || day <= seasons.low.endDay)
        ) {
          return 'low';
        }

        // Temporada media por defecto
        return 'medium';
      },

      calculateGroupDiscount: (beds) => {
        const { groupDiscounts } = get().pricing;
        
        if (beds >= 26) return groupDiscounts.beds26plus;
        if (beds >= 16) return groupDiscounts.beds16to25;
        if (beds >= 7) return groupDiscounts.beds7to15;
        
        return 0;
      },

      getSeasonMultiplier: (date) => {
        const originalCurrentSeason = get().getCurrentSeason;
        const tempDate = new Date();
        
        // Temporalmente cambiar la fecha para el cálculo
        const originalGetTime = Date.prototype.getTime;
        Date.prototype.getTime = function() {
          if (this === tempDate) return date.getTime();
          return originalGetTime.call(this);
        };
        
        const season = originalCurrentSeason();
        
        // Restaurar el método original
        Date.prototype.getTime = originalGetTime;
        
        const { seasonMultipliers } = get().pricing;
        return seasonMultipliers[season];
      },
    })),
    {
      name: 'lapa-casa-settings-storage',
      partialize: (state) => ({
        rooms: state.rooms,
        pricing: state.pricing,
        seasons: state.seasons,
        integrations: state.integrations,
        site: state.site,
        lastSync: state.lastSync,
      }),
    }
  )
);

// Selectores útiles
export const useRooms = () => useSettingsStore((state) => state.rooms);
export const useActiveRooms = () => useSettingsStore((state) => state.getActiveRooms());
export const usePricing = () => useSettingsStore((state) => state.pricing);
export const useSeasons = () => useSettingsStore((state) => state.seasons);
export const useIntegrations = () => useSettingsStore((state) => state.integrations);
export const useSiteSettings = () => useSettingsStore((state) => state.site);
export const useSettingsLoading = () => useSettingsStore((state) => state.isLoading);
export const useSettingsSaving = () => useSettingsStore((state) => state.isSaving);
export const useHasUnsavedChanges = () => useSettingsStore((state) => state.hasUnsavedChanges);
export const useSettingsErrors = () => useSettingsStore((state) => state.errors);
export const useCurrentSeason = () => useSettingsStore((state) => state.getCurrentSeason());
export const useTotalCapacity = () => useSettingsStore((state) => state.getTotalCapacity());

// Hook personalizado para configuración de habitaciones
export const useRoomSettings = () => {
  const store = useSettingsStore();
  
  return {
    rooms: store.rooms,
    activeRooms: store.getActiveRooms(),
    totalCapacity: store.getTotalCapacity(),
    addRoom: store.addRoom,
    updateRoom: store.updateRoom,
    deleteRoom: store.deleteRoom,
    toggleActive: store.toggleRoomActive,
    reorder: store.reorderRooms,
    getRoomById: store.getRoomById,
  };
};

// Hook personalizado para configuración de precios
export const usePricingSettings = () => {
  const store = useSettingsStore();
  
  return {
    pricing: store.pricing,
    updatePricing: store.updatePricing,
    updateGroupDiscount: store.updateGroupDiscount,
    updateSeasonMultiplier: store.updateSeasonMultiplier,
    updateDepositRules: store.updateDepositRules,
    calculateGroupDiscount: store.calculateGroupDiscount,
    getSeasonMultiplier: store.getSeasonMultiplier,
    getCurrentSeason: store.getCurrentSeason,
  };
};

// Hook personalizado para integraciones
export const useIntegrationsSettings = () => {
  const store = useSettingsStore();
  
  return {
    integrations: store.integrations,
    updateIntegration: store.updateIntegration,
    toggleIntegration: store.toggleIntegration,
    testIntegration: store.testIntegration,
    isEnabled: store.isIntegrationEnabled,
  };
};
