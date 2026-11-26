// Ajustes de la obra (copiados desde el panel).

const CONFIG = {
  "duracion": 181,
  "pausa": 8,
  "estilo": {
    "organico": 0.6,
    "borde": 0.06
  },
  "agua": {
    "corriente": 0.09,
    "escala": 2.2,
    "rumbo": 90,
    "apertura": 51,
    "nitidez": 3,
    "dispersion": 0.185,
    "rafagasPorLoop": 11,
    "semilla": 1
  },
  "causticas": {
    "escala": 1.73,
    "agitacion": 3,
    "brillo": 0.1,
    "contraste": 2.99,
    "capas": 5,
    "fondo": "#784421",
    "fondoNoche": "#2a1608",
    "crestas": 0.4,
    "sombra": 0,
    "metal": 0.37,
    "cielo": 0.37,
    "colorCielo": "#3e8090",
    "luz": "#fff3dd",
    "ciclo": 1
  },
  "oleaje": {
    "revuelo": 0,
    "viento": 0,
    "tranquila": {
      "agitacion": 1,
      "altura": 1,
      "velocidad": 1,
      "rafagas": 0.35,
      "profundidad": 0.15
    },
    "revoltosa": {
      "agitacion": 2.5,
      "altura": 1.8,
      "velocidad": 2,
      "rafagas": 0.7,
      "profundidad": 0.8
    }
  },
  "domo": {
    "velocidad": 0.33
  },
  "tormenta": {
    "secuencia": {
      "nublado": [
        [
          0,
          0
        ],
        [
          10,
          1
        ]
      ],
      "viento": [
        [
          3,
          0
        ],
        [
          15,
          0.6
        ],
        [
          40,
          1
        ]
      ],
      "rayoEn": 8,
      "rayoDistancia": 0.4,
      "lluvia": [
        [
          13,
          0
        ],
        [
          22,
          0.45
        ],
        [
          45,
          1
        ]
      ]
    },
    "calma": 12,
    "rayoDesde": 0.5,
    "rayoCada": [
      6,
      20
    ],
    "rayoBrillo": 0.6,
    "gotas": 1,
    "frecuencia": 150,
    "tamanoSuave": 1.5,
    "tamanoFuerte": 4,
    "duracionSuave": 0.99,
    "duracionFuerte": 0.965,
    "tamanoAros": 0.6,
    "truenoRetraso": [
      0.4,
      3.5
    ]
  },
  "sonido": {
    "maestro": 0.41732283464566927,
    "silencio": false,
    "volumenes": {
      "agua": 0.2440944881889764,
      "pajaros": 0,
      "benteveo": 0.8,
      "mate": 0.26,
      "lluvia": 1,
      "viento": 0,
      "trueno": 0,
      "hornero": 0.8,
      "cardenal": 0.8,
      "zorzal colorado": 0.8,
      "zorzal chalchalero": 0.8,
      "loro barranquero": 0.8,
      "martín pescador chico": 0.8,
      "chiflón": 0.8,
      "garza mora": 0.8,
      "garza blanca": 0.8,
      "garcita blanca": 0.8,
      "jacana": 0.8,
      "gallineta": 0.8,
      "carancho": 0.8,
      "chimango": 0.8
    }
  },
  "garzas": {
    "solas": false,
    "cada": [60, 180],
    "modo": "blancas",
    "cantidad": 5,
    "tamano": 28,
    "velocidad": 0.06,
    "opacidad": 0.85,
    "sonido": false
  },
  "kayaks": {
    "solos": false,
    "cada": [90, 240],
    "modo": "colores",
    "cantidad": 12,
    "tamano": 34,
    "velocidad": 0.035,
    "opacidad": 0.95,
    "estela": 0.35
  },
  "camalotes": {
    "solos": false,
    "cada": [120, 300],
    "modo": "colores",
    "cantidad": 4,
    "tamano": 70,
    "velocidad": 0.012,
    "rumbo": 30,
    "flores": 0.3,
    "opacidad": 0.95
  },
  "midi": {
    "escenas": {
      "0:16": "Sonido/agua",
      "0:0": "Capas/río real (la playa)/opacidad",
      "0:32": "Capas/río real (la playa)/solo_rioReal",
      "0:17": "Música/agua/filtro",
      "0:1": "Capas/río marrón (cáusticas)/opacidad",
      "0:33": "Capas/río marrón (cáusticas)/solo_rioMarron",
      "0:18": "Sonido/pajaros",
      "0:2": "Capas/sauces (verde inmersivo)/opacidad",
      "0:34": "Capas/sauces (verde inmersivo)/solo_sauces",
      "0:19": "Música/pulso/volumen",
      "0:3": "Capas/puente flashero (recorrido)/opacidad",
      "0:35": "Capas/puente flashero (recorrido)/solo_puente",
      "0:51": "Capas/puente flashero (recorrido)/escena",
      "0:67": "Capas/puente flashero (recorrido)/destello",
      "0:20": "Sonido/lluvia",
      "0:4": "Capas/tormenta (cielo cerrado, lluvia y rayos)/opacidad",
      "0:36": "Tormenta/activar",
      "0:52": "Tormenta/calmar",
      "0:68": "Tormenta/rayo",
      "0:22": "Capas/transicionCapas",
      "0:38": "Capas/puente flashero (recorrido)/soltar",
      "0:5": "Música/pájaros/todosPajaros"
    },
    "rioMarron": {
      "0:16": "Agua y oleaje/corriente",
      "0:0": "Agua y oleaje/revuelo",
      "0:32": "Capas/río marrón (cáusticas)/solo_rioMarron",
      "0:17": "Cáusticas/escala",
      "0:1": "Cáusticas/brillo",
      "0:18": "Cáusticas/agitacion",
      "0:2": "Cáusticas/contraste",
      "0:19": "Cáusticas/dispersion",
      "0:3": "Cáusticas/metal",
      "0:4": "Sonido/agua",
      "0:20": "Música/río/olas",
      "0:36": "Música/congelar/activo",
      "0:52": "Sonido/tocar_mate",
      "0:5": "Música/río/volumen",
      "0:21": "Música/río/profundo",
      "0:37": "Música/río/canta",
      "0:53": "Música/colchón/activo",
      "0:69": "Música/río/conCausticas",
      "0:6": "Música/río/barco",
      "0:22": "Música/río/mover",
      "0:38": "Música/río/tocarBarco",
      "0:54": "Música/río/burbujas",
      "0:70": "Música/río/chapoteo"
    },
    "rioReal": {
      "0:16": "Agua y oleaje/escala",
      "0:0": "Agua y oleaje/revuelo",
      "0:32": "Capas/río real (la playa)/solo_rioReal",
      "0:17": "Agua y oleaje/corriente",
      "0:1": "Agua y oleaje/viento",
      "0:18": "Capas/río real (la playa)/reflejo",
      "0:2": "Capas/río real (la playa)/espejo",
      "0:19": "Capas/río real (la playa)/halo",
      "0:3": "Capas/río real (la playa)/exposicion",
      "0:4": "Sonido/agua",
      "0:20": "Música/río/olas",
      "0:36": "Música/congelar/activo",
      "0:52": "Sonido/tocar_mate",
      "0:5": "Música/río/volumen",
      "0:21": "Música/río/profundo",
      "0:37": "Música/río/canta",
      "0:53": "Música/colchón/activo",
      "0:69": "Música/río/conCausticas",
      "0:6": "Música/río/barco",
      "0:22": "Música/río/mover",
      "0:38": "Música/río/tocarBarco",
      "0:54": "Música/río/burbujas",
      "0:70": "Música/río/chapoteo"
    },
    "sauces": {
      "0:16": "Capas/sauces (verde inmersivo)/lento",
      "0:0": "Capas/sauces (verde inmersivo)/opacidad",
      "0:32": "Capas/sauces (verde inmersivo)/solo_sauces",
      "0:48": "Capas/sauces (verde inmersivo)/otra",
      "0:17": "Capas/sauces (verde inmersivo)/invertir",
      "0:1": "Capas/sauces (verde inmersivo)/cieloAzul",
      "0:18": "Música/pájaros/eco",
      "0:2": "Sonido/pájaros/volumen",
      "0:19": "Música/pájaros/saltos",
      "0:3": "Sonido/pajaros",
      "0:20": "Música/colchón/brillo",
      "0:4": "Música/colchón/volumen",
      "0:36": "Música/colchón/activo",
      "0:21": "Música/espacio",
      "0:22": "Música/pájaros/charla",
      "0:6": "Música/pájaros/tempo",
      "0:38": "Música/pájaros/conversacion",
      "0:54": "Música/pájaros/aTiempo",
      "0:34": "Sonido/pájaros/tocar_benteveo",
      "0:50": "Sonido/pájaros/tocar_hornero",
      "0:66": "Sonido/pájaros/tocar_cardenal",
      "0:35": "Sonido/pájaros/tocar_zorzal colorado",
      "0:51": "Sonido/pájaros/tocar_zorzal chalchalero",
      "0:67": "Sonido/pájaros/tocar_loro barranquero",
      "0:37": "Sonido/pájaros/tocar_martín pescador chico",
      "0:53": "Sonido/pájaros/tocar_chiflón",
      "0:69": "Sonido/pájaros/tocar_garza mora",
      "0:60": "Sonido/pájaros/tocar_garza blanca",
      "0:61": "Sonido/pájaros/tocar_garcita blanca",
      "0:62": "Sonido/pájaros/tocar_jacana",
      "0:43": "Sonido/pájaros/tocar_gallineta",
      "0:44": "Sonido/pájaros/tocar_carancho",
      "0:42": "Sonido/pájaros/tocar_chimango",
      "0:70": "Sonido/tocar_mate",
      "0:5": "Música/pájaros/todosPajaros"
    },
    "puente": {
      "0:16": "Capas/puente flashero (recorrido)/velocidad",
      "0:0": "Capas/puente flashero (recorrido)/opacidad",
      "0:32": "Capas/puente flashero (recorrido)/solo_puente",
      "0:48": "Capas/puente flashero (recorrido)/escena",
      "0:64": "Capas/puente flashero (recorrido)/soltar",
      "0:17": "Capas/puente flashero (recorrido)/bpm",
      "0:1": "Capas/puente flashero (recorrido)/destellos",
      "0:33": "Capas/puente flashero (recorrido)/destello",
      "0:18": "Capas/puente flashero (recorrido)/forma y lugar/horizonte",
      "0:2": "Capas/puente flashero (recorrido)/resplandor",
      "0:34": "Capas/puente flashero (recorrido)/pasajes lentos/horizonte_bajo",
      "0:50": "Capas/puente flashero (recorrido)/pasajes lentos/horizonte_medio",
      "0:66": "Capas/puente flashero (recorrido)/pasajes lentos/horizonte_alto",
      "0:19": "Capas/puente flashero (recorrido)/forma y lugar/alturaCamara",
      "0:3": "Capas/puente flashero (recorrido)/curva",
      "0:35": "Capas/puente flashero (recorrido)/pasajes lentos/alturaCamara_bajo",
      "0:51": "Capas/puente flashero (recorrido)/pasajes lentos/alturaCamara_medio",
      "0:67": "Capas/puente flashero (recorrido)/pasajes lentos/alturaCamara_alto",
      "0:20": "Capas/puente flashero (recorrido)/luces",
      "0:4": "Capas/puente flashero (recorrido)/brillo",
      "0:36": "Capas/puente flashero (recorrido)/pasajes lentos/grosor_bajo",
      "0:52": "Capas/puente flashero (recorrido)/pasajes lentos/grosor_medio",
      "0:68": "Capas/puente flashero (recorrido)/pasajes lentos/grosor_alto",
      "0:21": "Capas/puente flashero (recorrido)/tono",
      "0:5": "Capas/puente flashero (recorrido)/abanico",
      "0:37": "Capas/puente flashero (recorrido)/pasajes lentos/tono_bajo",
      "0:53": "Capas/puente flashero (recorrido)/pasajes lentos/tono_medio",
      "0:69": "Capas/puente flashero (recorrido)/pasajes lentos/tono_alto",
      "0:22": "Música/pulso/cola",
      "0:6": "Música/pulso/volumen",
      "0:38": "Música/pulso/activo",
      "0:60": "Capas/puente flashero (recorrido)/pasajes lentos/altoTorre_bajo",
      "0:61": "Capas/puente flashero (recorrido)/pasajes lentos/altoTorre_medio",
      "0:62": "Capas/puente flashero (recorrido)/pasajes lentos/altoTorre_alto",
      "0:43": "Capas/puente flashero (recorrido)/pasajes lentos/cadaTorre_bajo",
      "0:44": "Capas/puente flashero (recorrido)/pasajes lentos/cadaTorre_medio",
      "0:42": "Capas/puente flashero (recorrido)/pasajes lentos/cadaTorre_alto",
      "0:49": "Capas/puente flashero (recorrido)/ritmoPatron",
      "0:65": "Capas/puente flashero (recorrido)/ritmoNegras"
    },
    "tormenta": {
      "0:16": "Capas/tormenta (cielo cerrado, lluvia y rayos)/oscuridad",
      "0:0": "Capas/tormenta (cielo cerrado, lluvia y rayos)/opacidad",
      "0:32": "Tormenta/activar",
      "0:48": "Tormenta/calmar",
      "0:64": "Tormenta/rayo",
      "0:17": "Tormenta/tamanoAros",
      "0:1": "Tormenta/gotas",
      "0:18": "Tormenta/frecuencia",
      "0:2": "Capas/tormenta (cielo cerrado, lluvia y rayos)/rayas",
      "0:19": "Tormenta/rayoDesde",
      "0:3": "Tormenta/rayoBrillo",
      "0:20": "Música/gotas/cantidad",
      "0:4": "Música/gotas/volumen",
      "0:36": "Música/gotas/activo",
      "0:21": "Sonido/viento",
      "0:5": "Sonido/lluvia",
      "0:22": "Agua y oleaje/revoltosa/profundidad",
      "0:6": "Agua y oleaje/revoltosa/altura"
    }
  },
  "momentos": [
    {
      "nombre": "noche",
      "pos": 0,
      "luz": "#9fb2cc",
      "metal": 0
    },
    {
      "nombre": "amanecer",
      "pos": 0.25,
      "luz": "#f7f180",
      "metal": 1
    },
    {
      "nombre": "mediodía",
      "pos": 0.5,
      "luz": "#f7f180",
      "metal": 0
    },
    {
      "nombre": "tarde",
      "pos": 0.62,
      "luz": "#f7f180",
      "metal": 0.3
    },
    {
      "nombre": "dorada",
      "pos": 0.7,
      "luz": "#f5d608",
      "metal": 0.8
    },
    {
      "nombre": "atardecer",
      "pos": 0.75,
      "luz": "#ff8c42",
      "metal": 1
    }
  ]
};
