// src/hooks/use-form-persistence.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { BookingFormData } from '@/components/forms/booking-form/booking-form';

// Configuración por defecto
const DEFAULT_OPTIONS = {
  storageKey: 'lapa-booking-form',
  debounceMs: 500,
  encryptData: false,
  compression: false,
  maxAge: 24 * 60 * 60 * 1000, // 24 horas en millisegundos
  autoSave: true,
  saveOnUnload: true
};

export interface PersistenceOptions {
  storageKey?: string;
  debounceMs?: number;
  encryptData?: boolean;
  compression?: boolean;
  maxAge?: number; // en millisegundos
  autoSave?: boolean;
  saveOnUnload?: boolean;
  onSave?: (data: any) => void;
  onLoad?: (data: any) => void;
  onError?: (error: Error) => void;
}

export interface UsePersistenceReturn {
  saveFormData: (data: Partial<BookingFormData>) => Promise<void>;
  loadFormData: () => Partial<BookingFormData> | null;
  clearSavedData: () => void;
  hasStoredData: boolean;
  lastSaved: Date | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export function useFormPersistence(
  storageKey: string = DEFAULT_OPTIONS.storageKey,
  options: PersistenceOptions = {}
): UsePersistenceReturn {
  const opts = { ...DEFAULT_OPTIONS, storageKey, ...options };
  
  const [hasStoredData, setHasStoredData] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referencias para debounce y cleanup
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUnloadingRef = useRef(false);

  // Función para comprimir datos (simulada)
  const compressData = useCallback((data: any): string => {
    if (opts.compression) {
      // En una implementación real, usarías una librería como lz-string
      return JSON.stringify(data);
    }
    return JSON.stringify(data);
  }, [opts.compression]);

  // Función para descomprimir datos
  const decompressData = useCallback((compressed: string): any => {
    if (opts.compression) {
      // En una implementación real, usarías la función de descompresión correspondiente
      return JSON.parse(compressed);
    }
    return JSON.parse(compressed);
  }, [opts.compression]);

  // Función para encriptar datos (simulada)
  const encryptData = useCallback((data: string): string => {
    if (opts.encryptData) {
      // En una implementación real, usarías crypto-js o similar
      return btoa(data); // Simple base64 para ejemplo
    }
    return data;
  }, [opts.encryptData]);

  // Función para desencriptar datos
  const decryptData = useCallback((encrypted: string): string => {
    if (opts.encryptData) {
      try {
        return atob(encrypted);
      } catch {
        throw new Error('Error al desencriptar datos');
      }
    }
    return encrypted;
  }, [opts.encryptData]);

  // Función para verificar si los datos han expirado
  const isDataExpired = useCallback((timestamp: number): boolean => {
    return Date.now() - timestamp > opts.maxAge;
  }, [opts.maxAge]);

  // Función para guardar datos
  const saveFormData = useCallback(async (data: Partial<BookingFormData>) => {
    if (isUnloadingRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      const saveData = {
        data,
        timestamp: Date.now(),
        version: '1.0'
      };

      const compressed = compressData(saveData);
      const encrypted = encryptData(compressed);

      if (typeof window !== 'undefined') {
        localStorage.setItem(opts.storageKey, encrypted);
        setHasStoredData(true);
        setLastSaved(new Date());
        opts.onSave?.(data);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido al guardar');
      setError(error.message);
      opts.onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [opts, compressData, encryptData]);

  // Función con debounce para guardar
  const debouncedSave = useCallback((data: Partial<BookingFormData>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveFormData(data);
    }, opts.debounceMs);
  }, [saveFormData, opts.debounceMs]);

  // Función para cargar datos
  const loadFormData = useCallback((): Partial<BookingFormData> | null => {
    if (typeof window === 'undefined') return null;

    try {
      setIsLoading(true);
      setError(null);

      const stored = localStorage.getItem(opts.storageKey);
      if (!stored) {
        setHasStoredData(false);
        return null;
      }

      const decrypted = decryptData(stored);
      const decompressed = decompressData(decrypted);

      // Verificar estructura de datos
      if (!decompressed.data || !decompressed.timestamp) {
        throw new Error('Formato de datos inválido');
      }

      // Verificar expiración
      if (isDataExpired(decompressed.timestamp)) {
        localStorage.removeItem(opts.storageKey);
        setHasStoredData(false);
        return null;
      }

      setHasStoredData(true);
      setLastSaved(new Date(decompressed.timestamp));
      opts.onLoad?.(decompressed.data);

      return decompressed.data;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al cargar datos');
      setError(error.message);
      opts.onError?.(error);
      
      // Limpiar datos corruptos
      localStorage.removeItem(opts.storageKey);
      setHasStoredData(false);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [opts, decryptData, decompressData, isDataExpired]);

  // Función para limpiar datos guardados
  const clearSavedData = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(opts.storageKey);
      setHasStoredData(false);
      setLastSaved(null);
      setError(null);
    }
  }, [opts.storageKey]);

  // Función para manejar guardado antes de salir
  const handleBeforeUnload = useCallback(() => {
    isUnloadingRef.current = true;
    
    // Cancelar debounce pendiente y guardar inmediatamente si es necesario
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  // Configurar event listeners y cargar datos iniciales
  useEffect(() => {
    // Cargar datos al montar el componente
    loadFormData();

    // Configurar event listener para beforeunload
    if (opts.saveOnUnload && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      // Cleanup
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [opts.saveOnUnload, handleBeforeUnload, loadFormData]);

  return {
    saveFormData: opts.autoSave ? debouncedSave : saveFormData,
    loadFormData,
    clearSavedData,
    hasStoredData,
    lastSaved,
    isLoading,
    isSaving,
    error
  };
}

// Hook especializado para persistencia de formulario de booking
export function useBookingPersistence(options: PersistenceOptions = {}) {
  return useFormPersistence('lapa-booking-form', {
    debounceMs: 1000, // 1 segundo para booking forms
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días para bookings
    ...options
  });
}

// Hook para persistencia temporal (solo durante la sesión)
export function useSessionPersistence(
  storageKey: string,
  options: Omit<PersistenceOptions, 'maxAge'> = {}
) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveData = useCallback((newData: any) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(newData));
      setData(newData);
    }
  }, [storageKey]);

  const loadData = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(storageKey);
        const parsed = stored ? JSON.parse(stored) : null;
        setData(parsed);
        return parsed;
      } catch (error) {
        console.error('Error loading session data:', error);
        sessionStorage.removeItem(storageKey);
        return null;
      } finally {
        setIsLoading(false);
      }
    }
    return null;
  }, [storageKey]);

  const clearData = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(storageKey);
      setData(null);
    }
  }, [storageKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    saveData,
    loadData,
    clearData,
    isLoading,
    hasData: data !== null
  };
}

// Utilitarios para gestión de almacenamiento
export const storageUtils = {
  // Obtener tamaño del localStorage
  getStorageSize: (): number => {
    if (typeof window === 'undefined') return 0;
    
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  },

  // Limpiar datos expirados
  cleanExpiredData: (prefix: string = 'lapa-'): number => {
    if (typeof window === 'undefined') return 0;
    
    let cleaned = 0;
    const keysToRemove: string[] = [];
    
    for (const key in localStorage) {
      if (key.startsWith(prefix)) {
        try {
          const data = JSON.parse(localStorage[key]);
          if (data.timestamp && Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
            keysToRemove.push(key);
          }
        } catch {
          // Datos corruptos, marcar para eliminación
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      cleaned++;
    });
    
    return cleaned;
  },

  // Verificar disponibilidad de localStorage
  isStorageAvailable: (): boolean => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },

  // Obtener información de almacenamiento
  getStorageInfo: () => {
    if (typeof window === 'undefined') {
      return { available: false, used: 0, quota: 0 };
    }

    try {
      const used = storageUtils.getStorageSize();
      return {
        available: storageUtils.isStorageAvailable(),
        used,
        quota: 10 * 1024 * 1024, // 10MB estimado
        percentage: (used / (10 * 1024 * 1024)) * 100
      };
    } catch {
      return { available: false, used: 0, quota: 0, percentage: 0 };
    }
  }
};
