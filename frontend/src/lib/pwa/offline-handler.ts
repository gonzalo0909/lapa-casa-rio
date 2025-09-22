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
