router.post('/mp/preference', async (req, res) => {
  try {
    // Admitir payloads con o sin la propiedad 'order'
    const order = req.body.order || req.body;
    if (!order) {
      return res.status(400).json({ error: 'invalid_payload', detail: 'No se recibió un objeto de pedido' });
    }

    const preference = {
      items: [{
        title: 'Reserva Lapa Casa Hostel',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(order.total || 0)
      }],
      payer: {
        email: order.email
      },
      metadata: {
        bookingId: order.bookingId
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}?paid=1`,
        failure: `${process.env.FRONTEND_URL}?paid=0`
      },
      auto_return: 'approved'
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      throw new Error(`MP API error: ${mpRes.status} ${errorBody}`);
    }

    const mpJson = await mpRes.json();
    return res.json({ init_point: mpJson.init_point });
  } catch (e) {
    console.error('MP error:', e);
    return res.status(500).json({ error: 'mp_error', detail: String(e) });
  }
});
