// un poco de río — la luz dentro del agua del Paraná, en capas que se superponen.
//
// Teclas:  G panel · F pantalla completa · espacio pausa
// URL:     index.html?t=0.5&pausa&panel=0  (arranca en ese momento del loop)
//          index.html?domo                  (versión planetario: fisheye 2048 × 2048)
//          index.html?capa=rioReal          (arranca con una sola capa: rioReal, rioMarron, flotantes, sauces, puente, tormenta)
//          index.html?capas=rioReal:0.5,rioMarron:1   (arranca con esas opacidades)
//          index.html?escena=puente         (la escena del puente: atardecer fijo, río real y puente)
//          index.html?revuelo=0.7           (agua así de revuelta)
//          index.html?tormenta=30           (tormenta, como si ya llevara 30 s)
//          index.html?garzas                (larga una bandada de garcitas al arrancar)
//          index.html?kayaks                (larga un grupo de kayaks al arrancar)
//          index.html?camalotes             (larga camalotes al arrancar)
//
// Este archivo es lo global: los relojes, la tormenta, el agua y el sonido. Lo que se ve lo
// dibuja cada capa (codigo/capa-*.js) y capas.js las compone.

let agua, shaderAgua, panel;
let ondas;
// reloj: segundos dentro del loop, para las olas. El día entero dura CONFIG.duracion y
// después viene una pausa de CONFIG.pausa segundos: las olas siguen moviéndose pero sin luz.
// dia: lo mismo pero para el sol, la luna y los colores; con tormenta se detiene (tiempo.js).
// progreso: en qué momento del día estamos (0 a 1), sale de dia.
// tormenta: 0 (calma) a 1, qué tan fuerte es; sale de viento y lluvia.
// nublado, viento y lluvia (0 a 1) los mueve la secuencia de tormenta.js. nublado tapa
// el sol y la luna y frena el día.
// revuelo: 0 (tranquila) a 1 (revoltosa); sale del fader y de la tormenta (oleaje.js).
const estado = { diaFijo: null, revuelo: 0, reloj: 0, dia: 0, progreso: 0, pausa: false, momento: '', tormenta: 0, nublado: 0, viento: 0, vientoTormenta: 0, lluvia: 0 };

const DOMO = new URLSearchParams(location.search).has('domo');
// ?obs (con ?domo): el domo se muestra a exactamente 2048 × 2048 píxeles reales, arriba a la
// izquierda, aunque Windows tenga escalado (150 %, etc.). Así OBS captura la ventana y la recorta a
// ese cuadrado, sin perder definición. Si la pantalla es más baja que 2048 px (una notebook de
// 1600), se achica para entrar entero y OBS lo agranda (ver ajustarModoObs).
const OBS = new URLSearchParams(location.search).has('obs');

function ajustarModoObs() {
  if (!DOMO || !OBS) return;
  // En píxeles de la página. Si la pantalla es más baja que 2048 px reales (Windows no deja que la
  // ventana sea más alta que la pantalla), el domo se achica al alto de la ventana para que entre
  // entero, y OBS lo agranda a 2048 (se ve un poco menos nítido, pero sin cortes).
  const lado = Math.min(DOMO_PX / window.devicePixelRatio, window.innerHeight);
  document.documentElement.style.setProperty('--lado-obs', lado + 'px');
  // La parte de la ventana que entra en la pantalla (la ventana es más grande que la pantalla):
  // ahí, a la derecha del domo, van la guía y el panel
  const r = document.documentElement.style;
  r.setProperty('--ancho-visible', Math.max(0, window.screen.availWidth - window.screenX) + 'px');
  r.setProperty('--alto-visible', Math.max(200, window.screen.availHeight - window.screenY - (window.outerHeight - window.innerHeight)) + 'px');
}
const DOMO_PX = 2048;   // diámetro que pide el planetario

function setup() {
  pixelDensity(1);
  if (DOMO) {
    // Tamaño fijo: en pantalla se achica para entrar, pero se dibuja a 2048
    createCanvas(DOMO_PX, DOMO_PX);
    document.body.classList.add('domo');
    if (OBS) {
      document.body.classList.add('obs');
      ajustarModoObs();
      // si cambia el escalado (por ejemplo, al mover la ventana a otra pantalla)
      window.addEventListener('resize', ajustarModoObs);
    }
  } else {
    createCanvas(windowWidth, windowHeight);
  }
  // Un solo lienzo WEBGL para todos los shaders (capas.js): comparten la simulación de gotas
  completarConfigCapas();
  const [aw, ah] = tamanoAgua();
  agua = createGraphics(aw, ah, WEBGL);
  agua.noStroke();
  shaderAgua = agua.createShader(VERT, FRAG);
  iniciarGotas(agua);

  const params = new URLSearchParams(location.search);
  if (params.has('t')) irAlMomento(fract(parseFloat(params.get('t')) || 0));
  if (params.has('pausa')) estado.pausa = true;
  // ?revuelo=0.7 arranca con el agua así de revuelta (0 = tranquila, 1 = revoltosa)
  if (params.has('revuelo')) CONFIG.oleaje.revuelo = constrain(parseFloat(params.get('revuelo')) || 0, 0, 1);
  // ?tormenta arranca la tormenta; ?tormenta=30, como si ya llevara 30 segundos (para ensayar)
  if (params.has('tormenta')) {
    activarTormenta();
    Tormenta.t = parseFloat(params.get('tormenta')) || 0;
  }
  // ?capa=rioReal deja solo esa capa; ?capas=rioReal:0.5,rioMarron:1 fija cada opacidad
  if (params.has('capa')) capasDesdeUrl(params.get('capa'));
  if (params.has('capas')) capasDesdeUrl(params.get('capas'));

  if (params.has('garzas')) largarGarzas();
  if (params.has('kayaks')) largarKayaks();
  if (params.has('camalotes')) largarCamalotes();
  generarOndas();
  iniciarCapas();
  if (params.get('escena') === 'puente') escenaPuente(true);   // capa-puente.js
  iniciarSonido(CAPAS_SONIDO);
  iniciarMusica();   // musica.js: colchón, gotas, pulso, filtro, eco y congelar
  crearPanel();
  if (params.get('panel') === '0') togglePanel();
  // En el modo OBS la guía está fuera de lo que sale por OBS: se ve siempre
  if (DOMO && OBS) guiaKorgMostrar(true);
  crearVolver();          // set.js: botón para volver a la entrada
  if (SET) iniciarSet();   // set.js: ?set=rioReal, rioMarron, sauces o puente (loop sin panel)
}

function draw() {
  // Segundos desde el cuadro anterior (con tope, por si la pestaña estuvo quieta)
  const dt = Math.min(deltaTime, 100) / 1000;
  if (SET) actualizarSet(dt);   // set.js: lo que pasa en la vuelta
  avanzarRelojes(dt);   // tiempo.js: con tormenta el día se detiene, las olas no

  // Cómo está el día: la luz, el sol y la luna (cielo.js)
  const p = (estado.progreso = progresoDe(estado.dia));
  const m = momentoActual(p);
  estado.momento = m.nombre;
  apagarEnLaPausa(m);
  // Con tormenta el sol y la luna se tapan: lo hacen los shaders con uCubierto (estado.nublado)

  // La tormenta sigue su secuencia (tormenta.js): nubla, viento, rayo y lluvia
  actualizarTormenta(estado, dt);

  // El agua entre tranquila y revoltosa (oleaje.js): el fader o la tormenta
  actualizarRevuelo();
  const o = oleajeActual();
  // Las olas avanzan a la velocidad de ahora (tranquila, revoltosa o en el medio)
  if (!estado.pausa) avanzarOndas(o, dt);
  actualizarRayo(estado);
  // Gotas: cuantas más con más lluvia (gotas.js)
  actualizarGotas(agua, dt, estado.lluvia);

  // Agitación: la de las cáusticas por la del oleaje, con las ráfagas de viento a lo largo
  // del loop (siguen el reloj de las olas, no se detienen con la tormenta)
  const pOlas = progresoDe(estado.reloj);
  const rafaga = 1 + o.rafagas * Math.sin(TWO_PI * CONFIG.agua.rafagasPorLoop * pOlas);
  const agitacion = CONFIG.causticas.agitacion * o.agitacion * rafaga;

  // Las capas: los pasajes en curso y después cada una, de abajo hacia arriba (capas.js)
  moverTransiciones(dt);
  componerCapas({ m, o, agitacion, rafaga, dt });
  actualizarNegro(dt);   // panel.js: fundido a negro

  actualizarSonido(estado, m, agitacion);
  actualizarMusica(dt, agitacion);
  medirRendimiento(deltaTime / 1000);   // el tiempo real, sin el tope de dt: si no, con cuadros lentos marcaría de más
}

// En la pausa sin luz se apagan el sol, la luna y las cáusticas
function apagarEnLaPausa(m) {
  const luz = luzDelDia();
  m.solVis *= luz;
  m.lunaVis *= luz;
  m.metal *= luz;
  m.intensidad *= luz;
}

// ---------- Eventos ----------

function keyPressed() {
  if (SET) return;   // en los sets no se toca nada
  if (key === 'g' || key === 'G') togglePanel();
  if (key === 'f' || key === 'F') fullscreen(!fullscreen());
  if (key === 'k' || key === 'K') guiaKorgMostrar(!guiaKorg.visible);   // guía del Korg
  if (key === ' ') estado.pausa = !estado.pausa;
}

function windowResized() {
  if (DOMO) return;   // el domo siempre se dibuja a 2048 × 2048
  resizeCanvas(windowWidth, windowHeight);
  aplicarCalidad();
}
