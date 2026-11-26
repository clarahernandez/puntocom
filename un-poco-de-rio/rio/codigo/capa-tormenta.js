// Capa "tormenta": lo que la tormenta le hace a todo lo que hay debajo, sea cual sea.
//   - el cielo se cierra: la imagen se oscurece (estado.nublado)
//   - cae lluvia: rayitas que bajan inclinadas por el viento (estado.lluvia)
//   - un rayo ilumina todo con un destello (Rayo.brillo, rayo.js)
//
// La tormenta en sí (la secuencia, el viento, la lluvia y los rayos) sigue en tormenta.js y
// rayo.js, y el agua responde en cada capa de río: más agitada, con los anillos de las gotas
// y sin luz directa del sol. Esta capa solo se dibuja cuando hay algo de eso: en calma no cuesta nada.

const RAYAS_DEFECTO = {
  oscuridad: 0.7,    // cuánto se oscurece la imagen con el cielo cerrado del todo
  rayas: 1,          // cuánta lluvia se dibuja (1 = normal, 0 = nada)
};

const rayasDeLluvia = [];   // { x, y, v (px/s), largo (px) }

function iniciarCapaTormenta() {
  for (const k of Object.keys(RAYAS_DEFECTO)) {
    if (CONFIG.tormenta[k] === undefined) CONFIG.tormenta[k] = RAYAS_DEFECTO[k];
  }
}

function nuevaRaya(desdeArriba) {
  return {
    x: random(-0.1 * width, 1.3 * width),
    y: desdeArriba ? random(-0.2 * height, 0) : random(-0.2 * height, height),
    v: random(0.9, 1.7) * height,
    largo: random(0.03, 0.07) * height,
  };
}

// Las rayitas caen en diagonal, empujadas por el viento. Cuantas más con más lluvia (al cuadrado:
// al empezar caen pocas y con la lluvia fuerte, muchas).
function dibujarLluvia(c, dt) {
  const n = Math.round(CONFIG.tormenta.rayas * 800 * estado.lluvia * estado.lluvia);
  while (rayasDeLluvia.length < n) rayasDeLluvia.push(nuevaRaya(false));
  rayasDeLluvia.length = Math.min(rayasDeLluvia.length, n);
  if (n === 0) return;

  const inclinacion = 0.16;
  c.lineWidth = Math.max(1, width / 1500);
  c.lineCap = 'round';
  c.strokeStyle = `rgba(205, 220, 240, ${0.28 * Math.min(1, 0.4 + estado.lluvia)})`;
  c.beginPath();
  for (const r of rayasDeLluvia) {
    r.y += r.v * dt;
    r.x -= r.v * inclinacion * dt;
    if (r.y - r.largo > height || r.x < -0.3 * width) Object.assign(r, nuevaRaya(true));
    c.moveTo(r.x, r.y);
    c.lineTo(r.x + r.largo * inclinacion, r.y - r.largo);
  }
  c.stroke();
}

function dibujarCapaTormenta({ dt }) {
  const T = CONFIG.tormenta, c = drawingContext;
  c.save();
  recortarDomo();

  // El cielo se cierra
  const oscuro = T.oscuridad * estado.nublado;
  if (oscuro > 0.003) {
    c.fillStyle = `rgba(8, 12, 20, ${oscuro})`;
    c.fillRect(0, 0, width, height);
  }

  dibujarLluvia(c, dt);

  // El rayo ilumina todo
  const rayo = constrain(Rayo.brillo, 0, 1);
  if (rayo > 0.003) {
    c.fillStyle = `rgba(215, 228, 255, ${rayo * 0.9})`;
    c.fillRect(0, 0, width, height);
  }
  c.restore();
}

registrarCapa({
  id: 'tormenta',
  nombre: 'tormenta (cielo cerrado, lluvia y rayos)',
  tipo: 'dibujo',
  defecto: { opacidad: 1, mezcla: 'normal' },
  iniciar: iniciarCapaTormenta,
  // En calma no hay nada que dibujar
  visible: () => estado.nublado > 0.005 || estado.lluvia > 0.005 || Rayo.brillo > 0.005,
  dibujar: dibujarCapaTormenta,
  panel: (g) => {
    g.add(CONFIG.tormenta, 'oscuridad', 0, 1, 0.01).name('cuánto oscurece el cielo cerrado');
    g.add(CONFIG.tormenta, 'rayas', 0, 2, 0.05).name('rayitas de lluvia (cantidad)');
  },
});
