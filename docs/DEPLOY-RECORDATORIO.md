# Deploy Recordatorio — lapacasario.com

## Stack
- **Frontend**: Vercel (free) — Next.js
- **Backend**: Render Starter $7/mes (sin cold starts)
- **Dominio**: comprar en Namecheap / Cloudflare Registrar / Porkbun (~$9/año)
- **DNS**: apuntar directamente a Vercel y Render (Cloudflare es opcional)

---

## 1 — Comprar el dominio
1. Ir a [Namecheap](https://namecheap.com) o [Porkbun](https://porkbun.com)
2. Buscar `lapacasario.com` y comprarlo (~$9/año)
3. En el panel de DNS del registrador, crear los registros que Vercel y Render te van a dar

---

## 2 — Deploy del Backend en Render

1. Entrar en [render.com](https://render.com) → crear cuenta
2. Conectar el repo GitHub (`gonzalo0909/lapa-casa-hostel`)
3. Crear un **Web Service**, raíz: `backend/`
4. Plan: **Starter ($7/mes)** — evita el sleep de 15 min del plan free
5. Variables de entorno mínimas:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   CORS_ORIGINS=https://lapacasario.com,https://www.lapacasario.com
   NODE_ENV=production
   ```
6. Una vez desplegado, el backend estará en:
   `https://lapa-casa-hostel-api.onrender.com`
7. En Render → Settings → Custom Domain: agregar `api.lapacasario.com` (opcional, para tener URL propia)

---

## 3 — Deploy del Frontend en Vercel

1. Entrar en [vercel.com](https://vercel.com) → crear cuenta con GitHub
2. New Project → importar `gonzalo0909/lapa-casa-hostel`
3. Root Directory: `frontend/`
4. Framework: **Next.js** (autodetectado)
5. Variables de entorno:
   ```
   NEXT_PUBLIC_API_URL=https://lapa-casa-hostel-api.onrender.com/api/v1
   NEXT_PUBLIC_SITE_URL=https://lapacasario.com
   ```
6. Deploy → Vercel te da un dominio `.vercel.app` para probar
7. Settings → Domains → agregar `lapacasario.com` y `www.lapacasario.com`
8. Vercel te muestra los registros DNS a agregar en tu registrador

---

## 4 — DNS (en tu registrador)

Agregar los registros que Vercel te indica, generalmente:
```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

Para el backend (opcional, dominio propio):
```
CNAME   api     your-render-service.onrender.com
```

---

## 5 — Cloudflare (OPCIONAL)

Si querés una capa extra gratuita de CDN y seguridad:
1. Crear cuenta en [cloudflare.com](https://cloudflare.com)
2. Agregar tu dominio → Cloudflare te da sus nameservers
3. En tu registrador, cambiar los nameservers por los de Cloudflare
4. Cloudflare gestiona el DNS en lugar del registrador
5. **No hostea el código** — solo actúa como intermediario/CDN

> Si no querés complicaciones, no usés Cloudflare. Apuntá el DNS directamente desde el registrador a Vercel/Render — funciona perfecto.

---

## 6 — Google Business Profile (cuando el site esté listo)

Crear **dos fichas separadas**:
1. **Lapa Casa Hostel** — con dirección física: Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro
2. **Lapa Casa Apartamentos** — sin dirección fija, seleccionar categoría "Área de servicio" → "Rio de Janeiro"

Así en Google Maps aparecen como negocios independientes con SEO propio.

---

## 7 — Checklist final antes de lanzar

- [ ] Comprar dominio lapacasario.com
- [ ] Deploy backend en Render Starter
- [ ] Deploy frontend en Vercel
- [ ] Configurar DNS
- [ ] Probar formulario de reserva hostel (end-to-end)
- [ ] Probar formulario de reserva apartamentos (end-to-end)
- [ ] Verificar que /apartamentos NO muestra tab de hostel
- [ ] Verificar que emails de confirmación NO incluyen dirección de apartamento en el cuerpo (solo en link seguro)
- [ ] Configurar Google Business Profile (dos fichas)
- [ ] Cargar apartamentos reales en la DB
- [ ] Cargar fotos de apartamentos
