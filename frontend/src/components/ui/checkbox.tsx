// lapa-casa-hostel/frontend/src/components/ui/card.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Card Component - Lapa Casa Hostel
 * 
 * Flexible card container with header, body, and footer sections.
 * Optimized for room cards, booking summaries, and pricing displays.
 * 
 * @component
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Mixto 12A</CardTitle>
 *     <CardDescription>12 camas - Quarto compartilhado</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Conteúdo do cartão</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Reservar</Button>
 *   </CardFooter>
 * </Card>
 */

const cardVariants = cva(
  'rounded-xl border bg-white transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border-gray-200 shadow-sm',
        elevated: 'border-transparent shadow-lg',
        outlined: 'border-gray-300 shadow-none',
        interactive: 'border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultV
