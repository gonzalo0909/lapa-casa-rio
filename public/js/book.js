document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {
        entrada: form.entrada.value,
        salida: form.salida.value,
        nombre: form.nombre.value,
        email: form.email.value,
      };

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const json = await res.json();
        if (json.ok) {
          alert("✅ Reserva registrada correctamente!");
          form.reset();
        } else {
          alert("⚠️ Error: " + (json.error || "No se pudo procesar"));
        }
      } catch (err) {
        console.error(err);
        alert("❌ Error al conectar con el servidor");
      }
    });
  }
});
