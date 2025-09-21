// lapa-casa-hostel-frontend/src/app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Home, Search, MapPin, Phone } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="p-8 text-center space-y-8">
          <div className="space-y-4">
            <div className="text-6xl font-bold text-primary">404</div>
            <h1 className="text-2xl font-semibold text-foreground">
              Página não encontrada
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              A página que você está procurando não existe ou foi removida. 
              Que tal explorar nossas outras opções?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/pt">
              <Button variant="default" className="w-full h-auto p-4">
                <div className="flex flex-col items-center space-y-2">
                  <Home className="w-6 h-6" />
                  <span className="font-medium">Página Inicial</span>
                  <span className="text-xs opacity-80">Voltar ao início</span>
                </div>
              </Button>
            </Link>

            <Link href="/pt/booking">
              <Button variant="outline" className="w-full h-auto p-4">
                <div className="flex flex-col items-center space-y-2">
                  <Search className="w-6 h-6" />
                  <span className="font-medium">Fazer Reserva</span>
                  <span className="text-xs opacity-80">Buscar quartos</span>
                </div>
              </Button>
            </Link>

            <Link href="/pt/rooms">
              <Button variant="outline" className="w-full h-auto p-4">
                <div className="flex flex-col items-center space-y-2">
                  <MapPin className="w-6 h-6" />
                  <span className="font-medium">Nossos Quartos</span>
                  <span className="text-xs opacity-80">Ver acomodações</span>
                </div>
              </Button>
            </Link>

            <Button 
              variant="outline" 
              className="w-full h-auto p-4"
              onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
            >
              <div className="flex flex-col items-center space-y-2">
                <Phone className="w-6 h-6" />
                <span className="font-medium">Contato</span>
                <span className="text-xs opacity-80">Fale conosco</span>
              </div>
            </Button>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Páginas populares:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Link 
                href="/pt" 
                className="text-primary hover:underline"
              >
                Início
              </Link>
              <Link 
                href="/pt/booking" 
                className="text-primary hover:underline"
              >
                Reservas
              </Link>
              <Link 
                href="/pt/rooms" 
                className="text-primary hover:underline"
              >
                Quartos
              </Link>
              <Link 
                href="/pt/about" 
                className="text-primary hover:underline"
              >
                Sobre nós
              </Link>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 space-y-3">
            <h3 className="font-semibold text-foreground">
              Lapa Casa Hostel
            </h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>📍 Rua Silvio Romero 22, Santa Teresa</p>
              <p>📞 +55 21 9999-9999</p>
              <p>✉️ reservas@lapacasahostel.com</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Especialistas em hospedagem para grupos no coração do Rio de Janeiro
            </p>
          </div>

          <div className="flex justify-center space-x-4 text-sm">
            <Link 
              href="/pt" 
              className="text-primary hover:underline"
            >
              Português
            </Link>
            <Link 
              href="/en" 
              className="text-primary hover:underline"
            >
              English
            </Link>
            <Link 
              href="/es" 
              className="text-primary hover:underline"
            >
              Español
            </Link>
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Se você chegou aqui através de um link, 
            <Link href="/pt" className="text-primary hover:underline ml-1">
              avise-nos
            </Link> 
            {' '}para que possamos corrigir.
          </p>
        </div>
      </div>
    </div>
  );
}
