import { Router } from 'express';
import availabilityRoutes from './routes/availability';
import bookingsRoutes from './routes/bookings';
import holdsRoutes from './routes/holds';
import adminRoutes from './routes/admin';

const router = Router();

// Rutas públicas
router.use('/availability', availabilityRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/holds', holdsRoutes);

// Rutas administrativas (requieren autenticación)
router.use('/admin', adminRoutes);

// Ruta raíz de la API
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'Lapa Casa Hostel API v1.0',
    version: '1.0.0',
    endpoints: {
      public: [
        'GET /api/availability',
        'POST /api/availability/check-group',
        'POST /api/bookings',
        'GET /api/bookings/:id',
        'POST /api/holds',
        'GET /api/holds/:id',
      ],
      admin: [
        'GET /api/admin/health',
        'GET /api/admin/dashboard',
        'GET /api/admin/bookings',
        'GET /api/admin/holds',
        'GET /api/admin/occupancy',
      ],
    },
  });
});

export default router;
