import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container-lapa flex h-16 items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="hidden md:flex space-x-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="section-padding">
          <div className="container-lapa">
            <div className="mx-auto max-w-4xl text-center space-y-6">
              <Skeleton className="h-12 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-2/3 mx-auto" />
              <Skeleton className="h-12 w-48 mx-auto" />
            </div>
          </div>
        </section>

        {/* Booking Engine Skeleton */}
        <section className="bg-muted/50 section-padding">
          <div className="container-lapa">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Date Selection */}
                <div className="booking-step">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                </div>

                {/* Room Selection */}
                <div className="booking-step">
                  <Skeleton className="h-6 w-40 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <Skeleton className="h-5 w-24 mb-1" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Summary */}
                <div className="booking-step">
                  <Skeleton className="h-6 w-28 mb-4" />
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-12 w-full mt-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rooms Section Skeleton */}
        <section className="section-padding">
          <div className="container-lapa">
            <div className="text-center mb-12">
              <Skeleton className="h-10 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="room-card">
                  <Skeleton className="aspect-photo w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Loading Overlay with Spinner */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner size="lg" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Carregando Lapa Casa Hostel
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Preparando sua experiência de reserva personalizada...
            </p>
          </div>
        </div>
      </div>

      {/* Alternative Loading States */}
      <div className="hidden">
        {/* Minimal Loading */}
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="md" />
        </div>

        {/* Page Transition Loading */}
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1 bg-primary animate-pulse"></div>
        </div>

        {/* Content Loading */}
        <div className="space-y-4 p-6">
          <div className="flex items-center space-x-4">
            <LoadingSpinner size="sm" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

// Loading states específicos para diferentes secciones
export function BookingEngineLoading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="booking-step">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoomListLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="room-card">
          <Skeleton className="aspect-photo w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-3" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaymentLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-muted-foreground">
          Processando pagamento...
        </span>
      </div>
      
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
