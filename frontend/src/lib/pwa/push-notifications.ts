// src/lib/pwa/push-notifications.ts

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  tag?: string;
  actions?: NotificationAction[];
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_KEY || '';

  constructor() {
    this.initializeServiceWorker();
  }

  private async initializeServiceWorker(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('🚫 Service Workers no soportados');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado:', this.registration.scope);
      
      // Escuchar actualizaciones del SW
      this.registration.addEventListener('updatefound', () => {
        console.log('🔄 Nueva versión del Service Worker disponible');
        this.handleServiceWorkerUpdate();
      });
    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  }

  // Solicitar permisos de notificación
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('🚫 Notificaciones no soportadas');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      console.log('✅ Permisos de notificación ya concedidos');
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.log('🚫 Permisos de notificación denegados');
      return 'denied';
    }

    // Solicitar permisos
    const permission = await Notification.requestPermission();
    console.log('📱 Resultado permiso notificaciones:', permission);
    
    if (permission === 'granted') {
      await this.subscribeToPush();
    }

    return permission;
  }

  // Suscribirse a push notifications
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !this.vapidPublicKey) {
      console.error('❌ Service Worker o VAPID key no disponible');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      console.log('✅ Suscripción push creada:', subscription);
      
      // Enviar suscripción al servidor
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('❌ Error creando suscripción push:', error);
      return null;
    }
  }

  // Enviar suscripción al servidor
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('✅ Suscripción enviada al servidor');
        localStorage.setItem('pushSubscribed', 'true');
      } else {
        console.error('❌ Error enviando suscripción al servidor');
      }
    } catch (error) {
      console.error('❌ Error comunicando con servidor:', error);
    }
  }

  // Mostrar notificación local
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (Notification.permission !== 'granted') {
      console.log('🚫 Sin permisos para mostrar notificación');
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/badge-72.png',
      image: payload.image,
      data: payload.data,
      tag: payload.tag || 'lapa-casa-notification',
      actions: payload.actions,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      silent: false
    };

    try {
      if (this.registration && this.registration.active) {
        // Usar service worker para notificación persistente
        await this.registration.showNotification(payload.title, options);
      } else {
        // Fallback a notificación directa
        new Notification(payload.title, options);
      }
      console.log('✅ Notificación mostrada:', payload.title);
    } catch (error) {
      console.error('❌ Error mostrando notificación:', error);
    }
  }

  // Notificaciones específicas del negocio
  
  async notifyBookingConfirmed(bookingData: any): Promise<void> {
    await this.showLocalNotification({
      title: '✅ Reserva Confirmada',
      body: `Tu reserva para ${bookingData.checkIn} ha sido confirmada`,
      icon: '/icons/booking-confirmed.png',
      tag: 'booking-confirmed',
      data: { 
        type: 'booking_confirmed',
        bookingId: bookingData.id,
        url: `/reservas/${bookingData.id}`
      },
      actions: [
        {
          action: 'view',
          title: 'Ver Reserva'
        },
        {
          action: 'share',
          title: 'Compartir'
        }
      ]
    });
  }

  async notifyPaymentReminder(bookingData: any): Promise<void> {
    await this.showLocalNotification({
      title: '💰 Recordatorio de Pago',
      body: `Saldo pendiente: R$ ${bookingData.remainingAmount}. Vence en 7 días`,
      icon: '/icons/payment-reminder.png',
      tag: 'payment-reminder',
      data: { 
        type: 'payment_reminder',
        bookingId: bookingData.id,
        amount: bookingData.remainingAmount,
        url: `/pagos/${bookingData.id}`
      },
      actions: [
        {
          action: 'pay',
          title: 'Pagar Ahora'
        },
        {
          action: 'later',
          title: 'Más Tarde'
        }
      ]
    });
  }

  async notifyCheckInReminder(bookingData: any): Promise<void> {
    await this.showLocalNotification({
      title: '🏨 Check-in Mañana',
      body: `Te esperamos en Lapa Casa Hostel a partir de las 14:00`,
      icon: '/icons/checkin-reminder.png',
      tag: 'checkin-reminder',
      data: { 
        type: 'checkin_reminder',
        bookingId: bookingData.id,
        url: `/check-in/${bookingData.id}`
      },
      actions: [
        {
          action: 'directions',
          title: 'Cómo Llegar'
        },
        {
          action: 'contact',
          title: 'Contactar'
        }
      ]
    });
  }

  async notifySpecialOffer(offerData: any): Promise<void> {
    await this.showLocalNotification({
      title: '🎉 Oferta Especial',
      body: `${offerData.discount}% descuento en reservas de grupos`,
      icon: '/icons/special-offer.png',
      tag: 'special-offer',
      data: { 
        type: 'special_offer',
        offerId: offerData.id,
        discount: offerData.discount,
        url: `/ofertas/${offerData.id}`
      },
      actions: [
        {
          action: 'book',
          title: 'Reservar'
        },
        {
          action: 'details',
          title: 'Ver Detalles'
        }
      ]
    });
  }

  // Gestión de suscripciones

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) return null;
    
    try {
      return await this.registration.pushManager.getSubscription();
    } catch (error) {
      console.error('❌ Error obteniendo suscripción:', error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription();
    if (!subscription) return false;

    try {
      const unsubscribed = await subscription.unsubscribe();
      if (unsubscribed) {
        await this.removeSubscriptionFromServer(subscription);
        localStorage.removeItem('pushSubscribed');
        console.log('✅ Desuscripción completada');
      }
      return unsubscribed;
    } catch (error) {
      console.error('❌ Error desuscribiendo:', error);
      return false;
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription })
      });
    } catch (error) {
      console.error('❌ Error removiendo suscripción del servidor:', error);
    }
  }

  // Utilidades

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private handleServiceWorkerUpdate(): void {
    if (this.registration?.waiting) {
      // Notificar al usuario que hay una actualización disponible
      this.showLocalNotification({
        title: '🔄 Actualización Disponible',
        body: 'Nueva versión de la app disponible. Toca para actualizar.',
        tag: 'app-update',
        data: { type: 'app_update' },
        actions: [
          {
            action: 'update',
            title: 'Actualizar'
          },
          {
            action: 'later',
            title: 'Más Tarde'
          }
        ]
      });
    }
  }

  // Estado de la aplicación
  
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  isPushSubscribed(): boolean {
    return localStorage.getItem('pushSubscribed') === 'true';
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }
}

// Singleton instance
export const pushNotificationManager = new PushNotificationManager();

// Hook para React
export function usePushNotifications() {
  const [isSupported] = useState(() => pushNotificationManager.isSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    pushNotificationManager.getPermissionStatus()
  );
  const [isSubscribed, setIsSubscribed] = useState(() => 
    pushNotificationManager.isPushSubscribed()
  );

  const requestPermission = async () => {
    const newPermission = await pushNotificationManager.requestPermission();
    setPermission(newPermission);
    setIsSubscribed(newPermission === 'granted');
  };

  const unsubscribe = async () => {
    const success = await pushNotificationManager.unsubscribe();
    if (success) {
      setIsSubscribed(false);
    }
    return success;
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    unsubscribe,
    showNotification: pushNotificationManager.showLocalNotification.bind(pushNotificationManager),
    notifyBookingConfirmed: pushNotificationManager.notifyBookingConfirmed.bind(pushNotificationManager),
    notifyPaymentReminder: pushNotificationManager.notifyPaymentReminder.bind(pushNotificationManager),
    notifyCheckInReminder: pushNotificationManager.notifyCheckInReminder.bind(pushNotificationManager),
    notifySpecialOffer: pushNotificationManager.notifySpecialOffer.bind(pushNotificationManager)
  };
}
