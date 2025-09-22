// src/lib/pwa/offline-handler.ts

interface OfflineBookingData {
  id: string;
  guestData: any;
  bookingData: any;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
}

interface SyncQueueItem {
  id: string;
  action: 'create_booking' | 'update_booking' | 'payment_attempt';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export class OfflineHandler {
  private readonly DB_NAME = 'LapaOfflineDB';
  private readonly DB_VERSION = 1;
  private readonly BOOKING_STORE = 'bookings';
  private readonly SYNC_STORE = 'syncQueue';
  private db: IDBDatabase | null = null;
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    this.initializeDB();
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  // Inicializar IndexedDB
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Error abriendo IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB inicializada correctamente');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store para reservas offline
        if (!db.objectStoreNames.contains(this.BOOKING_STORE)) {
          const bookingStore = db.createObjectStore(this.BOOKING_STORE, { keyPath: 'id' });
          bookingStore.createIndex('timestamp', 'timestamp');
          bookingStore.createIndex('status', 'status');
        }

        // Store para cola de sincronización
        if (!db.objectStoreNames.contains(this.SYNC_STORE)) {
          const syncStore = db.createObjectStore(this.SYNC_STORE, { keyPath: 'id' });
          syncStore.createIndex('action', 'action');
          syncStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  // Configurar event listeners
  private setupEventListeners(): void {
    // Detectar cambios de conexión
    window.addEventListener('online', () => {
      console.log('Conexión restaurada');
      this.isOnline = true;
      this.notifyConnectionChange(true);
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.log('Conexión perdida');
      this.isOnline = false;
      this.notifyConnectionChange(false);
    });

    // Sincronizar antes de cerrar la app
    window.addEventListener('beforeunload', () => {
      this.syncPendingData();
    });

    // Visibilidad de la página
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncPendingData();
      }
    });
  }

  // Guardar reserva offline
  async saveOfflineBooking(bookingData: any, guestData: any): Promise<string> {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    const offlineBooking: OfflineBookingData = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      guestData,
      bookingData: {
        ...bookingData,
        isOffline: true,
        createdOffline: new Date().toISOString()
      },
      timestamp: Date.now(),
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BOOKING_STORE], 'readwrite');
      const store = transaction.objectStore(this.BOOKING_STORE);
      
      const request = store.add(offlineBooking);
      
      request.onsuccess = () => {
        console.log('Reserva guardada offline:', offlineBooking.id);
        this.addToSyncQueue('create_booking', offlineBooking);
        resolve(offlineBooking.id);
      };
      
      request.onerror = () => {
        console.error('Error guardando reserva offline:', request.error);
        reject(request.error);
      };
    });
  }

  // Obtener reservas offline
  async getOfflineBookings(): Promise<OfflineBookingData[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BOOKING_STORE], 'readonly');
      const store = transaction.objectStore(this.BOOKING_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Error obteniendo reservas offline:', request.error);
        reject(request.error);
      };
    });
  }

  // Agregar item a cola de sincronización
  private async addToSyncQueue(action: string, data: any): Promise<void> {
    if (!this.db) return;

    const syncItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: action as any,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.SYNC_STORE], 'readwrite');
      const store = transaction.objectStore(this.SYNC_STORE);
      
      const request = store.add(syncItem);
      
      request.onsuccess = () => {
        console.log('Item agregado a cola de sincronización:', syncItem.id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Error agregando a cola de sincronización:', request.error);
        reject(request.error);
      };
    });
  }

  // Sincronizar datos pendientes
  async syncPendingData(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || !this.db) {
      return;
    }

    this.syncInProgress = true;
    console.log('Iniciando sincronización de datos offline...');

    try {
      const syncItems = await this.getSyncQueue();
      
      for (const item of syncItems) {
        try {
          await this.processSyncItem(item);
          await this.removeSyncItem(item.id);
        } catch (error) {
          console.error('Error procesando item de sincronización:', error);
          await this.incrementRetryCount(item);
        }
      }

      console.log('Sincronización completada');
    } catch (error) {
      console.error('Error durante sincronización:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Obtener cola de sincronización
  private async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.SYNC_STORE], 'readonly');
      const store = transaction.objectStore(this.SYNC_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Error obteniendo cola de sincronización:', request.error);
        reject(request.error);
      };
    });
  }

  // Procesar item de sincronización
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'create_booking':
        await this.syncBookingCreation(item.data);
        break;
      case 'update_booking':
        await this.syncBookingUpdate(item.data);
        break;
      case 'payment_attempt':
        await this.syncPaymentAttempt(item.data);
        break;
      default:
        console.warn('Acción de sincronización no reconocida:', item.action);
    }
  }

  // Sincronizar creación de reserva
  private async syncBookingCreation(bookingData: OfflineBookingData): Promise<void> {
    try {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guest: bookingData.guestData,
          booking: bookingData.bookingData,
          isOfflineSync: true,
          offlineId: bookingData.id
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      // Actualizar estado de la reserva offline
      await this.updateOfflineBookingStatus(bookingData.id, 'synced', result.bookingId);
      
      console.log('Reserva sincronizada correctamente:', result.bookingId);
    } catch (error) {
      console.error('Error sincronizando reserva:', error);
      await this.updateOfflineBookingStatus(bookingData.id, 'failed');
      throw error;
    }
  }

  // Sincronizar actualización de reserva
  private async syncBookingUpdate(updateData: any): Promise<void> {
    try {
      const response = await fetch(`/api/bookings/${updateData.bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData.changes)
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      console.log('Actualización de reserva sincronizada');
    } catch (error) {
      console.error('Error sincronizando actualización:', error);
      throw error;
    }
  }

  // Sincronizar intento de pago
  private async syncPaymentAttempt(paymentData: any): Promise<void> {
    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...paymentData,
          isOfflineSync: true
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      console.log('Pago sincronizado correctamente');
    } catch (error) {
      console.error('Error sincronizando pago:', error);
      throw error;
    }
  }

  // Actualizar estado de reserva offline
  private async updateOfflineBookingStatus(
    offlineId: string, 
    status: 'pending' | 'synced' | 'failed',
    serverBookingId?: string
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BOOKING_STORE], 'readwrite');
      const store = transaction.objectStore(this.BOOKING_STORE);
      
      const getRequest = store.get(offlineId);
      
      getRequest.onsuccess = () => {
        const booking = getRequest.result;
        if (booking) {
          booking.status = status;
          if (serverBookingId) {
            booking.serverBookingId = serverBookingId;
          }
          
          const updateRequest = store.put(booking);
          
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Incrementar contador de reintentos
  private async incrementRetryCount(item: SyncQueueItem): Promise<void> {
    if (!this.db) return;

    item.retryCount++;
    
    if (item.retryCount >= item.maxRetries) {
      console.warn('Máximo de reintentos alcanzado para:', item.id);
      await this.removeSyncItem(item.id);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.SYNC_STORE], 'readwrite');
      const store = transaction.objectStore(this.SYNC_STORE);
      
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Remover item de cola de sincronización
  private async removeSyncItem(itemId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.SYNC_STORE], 'readwrite');
      const store = transaction.objectStore(this.SYNC_STORE);
      
      const request = store.delete(itemId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Limpiar datos antiguos
  async cleanupOldData(): Promise<void> {
    if (!this.db) return;

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Limpiar reservas sincronizadas antiguas
    const transaction = this.db.transaction([this.BOOKING_STORE, this.SYNC_STORE], 'readwrite');
    
    const bookingStore = transaction.objectStore(this.BOOKING_STORE);
    const syncStore = transaction.objectStore(this.SYNC_STORE);
    
    const bookingIndex = bookingStore.index('timestamp');
    const syncIndex = syncStore.index('timestamp');
    
    // Eliminar reservas sincronizadas de hace más de 7 días
    const bookingRange = IDBKeyRange.upperBound(sevenDaysAgo);
    const bookingRequest = bookingIndex.openCursor(bookingRange);
    
    bookingRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const booking = cursor.value;
        if (booking.status === 'synced') {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    
    // Eliminar items de sincronización antiguos
    const syncRange = IDBKeyRange.upperBound(sevenDaysAgo);
    const syncRequest = syncIndex.openCursor(syncRange);
    
    syncRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  // Notificar cambios de conexión
  private notifyConnectionChange(isOnline: boolean): void {
    const event = new CustomEvent('connectionchange', {
      detail: { isOnline }
    });
    window.dispatchEvent(event);
  }

  // Sincronización periódica
  private startPeriodicSync(): void {
    // Sincronizar cada 5 minutos si hay conexión
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingData();
      }
    }, 5 * 60 * 1000);
    
    // Limpiar datos antiguos cada hora
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  // Métodos públicos para estado
  
  isConnected(): boolean {
    return this.isOnline;
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  async getPendingBookingsCount(): Promise<number> {
    const bookings = await this.getOfflineBookings();
    return bookings.filter(b => b.status === 'pending').length;
  }

  async getFailedBookingsCount(): Promise<number> {
    const bookings = await this.getOfflineBookings();
    return bookings.filter(b => b.status === 'failed').length;
  }

  // Guardar datos de formulario para recuperación
  saveFormDraft(formData: any, formType: string): void {
    const draftKey = `form_draft_${formType}`;
    localStorage.setItem(draftKey, JSON.stringify({
      data: formData,
      timestamp: Date.now()
    }));
  }

  getFormDraft(formType: string): any | null {
    const draftKey = `form_draft_${formType}`;
    const stored = localStorage.getItem(draftKey);
    
    if (!stored) return null;
    
    try {
      const draft = JSON.parse(stored);
      // Expirar drafts después de 24 horas
      if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey);
        return null;
      }
      return draft.data;
    } catch {
      localStorage.removeItem(draftKey);
      return null;
    }
  }

  clearFormDraft(formType: string): void {
    const draftKey = `form_draft_${formType}`;
    localStorage.removeItem(draftKey);
  }
}

// Singleton instance
export const offlineHandler = new OfflineHandler();

// Hook para React
export function useOfflineHandler() {
  const [isOnline, setIsOnline] = useState(offlineHandler.isConnected());
  const [isSyncing, setIsSyncing] = useState(offlineHandler.isSyncing());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleConnectionChange = (event: CustomEvent) => {
      setIsOnline(event.detail.isOnline);
    };

    const updateCounts = async () => {
      const count = await offlineHandler.getPendingBookingsCount();
      setPendingCount(count);
    };

    window.addEventListener('connectionchange', handleConnectionChange as EventListener);
    
    // Actualizar contadores cada minuto
    const interval = setInterval(updateCounts, 60000);
    updateCounts();

    return () => {
      window.removeEventListener('connectionchange', handleConnectionChange as EventListener);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    saveOfflineBooking: offlineHandler.saveOfflineBooking.bind(offlineHandler),
    syncPendingData: offlineHandler.syncPendingData.bind(offlineHandler),
    saveFormDraft: offlineHandler.saveFormDraft.bind(offlineHandler),
    getFormDraft: offlineHandler.getFormDraft.bind(offlineHandler),
    clearFormDraft: offlineHandler.clearFormDraft.bind(offlineHandler)
  };
}
