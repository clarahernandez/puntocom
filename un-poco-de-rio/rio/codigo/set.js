// Sets en loop: una escena que se toca sola, sin panel ni guía, y se repite para siempre.
//
//   index.html?set=rioReal    el río realista (la playa)
//   index.html?set=rioMarron  el río abstracto (las cáusticas)
//   index.html?set=sauces     los sauces, con los pájaros conversando
//   index.html?set=puente     el puente
//
// Cada set dura lo mismo que un día de la obra (CONFIG.duracion + CONFIG.pausa) y en cada vuelta
// pasa lo mismo, en el mismo orden: es un loop cerrado. Lo que se prende durante la vuelta se
// apaga antes de que termine, así la vuelta siguiente arranca igual que la primera.
//
// Para cambiar qué pasa y cuándo: la lista "eventos" de cada set ([segundo, qué hace]).
// "continuo(u)" se llama en cada cuadro con u = cuánto va de la vuelta (0 a 1).

const SET = new URLSearchParams(location.search).get('set');

// Una ola suave que sale de 0, llega a 1 en el medio de la vuelta y vuelve a 0 (cierra el loop)
const olaDeLaVuelta = (u) => (1 - Math.cos(2 * Math.PI * u)) / 2;

const SETS = {
  rioReal: {
    nombre: 'el río',
    inicio() {
      capasDesdeUrl('rioReal');
      CONFIG.capas.flotantes.opacidad = 1;
      CONFIG.musica.rio.canta = true;
    },
    continuo(u) { CONFIG.oleaje.revuelo = 0.3 * olaDeLaVuelta(u); },
    eventos: [
      [20, () => largarGarzas()],
      [65, () => largarKayaks()],
      [105, () => tocarBocina()],
      [140, () => largarGarzas()],
    ],
  },

  rioMarron: {
    nombre: 'el río por dentro',
    inicio() {
      capasDesdeUrl('rioMarron');
      CONFIG.capas.flotantes.opacidad = 1;
      CONFIG.musica.rio.canta = true;
    },
    continuo(u) { CONFIG.oleaje.revuelo = 0.6 * olaDeLaVuelta(u); },
    eventos: [
      [12, () => largarCamalotes()],
      [55, () => largarGarzas()],
      [95, () => largarCamalotes()],
      [130, () => tocarBocina()],
      [150, () => largarGarzas()],
    ],
  },

  sauces: {
    nombre: 'los sauces',
    inicio() {
      capasDesdeUrl('sauces');
      CONFIG.musica.pajaros.conversacion = true;
      setPajaros(['benteveo', 'hornero']);
    },
    // Charlan más en el medio de la vuelta
    continuo(u) { CONFIG.musica.pajaros.charla = 0.3 + 0.4 * olaDeLaVuelta(u); },
    // Los pájaros que conversan van cambiando; al final quedan los mismos dos del principio
    eventos: [
      [20, () => setPajaros(['benteveo', 'hornero', 'cardenal'])],
      [45, () => setPajaros(['benteveo', 'hornero', 'cardenal', 'zorzal colorado'])],
      [80, () => setPajaros(['benteveo', 'cardenal', 'zorzal colorado', 'chiflón'])],
      [110, () => setPajaros(['cardenal', 'zorzal colorado', 'chiflón', 'martín pescador chico'])],
      [140, () => setPajaros(['benteveo', 'chiflón', 'martín pescador chico'])],
      [170, () => setPajaros(['benteveo', 'hornero'])],
    ],
  },

  puente: {
    nombre: 'el puente',
    inicio() {
      escenaPuente(true);
      Object.assign(CONFIG.puente, { tono: 330, alturaCamara: 1.8, bpm: 0 });
      CONFIG.musica.pulso.activo = false;
    },
    // El cielo va del atardecer a la noche y vuelve (en vez de seguir el día entero)
    continuo(u) { estado.diaFijo = 0.72 + 0.1 * olaDeLaVuelta(u); },
    eventos: [
      [15, () => destellarPuente()],
      [30, () => pasajePuente('tono', 0)],             // dorado
      [45, () => { CONFIG.puente.bpm = 84; CONFIG.musica.pulso.activo = true; }],
      [70, () => pasajePuente('alturaCamara', 2)],     // la cámara sube
      [95, () => pasajePuente('tono', 2)],             // cian
      [115, () => pasajePuente('alturaCamara', 1)],    // vuelve a bajar
      [130, () => { CONFIG.puente.bpm = 0; CONFIG.musica.pulso.activo = false; }],
      [140, () => destellarPuente()],
      [150, () => pasajePuente('tono', 1)],             // rosa, como al principio
      [175, () => destellarPuente()],
    ],
  },
};

const SetLoop = { def: null, t: 0, pajaros: null, revisar: 0 };

// Qué pájaros tienen que estar conversando (se acomodan en actualizarSet, cuando el sonido ya anda)
function setPajaros(nombres) {
  SetLoop.pajaros = nombres;
  SetLoop.revisar = 0;
}

function acomodarPajaros() {
  if (!SetLoop.pajaros || typeof Sonido === 'undefined' || !Sonido.activo) return;
  for (const c of Sonido.capas) {
    if (c.grupo !== 'pájaros') continue;
    if (c.encendido !== SetLoop.pajaros.includes(c.nombre)) alternarSonido(c);
  }
}

// La llama setup() (sketch.js) al final, con todo ya armado
function iniciarSet() {
  const def = SETS[SET];
  if (!def) return;
  SetLoop.def = def;
  document.body.classList.add('modo-set');
  document.title = 'un poco de río · ' + def.nombre;
  if (panel) panel.hide();
  guiaKorgMostrar(false);
  setEstilos();
  setPantalla(def);
  empezarVuelta();
}

function empezarVuelta() {
  SetLoop.t = 0;
  irAlMomento(0);
  SetLoop.def.inicio();
}

// La llama draw() en cada cuadro
function actualizarSet(dt) {
  const def = SetLoop.def;
  if (!def) return;
  const L = duracionLoop();
  const antes = SetLoop.t;
  SetLoop.t += dt;
  if (SetLoop.t >= L) { empezarVuelta(); return; }
  for (const [seg, hacer] of def.eventos) if (antes < seg && seg <= SetLoop.t) hacer();
  if (def.continuo) def.continuo(SetLoop.t / L);
  SetLoop.revisar -= dt;
  if (SetLoop.revisar <= 0) { acomodarPajaros(); SetLoop.revisar = 1; }
}

// La entrada (un clic para que el navegador deje sonar) y la vuelta al índice
function setPantalla(def) {
  const entrada = document.createElement('div');
  entrada.className = 'set-entrada';
  entrada.innerHTML = `<div><b>${def.nombre}</b><span>tocá para entrar · con sonido</span></div>`;
  document.body.appendChild(entrada);
  entrada.addEventListener('pointerdown', () => {
    entrada.classList.add('fuera');
    setTimeout(() => entrada.remove(), 1200);
  });

  const volver = document.createElement('a');
  volver.className = 'set-volver';
  volver.href = '../';
  volver.textContent = '← volver';
  document.body.appendChild(volver);
  // El mouse y la flecha para volver aparecen solo al moverlo
  let quieto;
  window.addEventListener('pointermove', () => {
    document.body.classList.add('set-mueve');
    clearTimeout(quieto);
    quieto = setTimeout(() => document.body.classList.remove('set-mueve'), 2000);
  });
}

function setEstilos() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    body.modo-set, body.modo-set canvas { cursor: none; }
    body.modo-set.set-mueve, body.modo-set.set-mueve canvas { cursor: default; }
    body.modo-set .lil-gui.root, body.modo-set .guia-korg, body.modo-set .aviso { display: none !important; }
    .set-entrada { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center;
      justify-content: center; background: rgba(0, 0, 0, 0.7); cursor: pointer;
      font: 16px/1.7 "Ubuntu Mono", Consolas, monospace; color: #e5e5e5; text-align: center;
      transition: opacity 1.2s; }
    .set-entrada b { display: block; font-weight: 400; }
    .set-entrada span { color: #737373; font-size: 14px; }
    .set-entrada.fuera { opacity: 0; pointer-events: none; }
    .set-volver { position: fixed; left: 16px; top: 12px; z-index: 10; opacity: 0;
      font: 14px "Ubuntu Mono", Consolas, monospace; color: #737373; text-decoration: none;
      transition: opacity 0.6s, color 0.3s; }
    .set-mueve .set-volver { opacity: 1; }
    .set-volver:hover { color: #e5e5e5; }
  `;
  document.head.appendChild(estilo);
}
