// El panel de ajustes (tecla G), "Copiar ajustes" y los avisos en pantalla.

function crearPanel() {
  panel = new lil.GUI({ title: 'un poco de río' });
  ocultarMouse();
  const A = CONFIG.agua, C = CONFIG.causticas;

  // Las capas: opacidad, mezcla y pasajes de cada visual (capas.js)
  capasPanel(panel);

  // El agua y su oleaje, todo junto. Arriba, el agua entre tranquila y revoltosa
  // (oleaje.js): manda el mayor entre el fader y la tormenta; "ahora" muestra el revuelo
  // real. El viento suena sin tormenta. Después, el dibujo de las olas y, al final, cómo
  // es cada estado del agua.
  const O = CONFIG.oleaje;
  const fO = panel.addFolder('Agua y oleaje');
  fO.add(O, 'revuelo', 0, 1, 0.01).name('tranquila ↔ revoltosa');
  fO.add(estado, 'revuelo', 0, 1).name('ahora (con la tormenta)').listen().disable();
  fO.add(O, 'viento', 0, 1, 0.01).name('viento (sin tormenta)');
  fO.add(A, 'corriente', 0, 1, 0.01).name('olas avanzan');
  fO.add(A, 'escala', 0.3, 3, 0.01).name('escala general (más = más chicas)');
  fO.add(A, 'apertura', 0, 180, 1).name('apertura (°)');
  fO.add(A, 'rafagasPorLoop', 0, 12, 1).name('ráfagas por loop');
  fO.add(A, 'semilla', 1, 999, 1).onChange(generarOndas);
  for (const [nombre, e] of [['tranquila', O.tranquila], ['revoltosa', O.revoltosa]]) {
    const f = fO.addFolder(nombre);
    f.add(e, 'agitacion', 0, 4, 0.01).name('agitación');
    f.add(e, 'altura', 0.2, 3, 0.01).name('altura de las olas');
    f.add(e, 'velocidad', 0, 4, 0.05).name('velocidad');
    f.add(e, 'rafagas', 0, 0.9, 0.01).name('ráfagas de viento');
    f.add(e, 'profundidad', 0, 2, 0.01).name('profundidad (valles oscuros)');
    f.close();
  }

  const fT = panel.addFolder('Tiempo');
  fT.add(CONFIG, 'duracion', 5, 600, 1).name('duración del día (s)');
  fT.add(CONFIG, 'pausa', 0, 60, 0.5).name('pausa sin luz (s)');
  fT.add(estado, 'pausa').name('pausa').listen();
  fT.add(estado, 'progreso', 0, 1, 0.001).name('momento del día').listen()
    .onChange((v) => { estado.pausa = true; irAlMomento(v); });
  fT.add(estado, 'momento').name('ahora').listen().disable();

  const fEst = panel.addFolder('Estilo');
  fEst.add(CONFIG.estilo, 'organico', 0, 2, 0.01).name('orgánico');
  fEst.add(C, 'capas', 0, 10, 1).name('capas de tono, cáusticas');
  fEst.add(CONFIG.estilo, 'borde', 0.01, 0.5, 0.01).name('borde suave');
  // Sube brillo y contraste de toda la imagen junta (en el Korg: perilla 8)
  if (CONFIG.estilo.realce === undefined) CONFIG.estilo.realce = 0;
  fEst.add(CONFIG.estilo, 'realce', 0, 1, 0.01).name('más brillo y contraste').onChange(aplicarRealce);
  // Fundido a negro (en el Korg: R8, en todos los modos). No se guarda: la obra siempre arranca prendida
  fEst.add(Pantalla, 'negro').name('fundido a negro').listen();
  aplicarRealce();

  // Todo lo que define cómo se ven las cáusticas, junto (y fácil de mapear al MIDI)
  const fC = panel.addFolder('Cáusticas');
  fC.add(C, 'escala', 0.5, 6, 0.01).name('tamaño (más = más chicas)');
  fC.add(C, 'agitacion', 0, 3, 0.01).name('agitación');
  fC.add(C, 'brillo', 0.1, 3, 0.01);
  fC.add(C, 'contraste', 0.5, 4, 0.01);
  fC.add(A, 'nitidez', 0.5, 3, 0.01);
  fC.add(A, 'dispersion', 0, 0.3, 0.005).name('dispersión (prisma)');
  fC.add(C, 'crestas', 0, 1.5, 0.01).name('crestas que miran a la luz');
  fC.add(C, 'sombra', 0, 1.5, 0.01).name('crestas a la sombra');
  fC.add(C, 'metal', 0, 1, 0.01).name('metalizado');
  fC.add(C, 'cielo', 0, 1, 0.01).name('reflejo del cielo');
  fC.addColor(C, 'fondo').name('color fondo (día)');
  fC.addColor(C, 'fondoNoche').name('color fondo (noche)');
  fC.addColor(C, 'luz').name('color luz');
  fC.add(C, 'ciclo', 0, 1, 0.01).name('color del momento del día');
  fC.addColor(C, 'colorCielo').name('color del cielo');
  fC.close();

  garzasPanel(panel);
  kayaksPanel(panel);
  camalotesPanel(panel);

  const fTor = panel.addFolder('Tormenta');
  fTor.add({ activar: activarTormenta }, 'activar').name('⛈ activar tormenta');
  fTor.add({ calmar: calmarTormenta }, 'calmar').name('☀ calmar tormenta');
  fTor.add(CONFIG.tormenta, 'gotas', 0, 3, 0.05).name('gotas de lluvia (cuánto se ven)');
  fTor.add(CONFIG.tormenta, 'frecuencia', 0, 1500, 10).name('gotas por segundo (lluvia al máximo)');
  fTor.add(CONFIG.tormenta, 'tamanoSuave', 0.5, 8, 0.1).name('tamaño gotas, lluvia suave');
  fTor.add(CONFIG.tormenta, 'tamanoFuerte', 0.5, 8, 0.1).name('tamaño gotas, lluvia fuerte');
  fTor.add(CONFIG.tormenta, 'duracionSuave', 0.95, 0.998, 0.001).name('duración aros, lluvia suave');
  fTor.add(CONFIG.tormenta, 'duracionFuerte', 0.95, 0.998, 0.001).name('duración aros, lluvia fuerte');
  fTor.add(CONFIG.tormenta, 'tamanoAros', 0.2, 1.5, 0.01).name('tamaño de los aros');
  fTor.add(CONFIG.tormenta, 'rayoDesde', 0, 1, 0.01).name('caen rayos desde (tormenta)');
  fTor.add(CONFIG.tormenta, 'rayoBrillo', 0, 3, 0.05).name('luz del rayo');
  fTor.add({ rayo: () => lanzarRayo() }, 'rayo').name('⚡ lanzar rayo');
  fTor.close();

  if (DOMO) {
    const fD = panel.addFolder('Domo');
    fD.add(CONFIG.domo, 'velocidad', 0.1, 1, 0.01).name('velocidad (× la del agua)');
  }

  const fM = panel.addFolder('Momentos del día');
  for (const m of CONFIG.momentos) {
    const f = fM.addFolder(m.nombre);
    f.add(m, 'pos', 0, 0.999, 0.001).name('posición');
    f.addColor(m, 'luz').name('luz (sol / luna)');
    f.add(m, 'metal', 0, 1, 0.01).name('metalizado (0 a 1)');
    // Los de la playa (capa río real)
    f.addColor(m, 'cielo').name('cielo (playa)');
    f.addColor(m, 'horizonte').name('horizonte (playa)');
    f.addColor(m, 'islas').name('islas (playa)');
    f.addColor(m, 'agua').name('agua (playa)');
    f.add(m, 'intensidad', 0, 3, 0.01).name('intensidad de la luz (playa)');
    f.close();
  }
  fM.close();

  panel.add({ copiar: copiarAjustes }, 'copiar').name('Copiar ajustes');
  panel.add({ completa: () => fullscreen(!fullscreen()) }, 'completa').name('Pantalla completa (F)');

  sonidoPanel(panel);
  musicaPanel(panel);
  iniciarMidi(panel);
}

// Realce (0 a 1): en 0 la imagen queda como sale; en 1, +60 % de brillo y +80 % de contraste.
// Es un filtro del navegador sobre el lienzo (casi no cuesta) y OBS lo captura tal cual.
// No mueve ni cambia el tamaño del domo.
// Fundido a negro: la imagen se apaga (o se prende) de a poco, en unos 2 segundos
const Pantalla = { negro: false, nivel: 0 };

function actualizarNegro(dt) {
  Pantalla.nivel += ((Pantalla.negro ? 1 : 0) - Pantalla.nivel) * (1 - Math.exp(-dt / 0.7));
  if (Pantalla.nivel < 0.002) return;
  const c = drawingContext;
  c.save();
  c.globalAlpha = Math.min(1, Pantalla.nivel * 1.01);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000';
  c.fillRect(0, 0, width, height);
  c.restore();
}

function aplicarRealce() {
  const r = CONFIG.estilo.realce || 0;
  drawingContext.canvas.style.filter = r > 0
    ? `brightness(${(1 + 0.6 * r).toFixed(3)}) contrast(${(1 + 0.8 * r).toFixed(3)})`
    : '';
}

function togglePanel() {
  panel.show(panel._hidden);
  // La guía del Korg va y viene con el panel; en el modo OBS no (está fuera de lo que sale por OBS)
  if (!(DOMO && OBS)) guiaKorgMostrar(!panel._hidden);
}

// El mouse no se ve sobre la imagen: en el domo, solo dentro del círculo; en lo negro de
// afuera, el panel y la guía del Korg se ve. Sin domo la imagen ocupa toda la ventana, así que
// ahí solo aparece sobre el panel y la guía.
function ocultarMouse() {
  const s = document.createElement('style');
  s.textContent = `
    body.mouse-sobre-imagen, body.mouse-sobre-imagen canvas { cursor: none !important; }
  `;
  document.head.appendChild(s);
  document.addEventListener('mousemove', (e) => {
    let sobre = e.target.tagName === 'CANVAS';
    if (sobre && DOMO) {
      const r = e.target.getBoundingClientRect();
      // Un margen un poco más allá del borde del círculo (5 % del radio): ahí ya se esconde
      sobre = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < (r.width / 2) * 1.05;
    }
    document.body.classList.toggle('mouse-sobre-imagen', sobre);
  });
}

function copiarAjustes() {
  const texto = '// Ajustes de la obra (copiados desde el panel).\n\nconst CONFIG = ' +
    JSON.stringify(CONFIG, null, 2) + ';\n';
  console.log(texto);
  navigator.clipboard.writeText(texto).then(
    () => aviso('Ajustes copiados: pegalos en config.js'),
    () => aviso('No pude copiar: están en la consola (F12)')
  );
}

function aviso(texto) {
  const div = createDiv(texto).class('aviso');
  setTimeout(() => div.remove(), 2500);
}
