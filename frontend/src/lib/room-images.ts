// lapa-casa-hostel/frontend/src/lib/room-images.ts

/**
 * Room image mapping — one Unsplash photo per room type.
 * next.config.js ya tiene images.unsplash.com en la allowlist.
 * Para producción, reemplazar por fotos reales del hostel en Cloudinary.
 */

const BASE = 'https://images.unsplash.com';

export const ROOM_IMAGES: Record<string, string> = {
  // Dormitório misto → camas tipo camarote, ambiente aconchegante
  mixed:
    `${BASE}/photo-1555854877-bab0e564b8d5?w=600&q=75&auto=format&fit=crop`,
  // Dormitório feminino → ambiente mais claro e organizado
  female:
    `${BASE}/photo-1631049307264-da0ec9d70304?w=600&q=75&auto=format&fit=crop`,
  // Masculino → usa mesma imagem que misto
  male:
    `${BASE}/photo-1555854877-bab0e564b8d5?w=600&q=75&auto=format&fit=crop`,
  // Flexível → usa mesma base mas tom diferente
  flexible:
    `${BASE}/photo-1611892440504-42a792e24d32?w=600&q=75&auto=format&fit=crop`,
};

/**
 * Retorna a URL de imagem para um tipo de quarto.
 * Se `isFlexible` for true, sempre usa a imagem "flexible".
 */
export function getRoomImage(type: string, isFlexible: boolean): string {
  if (isFlexible) { return ROOM_IMAGES.flexible!; }
  return ROOM_IMAGES[type] ?? ROOM_IMAGES.mixed!;
}
