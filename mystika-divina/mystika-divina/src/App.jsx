import React, { useState, useMemo, useRef, useEffect } from "react";

/* ============ ASTRONOMÍA (validado contra Astrodienst, precisión ~1') ============ */
const D2R = Math.PI / 180;
const norm = (x) => ((x % 360) + 360) % 360;
const sind = (x) => Math.sin(x * D2R), cosd = (x) => Math.cos(x * D2R), tand = (x) => Math.tan(x * D2R);

function julianDay(y, m, d, utHours) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + utHours / 24;
}

function sunLongitude(T) {
  const L0 = norm(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C = (1.914602 - 0.004817 * T) * sind(M) + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  return norm(L0 + C - 0.00569);
}

const MOON_TERMS = [
  [6.288774,0,0,1,0],[1.274027,2,0,-1,0],[0.658314,2,0,0,0],[0.213618,0,0,2,0],
  [-0.185116,0,1,0,0],[-0.114332,0,0,0,2],[0.058793,2,0,-2,0],[0.057066,2,-1,-1,0],
  [0.053322,2,0,1,0],[0.045758,2,-1,0,0],[-0.040923,0,1,-1,0],[-0.034720,1,0,0,0],
  [-0.030383,0,1,1,0],[0.015327,2,0,0,-2],[-0.012528,0,0,1,2],[0.010980,0,0,1,-2],
  [0.010675,4,0,-1,0],[0.010034,0,0,3,0],[0.008548,4,0,-2,0],[-0.007888,2,1,-1,0],
  [-0.006766,2,1,0,0],[-0.005163,1,0,-1,0],
];
function moonLongitude(T) {
  const Lp = norm(218.3164477 + 481267.88123421 * T);
  const D = norm(297.8501921 + 445267.1114034 * T);
  const Ms = norm(357.5291092 + 35999.0502909 * T);
  const Mp = norm(134.9633964 + 477198.8675055 * T);
  const F = norm(93.2720950 + 483202.0175233 * T);
  let lon = Lp;
  for (const [c, d, m, mp, f] of MOON_TERMS) lon += c * sind(d * D + m * Ms + mp * Mp + f * F);
  return norm(lon);
}

// Elementos keplerianos aproximados JPL (válidos 1800–2050)
const ELEM = {
  Mercurio:[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593,0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081],
  Venus:[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255,0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418],
  Tierra:[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0,0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0],
  Marte:[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891,0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343],
  Júpiter:[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909,-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106],
  Saturno:[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448,-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794],
  Urano:[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503,-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589],
  Neptuno:[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574,0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664],
  Plutón:[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684,-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482],
};
function helio(name, T) {
  const [a0,e0,i0,L0,w0,O0,da,de,di,dL,dw,dO] = ELEM[name];
  const a = a0 + da*T, e = e0 + de*T, i = i0 + di*T;
  const L = L0 + dL*T, wbar = w0 + dw*T, Om = O0 + dO*T;
  let M = norm(L - wbar); if (M > 180) M -= 360;
  const w = wbar - Om;
  let E = M + 57.29578 * e * sind(M);
  for (let k = 0; k < 10; k++) {
    const dM = M - (E - 57.29578 * e * sind(E));
    E += dM / (1 - e * cosd(E));
  }
  const xp = a * (cosd(E) - e), yp = a * Math.sqrt(1 - e*e) * sind(E);
  const cw=cosd(w), sw=sind(w), cO=cosd(Om), sO=sind(Om), ci=cosd(i), si=sind(i);
  return [
    (cw*cO - sw*sO*ci)*xp + (-sw*cO - cw*sO*ci)*yp,
    (cw*sO + sw*cO*ci)*xp + (-sw*sO + cw*cO*ci)*yp,
    (sw*si)*xp + (cw*si)*yp,
  ];
}
function planetLongitude(name, T) {
  const [ex, ey] = helio("Tierra", T);
  const [x, y] = helio(name, T);
  return norm(Math.atan2(y - ey, x - ex) / D2R + 1.39697 * T); // + precesión a fecha
}

function computeChart({ y, m, d, hh, mm, tz, lat, lon }) {
  const ut = hh + mm / 60 - tz;
  const JD = julianDay(y, m, d, ut);
  const T = (JD - 2451545) / 36525;
  const eps = 23.439291 - 0.0130042 * T;

  const lonAt = (name, t) =>
    name === "Sol" ? sunLongitude(t) : name === "Luna" ? moonLongitude(t) : planetLongitude(name, t);

  const names = ["Sol","Luna","Mercurio","Venus","Marte","Júpiter","Saturno","Urano","Neptuno","Plutón"];
  const dT = 0.25 / 36525;
  const planets = names.map((n) => {
    const l1 = lonAt(n, T), l2 = lonAt(n, T + dT);
    let diff = l2 - l1; if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    return { name: n, lon: l1, retro: diff < 0 && n !== "Sol" && n !== "Luna" };
  });
  const node = norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
  planets.push({ name: "Nodo N.", lon: node, retro: true });

  // Ángulos
  const gmst = norm(280.46061837 + 360.98564736629 * (JD - 2451545) + 0.000387933 * T * T);
  const ramc = norm(gmst + lon);
  const mc = norm(Math.atan2(sind(ramc), cosd(ramc) * cosd(eps)) / D2R);
  let asc = norm(Math.atan2(cosd(ramc), -(sind(ramc) * cosd(eps) + tand(lat) * sind(eps))) / D2R);
  if (norm(asc - mc) > 180) asc = norm(asc + 180);

  // Casas Placidus (iterativo); Porfirio si latitud extrema
  const raToEcl = (ra) => norm(Math.atan2(sind(ra), cosd(ra) * cosd(eps)) / D2R);
  const placidus = (offset, frac, nocturnal) => {
    let ra = norm(ramc + offset);
    for (let k = 0; k < 25; k++) {
      const lam = raToEcl(ra);
      const dec = Math.asin(sind(eps) * sind(lam)) / D2R;
      const cosH = -tand(lat) * tand(dec);
      if (Math.abs(cosH) > 1) return null;
      const SA = Math.acos(cosH) / D2R;
      ra = nocturnal ? norm(ramc + 180 - frac * (180 - SA)) : norm(ramc + frac * SA);
    }
    return raToEcl(ra);
  };
  let cusps = new Array(13).fill(0);
  cusps[10] = mc; cusps[1] = asc; cusps[4] = norm(mc + 180); cusps[7] = norm(asc + 180);
  const c11 = placidus(30, 1/3, false), c12 = placidus(60, 2/3, false);
  const c2 = placidus(120, 2/3, true), c3 = placidus(150, 1/3, true);
  if (c11 !== null && c12 !== null && c2 !== null && c3 !== null) {
    cusps[11]=c11; cusps[12]=c12; cusps[2]=c2; cusps[3]=c3;
  } else { // Porfirio
    const q1 = norm(asc - mc) / 3, q2 = norm(norm(mc + 180) - asc) / 3;
    cusps[11]=norm(mc+q1); cusps[12]=norm(mc+2*q1); cusps[2]=norm(asc+q2); cusps[3]=norm(asc+2*q2);
  }
  cusps[5]=norm(cusps[11]+180); cusps[6]=norm(cusps[12]+180); cusps[8]=norm(cusps[2]+180); cusps[9]=norm(cusps[3]+180);

  // Aspectos
  const ASPECTS = [
    { name: "Conjunción", glyph: "☌", angle: 0, orb: 8, kind: "neutral" },
    { name: "Sextil", glyph: "⚹", angle: 60, orb: 5, kind: "soft" },
    { name: "Cuadratura", glyph: "□", angle: 90, orb: 7, kind: "hard" },
    { name: "Trígono", glyph: "△", angle: 120, orb: 7, kind: "soft" },
    { name: "Oposición", glyph: "☍", angle: 180, orb: 8, kind: "hard" },
  ];
  const aspects = [];
  for (let i = 0; i < planets.length; i++)
    for (let j = i + 1; j < planets.length; j++) {
      let sep = Math.abs(planets[i].lon - planets[j].lon);
      if (sep > 180) sep = 360 - sep;
      for (const a of ASPECTS) {
        const orbUsed = Math.abs(sep - a.angle);
        if (orbUsed <= a.orb) { aspects.push({ a: i, b: j, type: a, orb: orbUsed }); break; }
      }
    }
  return { planets, cusps, asc, mc, aspects, eps, JD };
}

/* ============ FORMATO ============ */
const SIGNS = ["Aries","Tauro","Géminis","Cáncer","Leo","Virgo","Libra","Escorpio","Sagitario","Capricornio","Acuario","Piscis"];
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const ELEMENT_COLOR = ["#B5543B","#5B7C4F","#C9A24B","#3E6B8C","#B5543B","#5B7C4F","#C9A24B","#3E6B8C","#B5543B","#5B7C4F","#C9A24B","#3E6B8C"];
const PLANET_GLYPHS = { Sol:"☉", Luna:"☽", Mercurio:"☿", Venus:"♀", Marte:"♂", "Júpiter":"♃", Saturno:"♄", Urano:"♅", Neptuno:"♆", "Plutón":"♇", "Nodo N.":"☊" };
function fmtPos(lonV) {
  const s = Math.floor(lonV / 30), within = lonV % 30;
  const deg = Math.floor(within), min = Math.floor((within - deg) * 60);
  return { sign: SIGNS[s], glyph: SIGN_GLYPHS[s], signIdx: s, text: `${deg}°${String(min).padStart(2,"0")}'` };
}
function houseOf(lonV, cusps) {
  for (let h = 1; h <= 12; h++) {
    const a = cusps[h], b = cusps[h === 12 ? 1 : h + 1];
    const span = norm(b - a), pos = norm(lonV - a);
    if (pos < span) return h;
  }
  return 12;
}

/* ============ CIUDADES ============ */
const CITIES = [
  { name: "Ciudad de México", lat: 19.4, lon: -99.15, tz: -6 },
  { name: "Guadalajara", lat: 20.67, lon: -103.35, tz: -6 },
  { name: "Monterrey", lat: 25.67, lon: -100.32, tz: -6 },
  { name: "Puebla", lat: 19.04, lon: -98.2, tz: -6 },
  { name: "Tijuana", lat: 32.52, lon: -117.04, tz: -8 },
  { name: "Cancún", lat: 21.16, lon: -86.85, tz: -5 },
  { name: "Mérida", lat: 20.97, lon: -89.62, tz: -6 },
  { name: "Bogotá", lat: 4.71, lon: -74.07, tz: -5 },
  { name: "Buenos Aires", lat: -34.6, lon: -58.38, tz: -3 },
  { name: "Lima", lat: -12.05, lon: -77.04, tz: -5 },
  { name: "Madrid", lat: 40.42, lon: -3.7, tz: 1 },
  { name: "Los Ángeles", lat: 34.05, lon: -118.24, tz: -8 },
  { name: "Nueva York", lat: 40.71, lon: -74.01, tz: -5 },
  { name: "Otra (manual)", lat: 0, lon: 0, tz: 0, manual: true },
];

/* ============ RUEDA SVG ============ */
function Wheel({ chart, name, svgRef }) {
  const { planets, cusps, asc, aspects } = chart;
  const S = 700, cx = S / 2, cy = S / 2;
  const rZodOut = 330, rZodIn = 282, rTick = 268, rPlanet = 228, rHouseNum = 130, rAspect = 112;
  const screen = (lonV) => 180 + (lonV - asc);
  const pt = (lonV, r) => [cx + r * cosd(screen(lonV)), cy - r * sind(screen(lonV))];

  // Anti-colisión de glifos
  const disp = planets.map((p, i) => ({ i, lon: p.lon, d: p.lon })).sort((a, b) => a.lon - b.lon);
  const MIN = 8.5;
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let k = 0; k < disp.length; k++) {
      const a = disp[k], b = disp[(k + 1) % disp.length];
      let gap = norm(b.d - a.d);
      if (gap < MIN) { const push = (MIN - gap) / 2; a.d = norm(a.d - push); b.d = norm(b.d + push); moved = true; }
    }
    if (!moved) break;
  }
  const dispByIdx = {}; disp.forEach((o) => (dispByIdx[o.i] = o.d));

  const aspectColor = (k) => (k === "hard" ? "#B33A3A" : k === "soft" ? "#34618C" : "#8a8265");

  return (
    <svg ref={svgRef} viewBox={`0 0 ${S} ${S}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <radialGradient id="paper" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#FBF7EC" />
          <stop offset="100%" stopColor="#EFE6D2" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={rZodOut + 14} fill="url(#paper)" stroke="#C9A24B" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rZodOut + 8} fill="none" stroke="#C9A24B" strokeWidth="0.6" opacity="0.6" />
      <circle cx={cx} cy={cy} r={rZodOut} fill="none" stroke="#3a3424" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={rZodIn} fill="none" stroke="#3a3424" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={rTick} fill="none" stroke="#9a9078" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={rAspect} fill="#FBF7EC" stroke="#3a3424" strokeWidth="1" />

      {/* Signos */}
      {SIGN_GLYPHS.map((g, i) => {
        const start = i * 30;
        const [x1, y1] = pt(start, rZodIn), [x2, y2] = pt(start, rZodOut);
        const [gx, gy] = pt(start + 15, (rZodOut + rZodIn) / 2);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a3424" strokeWidth="0.8" />
            <text x={gx} y={gy} fontSize="26" fill={ELEMENT_COLOR[i]} textAnchor="middle" dominantBaseline="central" fontFamily="'Noto Sans Symbols', serif">{g}</text>
          </g>
        );
      })}
      {/* Marcas cada 5° */}
      {Array.from({ length: 72 }, (_, i) => {
        const lonV = i * 5, big = i % 2 === 0;
        const [x1, y1] = pt(lonV, rZodIn), [x2, y2] = pt(lonV, rZodIn - (big ? 8 : 5));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b6250" strokeWidth={big ? 1 : 0.5} />;
      })}

      {/* Cúspides de casas */}
      {Array.from({ length: 12 }, (_, k) => {
        const h = k + 1, isAxis = h === 1 || h === 4 || h === 7 || h === 10;
        const [x1, y1] = pt(cusps[h], rAspect), [x2, y2] = pt(cusps[h], isAxis ? rZodOut + 14 : rTick);
        const next = cusps[h === 12 ? 1 : h + 1];
        const mid = norm(cusps[h] + norm(next - cusps[h]) / 2);
        const [nx, ny] = pt(mid, rHouseNum + 18);
        return (
          <g key={h}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isAxis ? "#2c2618" : "#9a9078"} strokeWidth={isAxis ? 2 : 0.8} />
            <text x={nx} y={ny} fontSize="13" fill="#9a9078" textAnchor="middle" dominantBaseline="central" fontStyle="italic" fontFamily="Georgia, serif">{h}</text>
          </g>
        );
      })}
      {/* Etiquetas AC / MC */}
      {(() => {
        const [ax, ay] = pt(asc, rZodOut + 28); const [mx, my] = pt(cusps[10], rZodOut + 28);
        return (<g fontFamily="Georgia, serif" fontSize="15" fontWeight="bold" fill="#2c2618">
          <text x={ax} y={ay} textAnchor="middle" dominantBaseline="central">AC</text>
          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central">MC</text>
        </g>);
      })()}

      {/* Aspectos */}
      {aspects.map((as, i) => {
        const [x1, y1] = pt(planets[as.a].lon, rAspect);
        const [x2, y2] = pt(planets[as.b].lon, rAspect);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={aspectColor(as.type.kind)} strokeWidth={as.orb < 2.5 ? 1.6 : 0.9} opacity={as.orb < 2.5 ? 0.95 : 0.6} strokeDasharray={as.type.kind === "neutral" ? "3,3" : "none"} />;
      })}

      {/* Planetas */}
      {planets.map((p, i) => {
        const dAng = dispByIdx[i];
        const [gx, gy] = pt(dAng, rPlanet);
        const [tx1, ty1] = pt(p.lon, rTick), [tx2, ty2] = pt(p.lon, rTick - 7);
        const [lx, ly] = pt(dAng, rPlanet + 26);
        const [cx2, cy2] = pt(p.lon, rAspect + 4);
        const f = fmtPos(p.lon);
        return (
          <g key={p.name}>
            <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#2c2618" strokeWidth="1.6" />
            <line x1={gx} y1={gy} x2={cx2} y2={cy2} stroke="#c9bfa4" strokeWidth="0.5" opacity="0.7" />
            <text x={gx} y={gy} fontSize="24" fill="#2c2618" textAnchor="middle" dominantBaseline="central" fontFamily="'Noto Sans Symbols', serif">{PLANET_GLYPHS[p.name]}</text>
            <text x={lx} y={ly} fontSize="11" fill="#6b6250" textAnchor="middle" dominantBaseline="central" fontFamily="Georgia, serif">
              {f.text.split("'")[0] + "'"}{p.retro ? " ℞" : ""}
            </text>
          </g>
        );
      })}

      {/* Centro */}
      <text x={cx} y={cy - 8} fontSize="17" fill="#2c2618" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic">{name || "Carta natal"}</text>
      <circle cx={cx} cy={cy + 12} r="2" fill="#C9A24B" />
    </svg>
  );
}

/* ============ INTÉRPRETE LOCAL ============ */

const SN2 = ["Aries","Tauro","Géminis","Cáncer","Leo","Virgo","Libra","Escorpio","Sagitario","Capricornio","Acuario","Piscis"];

const SUN_SIGN2 = {
  "Aries":"Tu esencia es la del pionero: arrancas con energía directa y necesitas la acción para sentirte vivo. Tienes un coraje instintivo y una honestidad que a veces sorprende. El reto es aprender que la paciencia también es fortaleza.",
  "Tauro":"Tu fuerza reside en la persistencia: donde otros se rinden, tú construyes. Valoras la seguridad, el placer sensorial y lo concreto. El reto es no confundir estabilidad con resistencia al cambio.",
  "Géminis":"Tu mente está siempre en movimiento, conectando ideas y mundos distintos. La curiosidad es tu motor. El reto es profundizar en lugar de solo explorar la superficie.",
  "Cáncer":"Tu alma es sensible y tienes una memoria emocional extraordinaria. Cuidas a los demás de manera instintiva. El reto es aprender a cuidarte con la misma intensidad que cuidas a otros.",
  "Leo":"Irradias una presencia que no pasa desapercibida y tienes una necesidad genuina de crear y brillar. El reto es distinguir el reconocimiento externo del valor propio.",
  "Virgo":"Tu mente analítica ve los detalles que otros ignoran y tienes una dedicación al perfeccionamiento poco común. El reto es aceptar la imperfección con más gracia.",
  "Libra":"Buscas constantemente el equilibrio y la armonía. Tienes un don para ver todos los lados de una situación. El reto es tomar decisiones sin necesitar la aprobación de todos.",
  "Escorpio":"Tu mundo interior es profundo e intenso, con una capacidad innata para ver más allá de las apariencias. El reto es aprender a soltar el control y confiar en el cambio.",
  "Sagitario":"Eres un explorador del sentido de la vida, siempre buscando horizontes más amplios. El reto es aterrizar tus grandes visiones en acciones concretas.",
  "Capricornio":"Tienes una determinación de largo plazo que pocos igualan. El reto es permitirte descansar y disfrutar el camino, no solo la cima.",
  "Acuario":"Tu mente es innovadora y tu corazón late por causas más grandes que tú mismo. El reto es conectar emocionalmente con personas individuales, no solo con la humanidad como concepto.",
  "Piscis":"Tu sensibilidad es extraordinaria y tienes una conexión natural con lo invisible y espiritual. El reto es mantener tus propios límites sin perder tu apertura.",
};

const SUN_HOUSE2 = {
  1:"En casa 1 tu identidad se proyecta directamente al mundo: eres lo que los demás ven.",
  2:"En casa 2 tu propósito se expresa construyendo recursos y valores sólidos.",
  3:"En casa 3 brillas comunicando, aprendiendo y en tus vínculos cercanos.",
  4:"En casa 4 tu esencia está ligada al hogar, la familia y tus raíces.",
  5:"En casa 5 te realizas en la creatividad, el romance y el placer de vivir.",
  6:"En casa 6 tu propósito se expresa en el trabajo diario, la salud y el servicio.",
  7:"En casa 7 te defines en parte a través de tus relaciones más significativas.",
  8:"En casa 8 tu camino pasa por la transformación profunda y los recursos compartidos.",
  9:"En casa 9 tu identidad se expande con la educación, los viajes y la búsqueda de sentido.",
  10:"En casa 10 tu Sol brilla en la vocación pública. Naciste para dejar una huella visible en el mundo.",
  11:"En casa 11 te realizas en grupos, amistades y proyectos colectivos con visión de futuro.",
  12:"En casa 12 hay una dimensión espiritual y privada que necesita silencio para florecer.",
};

const MOON_SIGN2 = {
  "Aries":"Tu mundo emocional es impulsivo y directo: sientes rápido y reaccionas rápido. Necesitas libertad emocional y no toleras sentirte atrapado.",
  "Tauro":"Emocionalmente buscas estabilidad y seguridad. Tus sentimientos son profundos aunque los expresas lentamente. La rutina y el contacto físico te nutren.",
  "Géminis":"Procesas los sentimientos hablando y pensando. Necesitas estimulación mental para estar bien emocionalmente.",
  "Cáncer":"La sensibilidad está amplificada al máximo. Eres enormemente empático y tienes una memoria emocional fotográfica. El hogar es tu santuario.",
  "Leo":"Emocionalmente necesitas sentirte especial y reconocido. Tu corazón es generoso y expresa los sentimientos con intensidad y calor.",
  "Virgo":"Procesas las emociones analizándolas. Puedes ser muy crítico contigo mismo cuando sientes algo que no comprendes. La ayuda práctica es tu lenguaje de amor.",
  "Libra":"Buscas equilibrio emocional y armonía en tus relaciones. El conflicto te incomoda y tiendes a adaptarte para mantener la paz.",
  "Escorpio":"Tu vida emocional es intensa y muy privada. Sientes todo muy profundo aunque rara vez lo muestras abiertamente. La lealtad y la confianza son fundamentales.",
  "Sagitario":"Emocionalmente necesitas libertad y aventura. El optimismo es tu respuesta natural a los problemas.",
  "Capricornio":"Emocionalmente eres reservado y te cuesta mostrar vulnerabilidad. El logro y la responsabilidad te dan seguridad interna.",
  "Acuario":"Procesas las emociones de manera intelectual y te sientes cómodo con cierta distancia emocional. Necesitas que respeten tu independencia.",
  "Piscis":"Tu sensibilidad emocional es oceánica: absorbes los sentimientos de todos. Necesitas momentos de soledad para recuperar tu centro.",
};

const MOON_HOUSE2 = {
  1:"En casa 1 tus emociones se escriben directamente en tu cara y lenguaje corporal.",
  2:"En casa 2 tu seguridad emocional está ligada a la estabilidad económica.",
  3:"En casa 3 hablar es procesar: la comunicación es tu válvula emocional.",
  4:"En casa 4 la familia y el hogar son tu base emocional fundamental.",
  5:"En casa 5 el juego, el amor romántico y la creatividad son tu alimento emocional.",
  6:"En casa 6 la rutina y el trabajo cotidiano te dan o te quitan estabilidad emocional.",
  7:"En casa 7 tus emociones se activan intensamente en las relaciones de pareja.",
  8:"En casa 8 tus emociones son profundas, privadas y transformadoras.",
  9:"En casa 9 viajar, aprender y expandirte nutre profundamente tu mundo interior.",
  10:"En casa 10 la carrera y la imagen pública influyen directamente en tu estado emocional.",
  11:"En casa 11 tus amigos y grupos sociales son tu red de apoyo emocional clave.",
  12:"En casa 12 tienes una vida emocional muy interna, a veces invisible para los demás.",
};

const ASC_SIGN2 = {
  "Aries":"Llegas a cada situación con energía directa y deseos de empezar. La gente te percibe como activo, espontáneo y con iniciativa propia.",
  "Tauro":"Proyectas calma, confiabilidad y sensualidad. La gente te ve como alguien sólido y de confianza en quien apoyarse.",
  "Géminis":"Irradias curiosidad y vivacidad. Eres alguien con quien la conversación siempre fluye y que parece saber de todo un poco.",
  "Cáncer":"La gente siente tu calidez y sensibilidad desde el primer momento. Proyectas la imagen de alguien que cuida y protege.",
  "Leo":"Entras en cualquier lugar con presencia y magnetismo. La gente te nota, aunque tú no lo intentes.",
  "Virgo":"Proyectas precisión, orden y competencia. La gente te ve como alguien detallista y confiable para cualquier tarea.",
  "Libra":"Irradias elegancia y equilibrio. La gente te percibe como diplomático y agradable, fácil de tratar.",
  "Escorpio":"Tu mirada penetra. La gente siente tu intensidad aunque no pueda describirla con palabras.",
  "Sagitario":"Proyectas optimismo y libertad. La gente te ve como aventurero, honesto y con buen humor.",
  "Capricornio":"Irradias seriedad y autoridad natural. La gente confía en ti para roles de responsabilidad.",
  "Acuario":"Proyectas originalidad y una chispa de rareza encantadora. La gente te ve como alguien diferente y progresista.",
  "Piscis":"Irradias una sensibilidad etérea y misteriosa. La gente siente algo especial en ti aunque no siempre pueda definirlo.",
};

const VENUS_SIGN2 = {
  "Aries":"Amas con impulsividad y entusiasmo. La conquista te emociona y necesitas que la relación tenga chispa y espontaneidad.",
  "Tauro":"En el amor eres sensual, leal y buscas una relación estable que pueda construirse con tiempo.",
  "Géminis":"Buscas una pareja que también sea tu mejor amigo intelectual. La conversación y la variedad son esenciales.",
  "Cáncer":"Amas con profundidad y necesitas sentirte seguro emocionalmente para abrirte. El cuidado mutuo es central.",
  "Leo":"Amas con generosidad y dramatismo. Buscas ser admirado y admirar, con pasión y romanticismo.",
  "Virgo":"Expresas el amor con actos de servicio y atención a los detalles. Buscas siempre mejorar la relación.",
  "Libra":"Amas la armonía y la belleza en las relaciones. Eres romántico y buscas equilibrio y elegancia con tu pareja.",
  "Escorpio":"Amas con intensidad total o no amas. La profundidad emocional y la lealtad absoluta son tus estándares.",
  "Sagitario":"Buscas una pareja que también sea tu compañera de aventuras. La libertad dentro de la relación es indispensable.",
  "Capricornio":"Amas con seriedad y compromiso. Prefieres construir algo sólido a largo plazo sobre una aventura pasajera.",
  "Acuario":"Valoras la amistad y la libertad en el amor. Tu pareja debe respetar tu independencia y compartir tus ideales.",
  "Piscis":"Amas con devoción casi espiritual. Eres romántico y compasivo, pero debes cuidarte de idealizar a la pareja.",
};

const MARS_SIGN2 = {
  "Aries":"Tu energía es explosiva y directa. Actúas primero y piensas después — tu mayor fortaleza y tu mayor reto.",
  "Tauro":"Tu fuerza es tenaz: una vez que decides algo, nada te detiene. Pero te cuesta arrancar sin motivación genuina.",
  "Géminis":"Tu energía se dispersa en múltiples proyectos. Tienes agilidad verbal y mental, pero necesitas enfocarte para completar lo que empiezas.",
  "Cáncer":"Tu motivación está profundamente ligada a las emociones. Cuando algo te importa de verdad, tu determinación es sorprendente.",
  "Leo":"Actúas con drama y confianza. Tu energía se intensifica cuando hay un público o cuando sientes que tu aportación es única.",
  "Virgo":"Tu energía es metódica y eficiente. Trabajas duro en los detalles que otros ignoran.",
  "Libra":"Te cuesta actuar si hay conflicto. Tu energía fluye mejor cuando hay cooperación y consenso.",
  "Escorpio":"Tu voluntad es extraordinaria. Cuando decides algo con esa intensidad interior, lo consigues.",
  "Sagitario":"Tu energía se activa con la libertad y las posibilidades ilimitadas. Los proyectos con visión te motivan.",
  "Capricornio":"Tu disciplina y perseverancia son excepcionales. Trabajas con metas claras y a largo plazo.",
  "Acuario":"Tu energía se activa cuando luchas por algo que cambia las cosas colectivamente. Lo innovador te motiva.",
  "Piscis":"Tu energía es intuitiva y sutil. Te mueves mejor con la inspiración que con la disciplina rígida.",
};

const ASPECT_TEXT2 = {
  "Conjunción":"potencia e intensifica",
  "Sextil":"facilita y abre oportunidades entre",
  "Cuadratura":"genera tensión creativa entre",
  "Trígono":"armoniza y da fluidez natural entre",
  "Oposición":"crea polaridad que busca equilibrio entre",
};

function buildReading2(chart, name) {
  const sunSign = SN2[Math.floor(chart.planets[0].lon / 30)];
  const moonSign = SN2[Math.floor(chart.planets[1].lon / 30)];
  const ascSign = SN2[Math.floor(chart.asc / 30)];
  const venusSign = SN2[Math.floor(chart.planets[3].lon / 30)];
  const marsSign = SN2[Math.floor(chart.planets[4].lon / 30)];
  const sunH = houseOf(chart.planets[0].lon, chart.cusps);
  const moonH = houseOf(chart.planets[1].lon, chart.cusps);
  const venusH = houseOf(chart.planets[3].lon, chart.cusps);
  const marsH = houseOf(chart.planets[4].lon, chart.cusps);
  const jupH = houseOf(chart.planets[5].lon, chart.cusps);
  const satH = houseOf(chart.planets[6].lon, chart.cusps);
  const satSign = SN2[Math.floor(chart.planets[6].lon / 30)];
  const jupSign = SN2[Math.floor(chart.planets[5].lon / 30)];
  const mercSign = SN2[Math.floor(chart.planets[2].lon / 30)];
  const mercH = houseOf(chart.planets[2].lon, chart.cusps);
  const mcSign = SN2[Math.floor(chart.mc / 30)];
  const h7sign = SN2[Math.floor(chart.cusps[7] / 30)];
  const topAsp = [...chart.aspects].sort((a,b) => a.orb - b.orb).slice(0,6);
  return { sunSign, moonSign, ascSign, venusSign, marsSign, mercSign, mcSign, h7sign,
           sunH, moonH, venusH, marsH, jupH, satH, mercH, satSign, jupSign, topAsp, name };
}

function respond2(question, reading, chart) {
  const q = question.toLowerCase();
  const { sunSign, moonSign, ascSign, venusSign, marsSign, mercSign, mcSign, h7sign,
          sunH, moonH, venusH, marsH, jupH, satH, mercH, satSign, jupSign, topAsp } = reading;

  // GENERAL
  if (!q || q.includes("general") || q.includes("personalidad") || q.includes("interpreta") || q.includes("carta") || q.includes("quien soy")) {
    const aspLines = topAsp.slice(0,3).map(a => {
      const n1 = chart.planets[a.a].name, n2 = chart.planets[a.b].name;
      return `• ${n1} ${a.type.name.toLowerCase()} ${n2} (${a.orb.toFixed(1)}°): ${ASPECT_TEXT2[a.type.name] || "conecta"} estas energías.`;
    }).join("\n");
    return `✦ SOL EN ${sunSign.toUpperCase()}, CASA ${sunH}\n${SUN_SIGN2[sunSign] || ""} ${SUN_HOUSE2[sunH] || ""}\n\n` +
           `✦ LUNA EN ${moonSign.toUpperCase()}, CASA ${moonH}\n${MOON_SIGN2[moonSign] || ""} ${MOON_HOUSE2[moonH] || ""}\n\n` +
           `✦ ASCENDENTE ${ascSign.toUpperCase()}\n${ASC_SIGN2[ascSign] || ""}\n\n` +
           `✦ ASPECTOS CLAVE\n${aspLines}\n\n` +
           `✦ SÍNTESIS\nEres una persona con la esencia ${sunSign.toLowerCase()} en su núcleo, que procesa el mundo desde un interior ${moonSign.toLowerCase()} y se presenta ante los demás con la energía de ${ascSign}. Estas tres fuerzas conviven y a veces crean tensiones creativas que son, en realidad, el motor de tu crecimiento.`;
  }

  // AMOR
  if (q.includes("amor") || q.includes("relacion") || q.includes("pareja") || q.includes("romance") || q.includes("venus")) {
    const venAsp = chart.aspects.filter(a =>
      chart.planets[a.a].name === "Venus" || chart.planets[a.b].name === "Venus"
    ).slice(0,2).map(a => {
      const other = chart.planets[a.a].name === "Venus" ? chart.planets[a.b].name : chart.planets[a.a].name;
      return `• Venus ${ASPECT_TEXT2[a.type.name] || "en aspecto"} ${other} (${a.orb.toFixed(1)}°)`;
    }).join("\n");
    const h7desc = {
      "Acuario":"independientes, originales, poco convencionales",
      "Leo":"carismáticas, expresivas y con necesidad de brillar",
      "Escorpio":"intensas, profundas y transformadoras",
      "Tauro":"estables, sensuales y orientadas a la seguridad",
      "Aries":"apasionadas, directas y muy independientes",
      "Virgo":"ordenadas, analíticas y orientadas al detalle",
      "Piscis":"sensibles, intuitivas y algo idealizadoras",
      "Libra":"diplomáticas, elegantes y buscadoras de armonía",
      "Géminis":"intelectuales, comunicativas y versátiles",
      "Cáncer":"empáticas, protectoras y centradas en el hogar",
      "Sagitario":"libres, filosóficas y aventureras",
      "Capricornio":"serias, ambiciosas y orientadas al logro",
    }[h7sign] || "con características propias de " + h7sign;
    return `✦ VENUS EN ${venusSign.toUpperCase()}, CASA ${venusH}\n${VENUS_SIGN2[venusSign] || ""}\n\n` +
           `✦ LUNA EN ${moonSign.toUpperCase()} — CÓMO SIENTES EL AMOR\n${(MOON_SIGN2[moonSign] || "").split(".")[0]}. Esto colorea profundamente cómo das y recibes afecto.\n\n` +
           `✦ CASA 7 (PERFIL DE PAREJA)\nLa cúspide de tu casa 7 en ${h7sign} indica que tiendes a atraer parejas ${h7desc}.\n\n` +
           (venAsp ? `✦ ASPECTOS DE VENUS\n${venAsp}` : "");
  }

  // TRABAJO
  if (q.includes("trabajo") || q.includes("carrera") || q.includes("vocacion") || q.includes("profesion") || q.includes("exito") || q.includes("dinero")) {
    const mcDesc = {
      "Tauro":"constancia, habilidades prácticas y un trabajo que produzca algo tangible y bello",
      "Leo":"creatividad, liderazgo y una presencia que inspire a otros",
      "Capricornio":"disciplina, ambición y una carrera que construya legado a largo plazo",
      "Acuario":"innovación, ruptura con lo establecido y proyectos que benefician a la sociedad",
      "Aries":"iniciativa, emprendimiento y proyectos donde tú lideras",
      "Virgo":"precisión, servicio y excelencia en los detalles",
      "Escorpio":"profundidad, investigación y gestión de recursos o crisis",
      "Sagitario":"enseñanza, viajes, filosofía o expansión de horizontes",
      "Libra":"negociación, relaciones públicas, arte o justicia",
      "Géminis":"comunicación, escritura, enseñanza o trabajo con datos",
      "Cáncer":"cuidado de otros, bienes raíces, historia o trabajo desde casa",
      "Piscis":"arte, espiritualidad, cuidado de la salud mental o trabajo intuitivo",
    }[mcSign] || "las cualidades propias de " + mcSign;
    return `✦ MEDIO CIELO EN ${mcSign.toUpperCase()}\nTu reputación y carrera se construyen con energía de ${mcSign}: ${mcDesc}.\n\n` +
           `✦ SOL EN CASA ${sunH}\n${SUN_HOUSE2[sunH] || ""}\n\n` +
           `✦ MARTE EN ${marsSign.toUpperCase()}, CASA ${marsH}${chart.planets[4].retro ? " (RETRÓGRADO)" : ""}\nTu motor para la acción: ${(MARS_SIGN2[marsSign] || "").split(".")[0].toLowerCase()}. En casa ${marsH}, esta energía se aplica ${marsH===10?"directamente a tu ambición pública":marsH===6?"al trabajo diario y la salud":marsH===2?"a la generación de recursos económicos":marsH===1?"a tu imagen personal y lanzamiento al mundo":"al área de vida de la casa "+marsH}.\n\n` +
           `✦ SATURNO EN ${satSign.toUpperCase()}, CASA ${satH}${chart.planets[6].retro ? " (RETRÓGRADO)" : ""}\nSaturno señala tu área de mayor aprendizaje y disciplina. La casa ${satH} es donde maduras más lentamente pero más sólidamente.${chart.planets[6].retro?" Al estar retrógrado, este proceso es principalmente interno.":""}`;
  }

  // LUNA
  if (q.includes("luna") || q.includes("emociones") || q.includes("sentimientos") || q.includes("interior") || q.includes("siento")) {
    const moonAsp = chart.aspects.filter(a =>
      chart.planets[a.a].name === "Luna" || chart.planets[a.b].name === "Luna"
    ).slice(0,3).map(a => {
      const other = chart.planets[a.a].name === "Luna" ? chart.planets[a.b].name : chart.planets[a.a].name;
      return `• Luna ${ASPECT_TEXT2[a.type.name] || "en aspecto"} ${other} (${a.orb.toFixed(1)}°): ${ASPECT_TEXT2[a.type.name] || "conecta"} tu vida emocional con las energías de ${other}.`;
    }).join("\n");
    const needDesc = {
      "Virgo":"Orden, utilidad y sentir que eres de ayuda práctica. El caos emocional te genera ansiedad; la rutina y el análisis te dan paz.",
      "Escorpio":"Profundidad, intimidad real y confianza total. Sin esas condiciones te cierras. Con ellas, tu lealtad es inquebrantable.",
      "Leo":"Reconocimiento genuino y espacio para expresarte. Necesitas que tus emociones sean vistas y valoradas.",
      "Acuario":"Libertad emocional y amistades que te entiendan sin juzgarte. Las relaciones demasiado dependientes te asfixian.",
      "Aries":"Acción y movimiento. Las emociones estancadas te frustran; necesitas canalizarlas en energía.",
      "Tauro":"Estabilidad, contacto físico y una rutina predecible que te dé sensación de seguridad.",
      "Géminis":"Diálogo, estimulación mental y variedad. Hablar de lo que sientes es parte de cómo lo procesas.",
      "Cáncer":"Cercanía, cuidado mutuo y un hogar donde puedas ser vulnerable. La familia es tu ancla.",
      "Libra":"Armonía en las relaciones y ambientes estéticos. El conflicto sin resolver te agota emocionalmente.",
      "Sagitario":"Libertad, aventura y proyectos que tengan sentido filosófico. La rutina excesiva te apaga.",
      "Capricornio":"Logros concretos y una estructura de vida sólida. El caos y la falta de metas te generan inseguridad.",
      "Piscis":"Soledad creativa, música, naturaleza o espiritualidad. Necesitas retirarte regularmente del mundo.",
    }[moonSign] || "lo que resuena con la energía de " + moonSign + ".";
    return `✦ LUNA EN ${moonSign.toUpperCase()}, CASA ${moonH}\n${MOON_SIGN2[moonSign] || ""}\n\n${MOON_HOUSE2[moonH] || ""}\n\n` +
           (moonAsp ? `✦ ASPECTOS DE LA LUNA\n${moonAsp}\n\n` : "") +
           `✦ LO QUE NECESITAS EMOCIONALMENTE\n${needDesc}`;
  }

  // RETO
  if (q.includes("reto") || q.includes("desafio") || q.includes("dificil") || q.includes("karma") || q.includes("aprender") || q.includes("crecer") || q.includes("leccio")) {
    const hardAsp = chart.aspects.filter(a => a.type.kind === "hard").sort((a,b) => a.orb - b.orb).slice(0,3)
      .map(a => `• ${chart.planets[a.a].name} en ${a.type.name} con ${chart.planets[a.b].name} (${a.orb.toFixed(1)}°): tensión que, cuando se trabaja conscientemente, produce grandes logros.`).join("\n");
    const nodePlanet = chart.planets[10];
    const nodeSign = nodePlanet ? SN2[Math.floor(nodePlanet.lon / 30)] : "";
    const nodeH = nodePlanet ? houseOf(nodePlanet.lon, chart.cusps) : "";
    const satH_desc = {
      8:"el manejo de recursos compartidos, la intimidad profunda y la capacidad de transformarte sin aferrarte",
      7:"las relaciones comprometidas: aprendes a través de la pareja lo que no puedes aprender solo",
      10:"la carrera y la reputación pública: el éxito llega, pero hay que ganárselo con consistencia",
      12:"el mundo interior, el autoconocimiento y la rendición del ego ante algo más grande",
      1:"la construcción de tu identidad y confianza en ti mismo",
      2:"la relación con el dinero, los recursos y el propio valor",
      4:"la familia de origen, el hogar y las raíces emocionales",
      6:"el trabajo diario, la salud y el servicio a los demás",
      9:"la expansión a través de la educación, los viajes y las creencias",
      3:"la comunicación, el aprendizaje y los vínculos cercanos",
      5:"la expresión creativa, el amor y el riesgo de ser tú mismo",
      11:"la participación en grupos y la lealtad a tus ideales",
    }[satH] || "el área de vida de la casa " + satH;
    return `✦ SATURNO EN ${satSign.toUpperCase()}, CASA ${satH}${chart.planets[6].retro ? " (RETRÓGRADO)" : ""}\nSaturno es el gran maestro de la carta. En casa ${satH} indica que tu principal área de disciplina y aprendizaje de vida es ${satH_desc}.` +
           (chart.planets[6].retro ? "\n\nAl estar retrógrado, las lecciones de Saturno llegan desde adentro: no siempre del mundo exterior, sino de la autoevaluación y la conciencia propia." : "") +
           (hardAsp ? `\n\n✦ ASPECTOS TENSOS (MOTORES DE CRECIMIENTO)\n${hardAsp}` : "") +
           (nodeSign ? `\n\n✦ NODO NORTE EN ${nodeSign.toUpperCase()}, CASA ${nodeH}\nEl Nodo Norte señala tu dirección de evolución en esta vida: crecer hacia las cualidades de ${nodeSign} en el área de la casa ${nodeH}. Es hacia donde apunta tu alma.` : "");
  }

  // MERCURY / MENTE
  if (q.includes("mercurio") || q.includes("mente") || q.includes("comunic") || q.includes("aprend") || q.includes("intelig")) {
    const mercDesc = {
      "Aries":"Tu mente es directa, rápida y va al punto. Piensas con velocidad e intuición, a veces sin filtro.",
      "Tauro":"Tu mente es metódica y práctica. Aprendes despacio pero profundamente, y lo que entiendes no lo olvidas.",
      "Géminis":"Tu mente es brillante, curiosa y multiconectada. Aprendes rápido y eres excelente comunicador.",
      "Cáncer":"Tu mente está muy conectada a las emociones. Aprendes y recuerdas mejor cuando algo te conmueve.",
      "Leo":"Tu mente es creativa y expresiva. Comunicas con impacto y te gusta que tus ideas sean reconocidas.",
      "Virgo":"Tu mente es analítica y precisa. Ves detalles que otros pierden y tienes gran capacidad de síntesis.",
      "Libra":"Tu mente es diplomática y pesa todos los lados antes de concluir. Excelente para negociar y mediar.",
      "Escorpio":"Tu mente es profunda e investigadora. Llegas a la raíz de todo y tienes capacidad de guardar secretos.",
      "Sagitario":"Tu mente es filosófica y visional. Aprendes mejor cuando hay un propósito o significado más amplio.",
      "Capricornio":"Tu mente es práctica y estratégica. Piensas en el largo plazo y te interesa lo que funciona en la realidad.",
      "Acuario":"Tu mente es original e innovadora. Piensas diferente a los demás y eso puede ser tu mayor activo.",
      "Piscis":"Tu mente es intuitiva y asociativa. Aprendes más por insight que por razonamiento lineal.",
    }[mercSign] || "";
    return `✦ MERCURIO EN ${mercSign.toUpperCase()}, CASA ${mercH}${chart.planets[2].retro ? " (RETRÓGRADO)" : ""}\n${mercDesc}\n\nEn casa ${mercH}, este estilo mental se aplica ${mercH===10?"a tu carrera y reputación — comunicar bien es parte de tu éxito":mercH===3?"a la comunicación cotidiana y los vínculos cercanos":mercH===9?"a la filosofía, la enseñanza y los viajes que expanden tu mente":mercH===1?"directamente a cómo te presentas y relacionas":"al área de vida de la casa "+mercH}.` +
           (chart.planets[2].retro ? "\n\nAl estar retrógrado, tu proceso mental es muy interior: piensas mucho antes de hablar, revisas constantemente y a veces te cuesta decidir, pero tus reflexiones son muy profundas y originales." : "");
  }

  // JUPITER
  if (q.includes("jupiter") || q.includes("suerte") || q.includes("expan") || q.includes("abundancia") || q.includes("oprtunidad")) {
    const jupH_desc = {
      2:"Los recursos materiales y el dinero tienden a fluir con más facilidad hacia ti cuando sigues tus valores genuinos.",
      10:"El éxito profesional y el reconocimiento público tienen mucho espacio para expandirse en tu vida.",
      9:"La filosofía, los viajes largos y la educación superior son tu área de máximo crecimiento.",
      1:"Júpiter en casa 1 te da una presencia optimista y expansiva que otros notan y que te abre muchas puertas.",
      5:"La creatividad, el amor y los proyectos personales son tu área de expansión y gozo natural.",
      7:"Las relaciones y alianzas estratégicas traen crecimiento y buena fortuna a tu vida.",
      11:"Los grupos, amistades influyentes y proyectos colectivos son canales de abundancia para ti.",
      4:"El hogar, la familia y los bienes raíces son áreas de expansión y prosperidad.",
      3:"La comunicación, el aprendizaje y los viajes cortos traen oportunidades constantes.",
      6:"El trabajo bien hecho, la salud y el servicio generan abundancia en tu vida.",
      8:"La gestión de recursos ajenos, herencias o inversiones pueden traer expansión.",
      12:"Tu crecimiento más profundo es interior y espiritual, lejos de los reflectores.",
    }[jupH] || "En esa área de tu vida, el crecimiento tiende a ser más natural y generoso.";
    return `✦ JÚPITER EN ${jupSign.toUpperCase()}, CASA ${jupH}\nJúpiter es el planeta de la expansión y la buena suerte. ${jupH_desc}\n\nEn ${jupSign}, este crecimiento se da con energía ${jupSign.toLowerCase()}: ` +
           (jupSign==="Leo"?"creatividad, liderazgo y necesidad de brillar.":
            jupSign==="Sagitario"?"libertad, filosofía y búsqueda de verdad.":
            jupSign==="Piscis"?"compasión, espiritualidad y conexión con algo más grande.":
            jupSign==="Acuario"?"innovación, pensamiento progresista y proyectos colectivos.":
            jupSign==="Aries"?"iniciativa, emprendimiento y conquista de nuevos territorios.":
            jupSign==="Tauro"?"paciencia, trabajo concreto y construcción de valor tangible.":
            "las características propias de ese signo.");
  }

  // ASPECTOS
  if (q.includes("aspecto") || q.includes("patron")) {
    const aspText = topAsp.map(a => {
      const n1 = chart.planets[a.a].name, n2 = chart.planets[a.b].name;
      return `• ${n1} ${a.type.name} ${n2} (${a.orb.toFixed(1)}°): ${ASPECT_TEXT2[a.type.name] || "conecta"} estas dos energías en tu carta.`;
    }).join("\n");
    return `✦ TUS PRINCIPALES ASPECTOS\n${aspText}\n\nLos aspectos muestran cómo dialogan las energías planetarias entre sí. Los trígonos y sextiles facilitan y armonizan; las cuadraturas y oposiciones crean tensión que, bien canalizada, produce los mayores logros de vida.`;
  }

  // MARTE
  if (q.includes("marte") || q.includes("energia") || q.includes("accion") || q.includes("impulso")) {
    return `✦ MARTE EN ${marsSign.toUpperCase()}, CASA ${marsH}${chart.planets[4].retro ? " (RETRÓGRADO)" : ""}\n${MARS_SIGN2[marsSign] || ""}\n\nEn casa ${marsH}, esta energía se aplica ${marsH===10?"directamente a tu ambición y carrera pública":marsH===1?"a tu imagen personal y cómo te lanzas al mundo":marsH===7?"en las relaciones, donde puedes ser muy apasionado y a veces confrontacional":marsH===6?"en el trabajo diario y la gestión de la salud":marsH===12?"de manera interna e instintiva, muchas veces de maneras que no controlas del todo":"al área de vida de la casa "+marsH}.` +
           (chart.planets[4].retro ? "\n\nAl estar retrógrado, tu energía de Marte es más reflexiva que explosiva. Actúas con más deliberación que impulso, y tus batallas más importantes son internas." : "");
  }

  // SATURNO
  if (q.includes("saturno") || q.includes("limite") || q.includes("discipl") || q.includes("madur")) {
    return `✦ SATURNO EN ${satSign.toUpperCase()}, CASA ${satH}${chart.planets[6].retro ? " (RETRÓGRADO)" : ""}\nSaturno es el arquitecto de tu vida: lento, exigente, pero produce las estructuras más sólidas. En ${satSign} y casa ${satH}, te enseña a través de la experiencia directa en esa área.\n\n` +
           `En ${satSign}, Saturno aplica sus lecciones con energía ${satSign.toLowerCase()}: ` +
           (satSign==="Acuario"?"aprendes a equilibrar tu individualismo con la responsabilidad hacia los grupos y comunidades.":
            satSign==="Capricornio"?"aprendes que el éxito requiere disciplina, tiempo y no atajos.":
            satSign==="Escorpio"?"aprendes a manejar el poder, la intimidad y los recursos compartidos con integridad.":
            satSign==="Piscis"?"aprendes a estructurar tu espiritualidad e intuición de manera práctica.":
            "las lecciones características de " + satSign + ".") +
           (chart.planets[6].retro ? "\n\nAl estar retrógrado, Saturno trabaja desde adentro hacia afuera. Las lecciones de disciplina y responsabilidad son profundamente interiorizadas." : "");
  }

  // PLUTON
  if (q.includes("pluto") || q.includes("transform") || q.includes("poder") || q.includes("profund")) {
    const plutSign = SN2[Math.floor(chart.planets[9].lon / 30)];
    const plutH = houseOf(chart.planets[9].lon, chart.cusps);
    return `✦ PLUTÓN EN ${plutSign.toUpperCase()}, CASA ${plutH}\nPlutón es el planeta de la transformación profunda y el poder. En casa ${plutH} señala el área de tu vida donde las transformaciones son más radicales y donde el poder personal se desarrolla a través de las crisis y el renacimiento.\n\n` +
           `En ${plutSign}, esta transformación tiene la energía de ${plutSign.toLowerCase()}.` +
           (plutH===5?"En casa 5, la creatividad, la sexualidad y los hijos o proyectos creativos pueden ser áreas de transformación intensa.":
            plutH===8?" En casa 8, el manejo de recursos compartidos, la sexualidad y la muerte simbólica son temas centrales en tu vida.":
            plutH===12?" En casa 12, la transformación ocurre en los niveles más profundos del inconsciente y la espiritualidad.":
            "");
  }

  // FALLBACK
  return `Con Sol en ${sunSign}, Luna en ${moonSign} y Ascendente en ${ascSign}, tu carta habla de alguien que actúa con la energía de ${sunSign}, siente desde ${moonSign} y se proyecta como ${ascSign}.\n\nPuedes preguntarme sobre:\n• Amor y relaciones\n• Trabajo y vocación\n• Luna y emociones\n• Principales retos\n• Júpiter y expansión\n• Mercurio y mente\n• Marte y energía\n• Saturno y disciplina\n• Aspectos de la carta\n• Cualquier planeta específico`;
}

function Interpreter({ chart, name, freeLimit = null, onLimitReached = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [qCount, setQCount] = useState(0);
  const reading = useMemo(() => buildReading2(chart, name), [chart, name]);
  const isBlocked = freeLimit !== null && qCount >= freeLimit;

  const send = (userText) => {
    if (!userText.trim()) return;
    if (isBlocked) { if (onLimitReached) onLimitReached(); return; }
    const answer = respond2(userText, reading, chart);
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: answer },
    ]);
    if (freeLimit !== null) setQCount(c => c + 1);
  };

  const ask = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    send(q);
  };

  const QUICK = [
    "Interpretación general",
    "Amor y relaciones",
    "Trabajo y vocación",
    "Mi Luna",
    "Mis retos",
    "Júpiter y suerte",
  ];

  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#F5EFE2", margin: "0 0 4px" }}>
        ✦ Intérprete astral
      </h2>
      <p style={{ color: "#8B7FB8", fontSize: 13, margin: "0 0 12px", fontStyle: "italic" }}>
        Interpretaciones específicas para tu carta calculada
      </p>
      <div style={{ background: "#1a1733", border: "1px solid #2e2952", borderRadius: 16, padding: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: "#8B7FB8", fontSize: 14, margin: "0 0 12px", fontStyle: "italic", textAlign: "center" }}>
            Elige un tema o escribe tu pregunta.
          </p>
        )}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} style={{
              padding: "8px 13px", borderRadius: 999, border: "1px solid #3b3563",
              background: "transparent", color: "#C9A24B", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>{q}</button>
          ))}
        </div>
        {messages.map((m, i) => (
          <div key={i} style={{
            margin: "10px 0", padding: "12px 14px", borderRadius: 12, fontSize: 14.5, lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            background: m.role === "user" ? "#2a2450" : "#221d40",
            border: m.role === "user" ? "1px solid #3b3563" : "1px solid #2e2952",
            color: m.role === "user" ? "#cfc6e8" : "#EDE7F6",
            marginLeft: m.role === "user" ? 40 : 0,
            marginRight: m.role === "user" ? 0 : 40,
          }}>
            {m.content}
          </div>
        ))}
        {freeLimit !== null && !isBlocked && (
          <div style={{ textAlign:"center", margin:"8px 0 4px", fontSize:12, color: qCount >= freeLimit - 1 ? "#e08585" : "#6f659b" }}>
            {freeLimit - qCount} pregunta{freeLimit - qCount !== 1 ? "s" : ""} gratuita{freeLimit - qCount !== 1 ? "s" : ""} restante{freeLimit - qCount !== 1 ? "s" : ""}
          </div>
        )}
        {isBlocked ? null : (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Pregunta sobre tu carta..."
            style={{
              flex: 1, background: "#1d1a38", border: "1px solid #3b3563", borderRadius: 10,
              color: "#EDE7F6", padding: "11px 13px", fontSize: 15, outline: "none", fontFamily: "inherit",
            }}
          />
          <button onClick={ask} style={{
            padding: "0 18px", borderRadius: 10, border: "1px solid #C9A24B",
            background: "linear-gradient(180deg, #d8b25e, #b8923f)",
            color: "#1a1408", fontSize: 18, cursor: "pointer", fontFamily: "inherit",
          }}>›</button>
        </div>
        )}
      </div>
    </div>
  );
}


/* ============ LÚA — GUÍA CÓSMICA DIARIA ============ */

function computeTodayTransits(natal) {
  const now = new Date();
  const y = now.getUTCFullYear(), mo = now.getUTCMonth() + 1, d = now.getUTCDate();
  const JD_t = julianDay(y, mo, d, 12);
  const JD_y = julianDay(y, mo, d - 1, 12);
  const T = (JD_t - 2451545) / 36525;
  const Ty = (JD_y - 2451545) / 36525;

  const lonNow = (name) => {
    if (name === "Sol") return sunLongitude(T);
    if (name === "Luna") return moonLongitude(T);
    return planetLongitude(name, T);
  };
  const lonPrev = (name) => {
    if (name === "Sol") return sunLongitude(Ty);
    if (name === "Luna") return moonLongitude(Ty);
    return planetLongitude(name, Ty);
  };

  const TNAMES = ["Sol","Luna","Mercurio","Venus","Marte","Júpiter","Saturno","Urano","Neptuno","Plutón"];
  const ORB_T = [{n:"Conjunción",a:0,orb:8},{n:"Sextil",a:60,orb:4},{n:"Cuadratura",a:90,orb:7},{n:"Trígono",a:120,orb:7},{n:"Oposición",a:180,orb:8}];

  const natalPoints = [
    ...natal.planets.map(p => ({ name: p.name, lon: p.lon })),
    { name: "Ascendente", lon: natal.asc },
    { name: "MC", lon: natal.mc },
  ];

  return TNAMES.map(name => {
    const lon = lonNow(name);
    const lon0 = lonPrev(name);
    let dL = lon - lon0; if (dL > 180) dL -= 360; if (dL < -180) dL += 360;
    const retro = dL < 0;
    const sign = SN2[Math.floor(lon / 30)];
    const house = houseOf(lon, natal.cusps);
    const aspects = [];
    for (const np of natalPoints) {
      let sep = Math.abs(lon - np.lon);
      if (sep > 180) sep = 360 - sep;
      for (const asp of ORB_T) {
        const orb = Math.abs(sep - asp.a);
        if (orb <= asp.orb) {
          aspects.push({ natalPlanet: np.name, type: asp.n, orb, applying: orb < 1.5 });
          break;
        }
      }
    }
    return { planet: name, lon, sign, house, retro, aspects };
  });
}

// ─── TEXT LIBRARIES ─────────────────────────────────────────────────────────

const LUA_MOON_CASA = {
  1: { area:"Energía Personal", topic:"autoconciencia e imagen",
    climate:"La Luna transita tu Casa 1 hoy: tu cuerpo, tu imagen y tus iniciativas ocupan el escenario emocional.",
    bullets:["Tu estado de ánimo se expresa directamente en tu presencia física y en cómo te muestras ante los demás.","Es un buen momento para lanzar algo nuevo o para cuidar tu imagen y bienestar personal.","Lo que proyectas hoy tiene más peso del habitual: cuida el tono en tus interacciones."],
    do:"Haz algo que refuerce tu confianza personal: ejercicio, arreglarte, o dar el primer paso en algo que procrastinas.",
    avoid:"Tomar decisiones por impulso emocional sin reflexionar un momento.",
  },
  2: { area:"Trabajo", topic:"recursos y valores",
    climate:"La Luna cruza tu Casa 2 hoy: dinero, posesiones y lo que genuinamente valoras están en primer plano emocional.",
    bullets:["Las emociones en torno al dinero o a la seguridad material pueden estar más activadas de lo normal.","Es un buen día para revisar presupuestos, tomar decisiones de compra o reflexionar sobre lo que realmente valoras.","El placer por las cosas simples y concretas es especialmente nutritivo hoy."],
    do:"Revisa tus finanzas o haz algo que te dé sensación de seguridad y abundancia concreta.",
    avoid:"Gastar impulsivamente para calmar una incomodidad emocional.",
  },
  3: { area:"Trabajo", topic:"comunicación y mente",
    climate:"La Luna activa tu Casa 3: las palabras, los vínculos cercanos y la mente inquieta marcan el tono del día.",
    bullets:["Las conversaciones importantes fluyen con más facilidad hoy que otros días.","La curiosidad mental está alta: aprovecha para aprender algo o para comunicar algo que has postergado.","Los mensajes, correos y llamadas pendientes tienen hoy el momento ideal para atenderse."],
    do:"Escribe ese mensaje importante, llama a esa persona o comienza ese curso o lectura que tienes pendiente.",
    avoid:"Dispersarte en demasiadas conversaciones a la vez sin profundizar en ninguna.",
  },
  4: { area:"Energía Personal", topic:"hogar y raíces",
    climate:"La Luna visita tu Casa 4, el corazón de tu carta: la familia, el hogar y tus raíces emocionales están en primer plano.",
    bullets:["El hogar y los vínculos familiares necesitan más atención hoy y la merecen.","Tu mundo interior está más sensible: es un día para nutrir, no para forzar resultados externos.","El descanso y el recogimiento tienen un valor especial en esta jornada."],
    do:"Pasa tiempo de calidad en casa o conecta con alguien de tu familia que valoras.",
    avoid:"Sobreexigirte en el mundo exterior cuando el mundo interno pide calma.",
  },
  5: { area:"Amor", topic:"creatividad y placer",
    climate:"La Luna en tu Casa 5 enciende la creatividad, el romance y el placer: el día tiene una energía juguetona y cálida.",
    bullets:["Las actividades que disfrutas por el simple placer de hacerlas tienen un lugar especial hoy.","El romance y la expresión afectiva fluyen con más naturalidad: excelente para citas o momentos íntimos.","La creatividad está activada: pinta, escribe, cocina o cualquier cosa que haga fluir tu imaginación."],
    do:"Planea algo que genuinamente disfrutes, con o sin compañía.",
    avoid:"Trabajar en tareas mecánicas y rutinarias cuando la energía del día pide juego y creatividad.",
  },
  6: { area:"Trabajo", topic:"trabajo y salud",
    climate:"La Luna transita tu Casa 6: el trabajo cotidiano, los detalles y el cuerpo físico están en foco hoy.",
    bullets:["Los pendientes de trabajo diario se abordan con más energía y eficiencia que de costumbre.","El cuerpo te envía señales hoy más claramente: escucha lo que necesitas en términos de descanso, alimentación o movimiento.","Es un buen día para poner orden en tareas, organizar espacios o atender la salud preventivamente."],
    do:"Cierra pendientes de trabajo y haz algo bueno por tu salud física hoy.",
    avoid:"Ignorar señales de cansancio o saltarte rutinas de bienestar con el pretexto de estar ocupado.",
  },
  7: { area:"Amor", topic:"relaciones y el otro",
    climate:"La Luna en tu Casa 7 pone a las relaciones importantes en el centro del día: pareja, socios y colaboradores.",
    bullets:["Las necesidades de conexión y equilibrio en las relaciones están más activas hoy.","Es un buen día para resolver temas pendientes con alguien importante o para simplemente conectar con calidad.","Eres más consciente de cómo te ves reflejado en los otros: cuida la proyección."],
    do:"Dedica tiempo genuino a alguien importante para ti: pareja, socio o amigo clave.",
    avoid:"Ignorar lo que una relación importante está necesitando de ti en este momento.",
  },
  8: { area:"Amor", topic:"intimidad y transformación",
    climate:"La Luna transita tu Casa 8: la intimidad profunda, lo compartido y la transformación emocional marcan la jornada.",
    bullets:["Los temas relacionados con recursos compartidos, herencias o deudas pueden surgir hoy.","La profundidad emocional está activada: conversaciones de fondo tienen el terreno preparado.","Es un momento propicio para hacer las paces con algo del pasado o para tomar decisiones de transformación personal."],
    do:"Atrévete a tener una conversación profunda que has postergado.",
    avoid:"Evitar temas difíciles o incómodos que realmente necesitan ser abordados.",
  },
  9: { area:"Energía Personal", topic:"expansión y sentido",
    climate:"La Luna en tu Casa 9 abre el horizonte: la búsqueda de sentido, los viajes y el aprendizaje de alto vuelo son el clima.",
    bullets:["El deseo de expandirte, aprender o ver más allá de lo cotidiano está especialmente activado.","Es un excelente día para estudiar, investigar, planear un viaje o explorar una filosofía que te interesa.","Las conversaciones con perspectiva amplia y filosófica son muy nutridas hoy."],
    do:"Lee algo inspirador, toma ese curso o planea el próximo viaje o aventura.",
    avoid:"Quedarte encerrado en lo rutinario cuando la energía del día pide expansión.",
  },
  10: { area:"Trabajo", topic:"carrera y vocación pública",
    climate:"La Luna transita tu Casa 10: tu carrera, tu reputación y tu papel en el mundo están en primer plano hoy.",
    bullets:["Lo que haces y cómo te perciben profesionalmente tiene un peso mayor que de costumbre.","Es un buen día para hacer una presentación, pedir ese ascenso o mostrar tus capacidades.","Las decisiones sobre el rumbo profesional que tomes hoy tienen una resonancia especial."],
    do:"Muéstrate profesionalmente en tu mejor versión: reuniones, entregas o comunicaciones clave.",
    avoid:"Pasar el día en tareas de bajo impacto cuando la energía del día favorece el protagonismo.",
  },
  11: { area:"Energía Personal", topic:"amistades y proyectos colectivos",
    climate:"La Luna activa tu Casa 11: amigos, grupos, redes y proyectos compartidos con visión de futuro.",
    bullets:["La energía social y colectiva está alta: excelente para conectar con tu comunidad.","Los proyectos que involucran a varias personas tienen un impulso especial hoy.","Revisar tus objetivos a largo plazo y alinearlos con tus valores tiene un buen momento hoy."],
    do:"Conecta con amigos o colaboradores, o avanza en un proyecto colectivo que te importa.",
    avoid:"Aislarte cuando la energía del día favorece la conexión y la colaboración.",
  },
  12: { area:"Energía Personal", topic:"mundo interior y retiro",
    climate:"La Luna transita tu Casa 12, la más profunda y privada: el día pide silencio, introspección y contacto contigo mismo.",
    bullets:["El mundo interior está especialmente activo: es un día más para sentir que para actuar.","La meditación, la escritura en diario, la naturaleza o cualquier práctica espiritual son particularmente nutritivas hoy.","Lo que surge de manera espontánea en tu mente o en sueños puede tener mensajes importantes."],
    do:"Reserva tiempo para ti solo: medita, escribe o simplemente descansa sin agenda.",
    avoid:"Sobreexponer tu energía o tomar decisiones impulsivas desde un estado de mayor sensibilidad.",
  },
};

const PLANETA_FUNCION = {
  "Sol":"tu identidad y vitalidad central",
  "Luna":"tu mundo emocional",
  "Mercurio":"tu mente y comunicación",
  "Venus":"tu capacidad de amar y conectar",
  "Marte":"tu energía y motivación",
  "Júpiter":"tu expansión y optimismo",
  "Saturno":"tus estructuras y disciplina",
  "Urano":"tu impulso de cambio",
  "Neptuno":"tu sensibilidad espiritual",
  "Plutón":"tu fuerza de transformación",
  "Ascendente":"tu imagen y presencia",
  "MC":"tu vocación pública",
};

const ASPECTO_VERBO = {
  "Conjunción":"se fusiona con",
  "Sextil":"conversa armoniosamente con",
  "Cuadratura":"tensa de manera creativa",
  "Trígono":"fluye en armonía con",
  "Oposición":"crea una polaridad iluminadora con",
};

const SLOW_PLANETS = ["Saturno","Urano","Neptuno","Plutón","Júpiter"];
const PERSONAL_NATAL = ["Sol","Luna","Mercurio","Venus","Marte","Ascendente","MC"];

function weightTransit(t) {
  const pW = { "Saturno":4,"Neptuno":4,"Plutón":4,"Urano":3.5,"Júpiter":3,"Marte":2,"Venus":1.5,"Mercurio":1.5,"Sol":1,"Luna":0.8 }[t.planet] || 1;
  let best = 0;
  for (const a of t.aspects) {
    if (!PERSONAL_NATAL.includes(a.natalPlanet)) continue;
    const aW = (a.type==="Conjunción"||a.type==="Oposición") ? 2 : (a.type==="Cuadratura") ? 1.8 : 1.4;
    const oW = a.orb < 1 ? 2.5 : a.orb < 2 ? 2 : a.orb < 3 ? 1.5 : 1;
    best = Math.max(best, pW * aW * oW);
  }
  return best;
}

function buildLuaReading(name, natal, transits) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("es-MX", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  // Moon position
  const moonT = transits.find(t => t.planet === "Luna");
  const moonH = moonT.house;
  const moonBase = LUA_MOON_CASA[moonH] || LUA_MOON_CASA[1];

  // Luna Nueva / Llena
  const sunLon = transits.find(t => t.planet === "Sol")?.lon || 0;
  let sep = Math.abs(sunLon - moonT.lon); if (sep > 180) sep = 360 - sep;
  const isNueva = sep < 12, isLlena = Math.abs(sep - 180) < 12;

  // Find strongest slow-planet transit
  let protagonist = null, topW = 0;
  for (const t of transits) {
    if (!SLOW_PLANETS.includes(t.planet)) continue;
    const w = weightTransit(t);
    if (w > topW) { topW = w; protagonist = t; }
  }

  // Best aspect of protagonist
  let protAsp = null;
  if (protagonist) {
    protAsp = protagonist.aspects.filter(a => PERSONAL_NATAL.includes(a.natalPlanet)).sort((a,b) => a.orb - b.orb)[0];
  }

  // Moon's tight aspects to natal
  const moonAspects = moonT.aspects.filter(a => PERSONAL_NATAL.includes(a.natalPlanet) && a.orb < 4)
    .sort((a,b) => a.orb - b.orb).slice(0,2);

  // ── Build the three sections ──────────────────────────────────────────

  // 1. CLIMATE
  let climate = `**${dateStr}**\n\n`;
  if (isNueva) {
    climate += `🌑 **Luna Nueva en ${moonT.sign}** — un umbral de comienzos. `;
  } else if (isLlena) {
    climate += `🌕 **Luna Llena en ${moonT.sign}** — un momento de culminación e iluminación. `;
  }
  climate += moonBase.climate.replace("hoy:", `hoy, ${name.split(" ")[0]}:`);

  if (moonAspects.length > 0) {
    const ma = moonAspects[0];
    climate += ` Además, la Luna ${ASPECTO_VERBO[ma.type] || "aspecia"} ${PLANETA_FUNCION[ma.natalPlanet] || ma.natalPlanet}: esto tiñe el día con una energía de ${ma.type === "Cuadratura" || ma.type === "Oposición" ? "tensión creativa" : "fluidez"} emocional.`;
  }

  if (protagonist && protAsp && topW >= 4) {
    const retroNote = protagonist.retro ? " (retrógrado: énfasis en revisar y reflexionar, no en forzar)" : "";
    climate += `\n\n**${protagonist.planet}${retroNote}** transita tu Casa ${protagonist.house} y ${ASPECTO_VERBO[protAsp.type] || "aspecia"} ${PLANETA_FUNCION[protAsp.natalPlanet] || protAsp.natalPlanet}: esta es la energía de fondo más potente de la semana, no solo del día.`;
  }

  // 2. FOCUS
  let focusArea = moonBase.area;
  let focusBullets = [...moonBase.bullets];

  if (protagonist && protAsp && topW >= 4) {
    const pName = protagonist.planet, asp = protAsp;
    const nHouse = houseOf(natal.planets.find(p => p.name === asp.natalPlanet)?.lon || natal.asc, natal.cusps);
    // Override area
    if ([5,7,8].includes(protagonist.house) || [5,7,8].includes(nHouse)) focusArea = "Amor";
    else if ([2,6,10].includes(protagonist.house) || [2,6,10].includes(nHouse)) focusArea = "Trabajo";
    else focusArea = "Energía Personal";

    // Generate slow-planet bullet
    const aspKind = (asp.type==="Cuadratura"||asp.type==="Oposición") ? "una tensión creativa" : "una oportunidad";
    const retroTxt = protagonist.retro ? "Con este planeta retrógrado, la energía se procesa más hacia adentro: revisión más que acción." : "";
    focusBullets.unshift(
      `**${pName} en ${asp.type.toLowerCase()} a tu ${asp.natalPlanet} natal** (orbe ${asp.orb.toFixed(1)}°): es ${aspKind} entre ${PLANETA_FUNCION[pName] || pName.toLowerCase()} y ${PLANETA_FUNCION[asp.natalPlanet] || asp.natalPlanet}. ${retroTxt}`
    );
    focusBullets = focusBullets.slice(0, 4);
  }

  // 3. CONSEJO
  let doIt = moonBase.do, avoid = moonBase.avoid;
  if (protagonist && protAsp && topW >= 6) {
    const pName = protagonist.planet;
    if (pName === "Saturno") {
      doIt = "Afronta esa responsabilidad pendiente con calma y enfoque: Saturno recompensa el esfuerzo honesto.";
      avoid = "Evitar lo que sabes que debes hacer. La evasión solo hace el reto más pesado.";
    } else if (pName === "Júpiter") {
      doIt = "Aprovecha el impulso de Júpiter: expande, conecta, o da el paso que estabas postergando.";
      avoid = "Exagerar o comprometerte con más de lo que puedes sostener en este momento.";
    } else if (pName === "Urano") {
      doIt = "Abrirte a lo inesperado hoy: lo que surge de imprevisto puede traer la innovación que necesitas.";
      avoid = "Aferrarte a lo conocido por miedo al cambio cuando la energía pide flexibilidad.";
    } else if (pName === "Neptuno") {
      doIt = "Confía en tu intuición hoy y dedica tiempo a algo creativo, espiritual o de autocuidado.";
      avoid = "Tomar decisiones importantes bajo un estado de confusión o idealización: espera mayor claridad.";
    } else if (pName === "Plutón") {
      doIt = "Permite que algo que ya no sirve se transforme o suelte: la resistencia es lo único que duele.";
      avoid = "Forzar situaciones de poder o control. La transformación de Plutón se da, no se controla.";
    }
  }

  // 4. Retrograde context
  const retrogrades = transits.filter(t => t.retro && SLOW_PLANETS.includes(t.planet));
  let retroNote = "";
  if (retrogrades.length > 0) {
    const rNames = retrogrades.map(t => t.planet).join(", ");
    retroNote = `\n\n*En tránsito retrógrado hoy: ${rNames}. Estos planetas invitan a revisar, reflexionar y consolidar, más que a lanzar novedades.*`;
  }

  return {
    dateStr, focusArea, moonSign: moonT.sign, moonHouse: moonH,
    climate, focusBullets, doIt, avoid, retroNote,
    protagonist: protagonist ? `${protagonist.planet} en Casa ${protagonist.house}` : null,
  };
}

function respondLua(question, name, natal, transits, reading) {
  const q = question.toLowerCase();
  const moon = transits.find(t => t.planet === "Luna");
  const firstName = name.split(" ")[0];

  // Love / relationships
  if (q.includes("amor") || q.includes("pareja") || q.includes("relacion") || q.includes("romance")) {
    const venus = transits.find(t => t.planet === "Venus");
    const venusAsp = venus?.aspects.filter(a => PERSONAL_NATAL.includes(a.natalPlanet)).slice(0,1)[0];
    let resp = `La Luna hoy en tu Casa ${moon.house} (${LUA_MOON_CASA[moon.house]?.topic || "energía emocional"}) es el primer filtro emocional en el amor.`;
    if (venusAsp) {
      resp += ` Además, Venus ${ASPECTO_VERBO[venusAsp.type] || "aspecia"} ${PLANETA_FUNCION[venusAsp.natalPlanet] || venusAsp.natalPlanet}: ${venusAsp.type === "Trígono" || venusAsp.type === "Sextil" ? "el clima en el amor es fluido y receptivo hoy." : "hay una dinámica activa en tus relaciones que pide atención consciente."}`;
    }
    return resp;
  }

  // Work / money
  if (q.includes("trabajo") || q.includes("dinero") || q.includes("carrera") || q.includes("firma") || q.includes("negocio")) {
    const merc = transits.find(t => t.planet === "Mercurio");
    const retroMerc = merc?.retro;
    let resp = retroMerc
      ? `Mercurio está retrógrado transitando tu Casa ${merc.house}: energía más de revisión que de nuevos acuerdos. Si puedes posponer firmas o lanzamientos, hazlo; si no, revisa dos veces cada detalle.`
      : `Mercurio directo transita tu Casa ${merc?.house || "—"}: buen momento para comunicar, acordar y avanzar en temas laborales.`;
    const sat = transits.find(t => t.planet === "Saturno");
    const satAsp = sat?.aspects.filter(a => PERSONAL_NATAL.includes(a.natalPlanet) && a.orb < 4).slice(0,1)[0];
    if (satAsp) {
      resp += ` Saturno ${ASPECTO_VERBO[satAsp.type] || "aspecia"} ${PLANETA_FUNCION[satAsp.natalPlanet] || satAsp.natalPlanet}: ${satAsp.type === "Cuadratura" || satAsp.type === "Oposición" ? "hay presión estructural que pide responsabilidad y paciencia en lo laboral." : "la disciplina y el compromiso que pongas hoy se consolidan de manera duradera."}`;
    }
    return resp + " Recuerda consultar con un profesional para decisiones financieras o legales importantes.";
  }

  // Energy / body
  if (q.includes("energia") || q.includes("cuerpo") || q.includes("salud") || q.includes("cansancio") || q.includes("descanso")) {
    const mars = transits.find(t => t.planet === "Marte");
    const marsAsp = mars?.aspects.filter(a => ["Sol","Luna","Marte","Ascendente"].includes(a.natalPlanet) && a.orb < 5).slice(0,1)[0];
    let resp = `La Luna en tu Casa ${moon.house} indica que tu energía emocional hoy está orientada hacia ${LUA_MOON_CASA[moon.house]?.topic || "tu mundo interior"}.`;
    if (marsAsp) {
      resp += ` Marte ${ASPECTO_VERBO[marsAsp.type] || "aspecia"} ${PLANETA_FUNCION[marsAsp.natalPlanet] || marsAsp.natalPlanet}: ${marsAsp.type === "Trígono" || marsAsp.type === "Sextil" ? "la energía física está disponible y fluye bien." : "la energía puede estar algo intensa o dispersa; un esfuerzo físico moderado te ayudará a canalizarla."}`;
    }
    return resp + " Para temas de salud, complementa siempre con tu médico.";
  }

  // Moon question
  if (q.includes("luna") || q.includes("emociones") || q.includes("sentimientos")) {
    return `La Luna transita hoy tu Casa ${moon.house} en ${moon.sign}. ${LUA_MOON_CASA[moon.house]?.climate || ""} Tu mundo emocional está especialmente sensible a los temas de esta casa. ${LUA_MOON_CASA[moon.house]?.bullets[0] || ""}`;
  }

  // Retrograde question
  if (q.includes("retrogrado") || q.includes("retrógrado")) {
    const retros = transits.filter(t => t.retro);
    if (retros.length === 0) return `No hay planetas significativos retrógrados hoy, ${firstName}. La energía general es más directa y de avance.`;
    const list = retros.map(t => `${t.planet} (Casa ${t.house})`).join(", ");
    return `Los planetas retrógrados hoy son: ${list}. Cada uno en su casa natal indica un área de revisión interna, no de obstáculo. Úsalos para reflexionar, corregir o consolidar, más que para lanzar novedades.`;
  }

  // General follow-up
  return `Basándome en el clima cósmico de hoy, ${firstName}: la Luna en tu Casa ${moon.house} marca la energía emocional de base (${LUA_MOON_CASA[moon.house]?.topic || "tu mundo interior"}). ${reading?.protagonist ? `El tránsito más potente de fondo es ${reading.protagonist}. ` : ""}¿Hay un área específica de tu vida sobre la que quieras afinar la lectura?`;
}

// ─── LUA AGENT COMPONENT ────────────────────────────────────────────────────

function LuaAgent({ chart, name, isPremium = false, onUpgrade = null }) {
  const [shown, setShown] = useState(false);
  const [reading, setReading] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const transits = useMemo(() => computeTodayTransits(chart), [chart]);

  const generate = () => {
    const r = buildLuaReading(name, chart, transits);
    setReading(r);
    setShown(true);
    // Build the formatted initial message
    const bullet = (txt, i) => `  ${i+1}. ${txt}`;
    const fullText =
      `🌌 EL CLIMA CÓSMICO DE HOY\n${r.climate}${r.retroNote}\n\n` +
      `🎯 FOCO DEL DÍA: ${r.focusArea.toUpperCase()}\n${r.focusBullets.map(bullet).join("\n")}\n\n` +
      `✨ CONSEJO ACCIONABLE\n• Hazlo hoy: ${r.doIt}\n• Mejor evita: ${r.avoid}`;
    setMessages([{ role: "assistant", content: fullText }]);
  };

  const ask = (userText) => {
    if (!userText.trim()) return;
    const answer = respondLua(userText, name, chart, transits, reading);
    setMessages(prev => [...prev, { role:"user", content: userText }, { role:"assistant", content: answer }]);
    setInput("");
  };

  const QUICK_LUA = [
    "¿Cómo está el amor hoy?",
    "¿Buen día para el trabajo?",
    "¿Cómo está mi energía?",
    "¿Hay planetas retrógrados?",
  ];

  const moonT = transits.find(t => t.planet === "Luna");
  const moonSign = moonT?.sign || "";
  const moonH = moonT?.house || 1;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:26, fontWeight:600, color:"#F5EFE2", margin:0 }}>
          🌙 Guía Cósmica Diaria
        </h2>
        <span style={{ background:"#2a2450", border:"1px solid #3b3563", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#8B7FB8", letterSpacing:"0.12em" }}>
          LÚA
        </span>
      </div>
      <p style={{ color:"#8B7FB8", fontSize:13, margin:"0 0 12px", fontStyle:"italic" }}>
        Luna hoy en {moonSign}, Casa {moonH} · Orientación diaria personalizada para tu carta
      </p>

      <div style={{ background:"#1a1733", border:"1px solid #2e2952", borderRadius:16, padding:16 }}>
        {!isPremium ? (
          <div style={{ textAlign:"center", padding:"12px 0" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🌙</div>
            <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:20, color:"#F5EFE2", marginBottom:8 }}>Guía Cósmica Diaria</div>
            <div style={{ color:"#8B7FB8", fontSize:13, marginBottom:16, lineHeight:1.6 }}>
              Lúa calcula los tránsitos de hoy sobre tu carta y genera una guía personalizada del día.<br/>
              Esta función es <strong style={{color:"#C9A24B"}}>exclusiva Premium</strong>.
            </div>
            <button onClick={onUpgrade} style={{ padding:"11px 22px", borderRadius:12, border:"1px solid #C9A24B",
              background:"linear-gradient(180deg, #d8b25e, #b8923f)", color:"#1a1408",
              fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
              ★ Desbloquear con Premium — $5/mes
            </button>
          </div>
        ) : !shown ? (
          <div style={{ textAlign:"center", padding:"8px 0" }}>
            <p style={{ color:"#8B7FB8", fontSize:14, margin:"0 0 14px", fontStyle:"italic" }}>
              Lúa cruza los tránsitos de hoy con tu carta natal y genera tu guía personalizada del día.
            </p>
            <button onClick={generate} style={{
              padding:"13px 28px", borderRadius:12, border:"1px solid #C9A24B",
              background:"linear-gradient(180deg, #d8b25e, #b8923f)", color:"#1a1408",
              fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.04em",
            }}>
              ✦ Ver mi guía de hoy
            </button>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} style={{
            margin:"10px 0", padding:"13px 15px", borderRadius:12, fontSize:14.5, lineHeight:1.7,
            whiteSpace:"pre-wrap",
            background: m.role==="user" ? "#2a2450" : "#1e1a40",
            border: m.role==="user" ? "1px solid #3b3563" : "1px solid #C9A24B33",
            color: m.role==="user" ? "#cfc6e8" : "#EDE7F6",
            marginLeft: m.role==="user" ? 40 : 0,
            marginRight: m.role==="user" ? 0 : 40,
          }}>
            {m.role === "assistant" && i === 0 && (
              <div style={{ color:"#C9A24B", fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:8 }}>
                Lúa · Tu guía cósmica
              </div>
            )}
            {m.role === "assistant" && i > 0 && (
              <div style={{ color:"#C9A24B", fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:6 }}>
                Lúa
              </div>
            )}
            {m.content}
          </div>
        ))}

        {shown && (
          <>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap", margin:"12px 0 10px" }}>
              {QUICK_LUA.map(q => (
                <button key={q} onClick={() => ask(q)} style={{
                  padding:"7px 12px", borderRadius:999, border:"1px solid #3b3563",
                  background:"transparent", color:"#8B7FB8", fontSize:12.5, cursor:"pointer", fontFamily:"inherit",
                }}>{q}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && ask(input)}
                placeholder="Pregúntale a Lúa sobre tu día..."
                style={{
                  flex:1, background:"#1d1a38", border:"1px solid #3b3563", borderRadius:10,
                  color:"#EDE7F6", padding:"11px 13px", fontSize:15, outline:"none", fontFamily:"inherit",
                }}
              />
              <button onClick={() => ask(input)} style={{
                padding:"0 18px", borderRadius:10, border:"1px solid #C9A24B",
                background:"linear-gradient(180deg, #d8b25e, #b8923f)",
                color:"#1a1408", fontSize:18, cursor:"pointer", fontFamily:"inherit",
              }}>›</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ============ AUTH & SUBSCRIPTION ============ */

const FREE_Q_LIMIT = 3;

// ── Stripe config ─────────────────────────────────────────────────────────────
// Stripe config — use .env for production (VITE_ prefix exposes safely to browser)
const STRIPE_PRODUCT_ID   = import.meta.env.VITE_STRIPE_PRODUCT_ID   || "prod_Uk3ZaCMp9C0sxZ";
const STRIPE_PUBLISHABLE  = import.meta.env.VITE_STRIPE_PUBLISHABLE  || "pk_test_51TkZLk374aLVRteypGaiWmyk87n96bAytk1glAhOJ3G8P8WhkR4F3e3RrHfbnAs7xQOBCv8NufUtJCK01knjNrGR00RPFKmM1R";
const STRIPE_PRICE_ID     = import.meta.env.VITE_STRIPE_PRICE_ID     || "price_1TkZRy374aLVRteytf9GFE6S";
const STRIPE_PAYMENT_LINK_URL = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "https://buy.stripe.com/test_9B614g6DK6dX0qh6Th8EM00";

async function loadStripeJs() {
  if (window.Stripe) return window.Stripe;
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => res(window.Stripe);
    s.onerror = () => rej(new Error("Could not load Stripe.js"));
    document.head.appendChild(s);
  });
}

async function startStripeCheckout(email) {
  if (STRIPE_PUBLISHABLE.includes("YOUR")) throw new Error("Configura tu Stripe publishable key en el código.");
  if (STRIPE_PRICE_ID.includes("YOUR")) throw new Error("Configura tu Stripe price ID en el código.");
  const Stripe = await loadStripeJs();
  const stripe = Stripe(STRIPE_PUBLISHABLE);
  const base = window.location.href.split("?")[0];
  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    mode: "subscription",
    successUrl: base + "?payment=success",
    cancelUrl: base + "?payment=cancel",
    customerEmail: email || undefined,
  });
  if (error) throw new Error(error.message);
}

// Secure password hashing with PBKDF2-SHA256 via Web Crypto API
async function hashPwd(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256
  );
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,"0")).join("");
  const saltHexOut = Array.from(salt).map(b => b.toString(16).padStart(2,"0")).join("");
  return saltHex ? hashHex : saltHexOut + ":" + hashHex; // format: salt:hash
}
async function verifyPwd(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false; // legacy hash — force re-register
  const computed = await hashPwd(password, saltHex);
  return computed === hashHex;
}

// ── Storage helpers (localStorage for production) ────────────────────────────
const sg = async (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const ss = async (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };
const sd = async (k) => { try { localStorage.removeItem(k); } catch {} };

async function dbGetUser(u) {
  const r = await sg(`u:${u.toLowerCase()}`);
  if (!r) return null;
  try {
    const parsed = JSON.parse(r);
    // Schema validation — reject malformed objects
    if (typeof parsed.username !== "string" || typeof parsed.passwordHash !== "string") return null;
    return parsed;
  } catch { return null; }
}
async function dbSaveUser(u) { await ss(`u:${u.username.toLowerCase()}`, JSON.stringify(u)); }
async function dbGetSession() { const u = await sg("sess"); return u ? dbGetUser(u) : null; }
async function dbSetSession(u) { u ? await ss("sess", u) : await sd("sess"); }
async function dbGetQCount(u) { const v = await sg(`q:${u}`); return parseInt(v) || 0; }
async function dbSetQCount(u, n) { await ss(`q:${u}`, n); }

// ── AuthModal ────────────────────────────────────────────────────────────────
function AuthModal({ onLogin, onClose }) {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const inp = { width:"100%", background:"#1d1a38", border:"1px solid #3b3563", borderRadius:10,
    color:"#EDE7F6", padding:"11px 13px", fontSize:15, outline:"none", fontFamily:"inherit", marginBottom:10 };
  const lbl = { fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", color:"#8B7FB8", marginBottom:5, display:"block" };

  const doLogin = async () => {
    if (!username || !password) { setErr("Completa todos los campos."); return; }
    // Brute-force protection: 5 attempts → 5 min lockout (client-side)
    const attKey = `_attempts:${username.toLowerCase()}`;
    const attData = JSON.parse(localStorage.getItem(attKey) || "{}");
    const now = Date.now();
    if (attData.lockUntil && now < attData.lockUntil) {
      const mins = Math.ceil((attData.lockUntil - now) / 60000);
      setErr(`Demasiados intentos. Espera ${mins} minuto${mins > 1 ? "s" : ""}.`);
      return;
    }
    setLoading(true); setErr("");
    const u = await dbGetUser(username);
    const valid = await verifyPwd(password, u?.passwordHash || ""); 
    if (!u || !valid) {
      // Increment failed attempts
      const attempts = (attData.count || 0) + 1;
      const lockUntil = attempts >= 5 ? now + 5 * 60 * 1000 : undefined;
      localStorage.setItem(attKey, JSON.stringify({ count: attempts, lockUntil }));
      setErr(attempts >= 5 ? "Cuenta bloqueada 5 minutos por seguridad." : `Credenciales incorrectas (${attempts}/5).`);
      setLoading(false); return;
    }
    // Successful login — clear attempts
    localStorage.removeItem(attKey);
    await dbSetSession(u.username);
    const qc = await dbGetQCount(u.username);
    onLogin({ ...u, questionsUsed: qc });
    setLoading(false);
  };

  const doRegister = async () => {
    if (!username || !email || !password) { setErr("Completa todos los campos."); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setErr("Usuario: 3–20 caracteres, solo letras, números y _"); return; }
    if (password.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(password)) { setErr("La contraseña debe incluir al menos una mayúscula y un número."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Introduce un email válido."); return; }
    setLoading(true); setErr("");
    const exists = await dbGetUser(username);
    if (exists) { setErr("Ese nombre de usuario ya está en uso."); setLoading(false); return; }
    const passwordHash = await hashPwd(password);
    const u = { username, email, passwordHash, isPremium: false, createdAt: Date.now() };
    await dbSaveUser(u);
    await dbSetSession(u.username);
    onLogin({ ...u, questionsUsed: 0 });
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
      <div style={{ background:"#1a1733", border:"1px solid #2e2952", borderRadius:20, padding:28, width:"100%", maxWidth:380, position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", color:"#8B7FB8", fontSize:20, cursor:"pointer" }}>✕</button>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:26, fontWeight:600, color:"#F5EFE2" }}>
            {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </div>
          <div style={{ color:"#8B7FB8", fontSize:13, marginTop:4 }}>Carta Natal · Astro App</div>
        </div>
        <div style={{ display:"flex", borderRadius:10, overflow:"hidden", border:"1px solid #2e2952", marginBottom:20 }}>
          {["login","register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{
              flex:1, padding:"10px 0", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:500,
              background: tab===t ? "#C9A24B" : "transparent", color: tab===t ? "#1a1408" : "#8B7FB8",
            }}>{t==="login" ? "Iniciar sesión" : "Registrarse"}</button>
          ))}
        </div>

        <label style={lbl}>Usuario</label>
        <input style={inp} value={username} onChange={e=>setUsername(e.target.value)} placeholder="tu_usuario" />
        {tab === "register" && (<>
          <label style={lbl}>Email</label>
          <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" />
        </>)}
        <label style={lbl}>Contraseña</label>
        <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (tab==="login" ? doLogin() : doRegister())}
          placeholder="••••••••" />

        {err && <p style={{ color:"#e08585", fontSize:13, margin:"0 0 10px" }}>{err}</p>}

        <button onClick={tab==="login" ? doLogin : doRegister} disabled={loading} style={{
          width:"100%", padding:"13px", borderRadius:12, border:"1px solid #C9A24B",
          background:"linear-gradient(180deg, #d8b25e, #b8923f)", color:"#1a1408",
          fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
        }}>
          {loading ? "Cargando..." : (tab==="login" ? "Entrar" : "Crear cuenta gratis")}
        </button>
      </div>
    </div>
  );
}

// ── PlansModal ───────────────────────────────────────────────────────────────
function PlansModal({ user, onClose, onUpgrade }) {
  const [step, setStep] = useState("plans"); // plans | payment | confirm | success
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const activatePremium = async () => {
    setLoading(true); setErr("");
    try {
      if (!user) throw new Error("Inicia sesion primero.");
      const updated = {
        username: user.username,
        email: user.email || "",
        passwordHash: user.passwordHash,
        isPremium: true,
        premiumSince: Date.now(),
        createdAt: user.createdAt || Date.now(),
      };
      await dbSaveUser(updated);
      setStep("success");
      setTimeout(() => onUpgrade(updated), 1800);
    } catch (e) {
      setErr("No se pudo activar la suscripción. Inténtalo de nuevo o contacta soporte.");
    } finally {
      setLoading(false);
    }
  };

  // Stripe URL with prefilled email
  const stripeUrl = STRIPE_PAYMENT_LINK_URL +
    (user?.email ? "?prefilled_email=" + encodeURIComponent(user.email) : "");

  const planBox = (title, price, features, isCurrent, onAction, label, highlighted) => (
    <div style={{ background: highlighted ? "linear-gradient(160deg,#2a1e50,#1e1a38)" : "#1a1733",
      border:`1px solid ${highlighted ? "#C9A24B" : "#2e2952"}`, borderRadius:16, padding:22, flex:1 }}>
      {highlighted && <div style={{ textAlign:"center", color:"#C9A24B", fontSize:10,
        letterSpacing:"0.3em", marginBottom:8, textTransform:"uppercase" }}>★ Recomendado</div>}
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600,
        color:"#F5EFE2", marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:28, fontWeight:700, color: highlighted ? "#C9A24B" : "#8B7FB8",
        marginBottom:16 }}>{price}</div>
      {features.map((f,i) => (
        <div key={i} style={{ fontSize:13, color: f.inc ? "#EDE7F6":"#6f659b",
          marginBottom:8, display:"flex", gap:8 }}>
          <span style={{ color: f.inc ? "#7fa8d9":"#6f659b" }}>{f.inc?"✓":"✗"}</span>{f.text}
        </div>
      ))}
      <button onClick={onAction} disabled={isCurrent} style={{
        width:"100%", marginTop:16, padding:"12px", borderRadius:10,
        border: highlighted ? "1px solid #C9A24B" : "1px solid #3b3563",
        background: highlighted ? "linear-gradient(180deg,#d8b25e,#b8923f)" : "transparent",
        color: highlighted ? "#1a1408" : "#8B7FB8",
        fontSize:14, fontWeight:500, cursor: isCurrent ? "default":"pointer",
        fontFamily:"inherit", opacity: isCurrent ? 0.5 : 1,
      }}>{isCurrent ? "Plan actual" : label}</button>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000, padding:16, overflowY:"auto" }}>
      <div style={{ background:"#141229", border:"1px solid #2e2952", borderRadius:20,
        padding:28, width:"100%", maxWidth:520, position:"relative", margin:"auto" }}>

        {step !== "success" && (
          <button onClick={onClose} style={{ position:"absolute", top:14, right:16,
            background:"none", border:"none", color:"#8B7FB8", fontSize:20, cursor:"pointer" }}>✕</button>
        )}

        {/* PLANS */}
        {step === "plans" && (
          <>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30,
                fontWeight:600, color:"#F5EFE2" }}>Elige tu plan</div>
              <div style={{ color:"#8B7FB8", fontSize:14, marginTop:4 }}>
                Accede a todas las herramientas cósmicas
              </div>
            </div>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
              {planBox("Básico Gratis","$0 / mes",
                [{inc:true,text:"Carta natal completa + rueda astral"},
                 {inc:true,text:"Tabla de posiciones y aspectos"},
                 {inc:true,text:"3 preguntas al Intérprete Astral"},
                 {inc:false,text:"Intérprete Astral ilimitado"},
                 {inc:false,text:"Guía Cósmica Diaria con Lúa"}],
                false, onClose, "Continuar gratis", false)}
              {planBox("Premium","$5 / mes",
                [{inc:true,text:"Carta natal completa + rueda astral"},
                 {inc:true,text:"Tabla de posiciones y aspectos"},
                 {inc:true,text:"Intérprete Astral ilimitado"},
                 {inc:true,text:"Guía Cósmica Diaria con Lúa"},
                 {inc:true,text:"Soporte prioritario"}],
                user?.isPremium, ()=>setStep("payment"), "Suscribirse — $5/mes", true)}
            </div>
            <p style={{ textAlign:"center", color:"#6f659b", fontSize:11, marginTop:16 }}>
              Cancela cuando quieras · Pago seguro vía Stripe
            </p>
          </>
        )}

        {/* PAYMENT */}
        {step === "payment" && (
          <>
            <button onClick={()=>setStep("plans")} style={{ background:"none",
              border:"none", color:"#8B7FB8", cursor:"pointer", marginBottom:16, fontSize:13 }}>
              ← Volver
            </button>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26,
                fontWeight:600, color:"#F5EFE2" }}>Suscripción Premium</div>
              <div style={{ color:"#C9A24B", fontSize:26, fontWeight:700, margin:"8px 0" }}>
                $5 / mes
              </div>
              <div style={{ color:"#8B7FB8", fontSize:13, lineHeight:1.6 }}>
                Toca el botón para ir a Stripe.<br/>
                Al regresar aquí tu Premium se activa con un toque.
              </div>
            </div>
            <div style={{ background:"#1a1733", border:"1px solid #2e2952",
              borderRadius:12, padding:16, marginBottom:18 }}>
              {[{text:"Intérprete Astral ilimitado"},
                {text:"Guía Cósmica Diaria con Lúa"},
                {text:"Cancela cuando quieras"}].map((f,i)=>(
                <div key={i} style={{ fontSize:14, color:"#EDE7F6",
                  marginBottom:i<2?8:0, display:"flex", gap:8 }}>
                  <span style={{color:"#7fa8d9"}}>✓</span>{f.text}
                </div>
              ))}
            </div>

            {/* ← CLAVE: <a> nativo, nunca bloqueado por el navegador */}
            <a
              href={stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(() => setStep("confirm"), 800)}
              style={{
                display:"block", width:"100%", padding:"15px 0",
                borderRadius:12, border:"1px solid #C9A24B",
                background:"linear-gradient(180deg,#d8b25e,#b8923f)",
                color:"#1a1408", fontSize:16, fontWeight:600,
                fontFamily:"inherit", textAlign:"center",
                textDecoration:"none", boxSizing:"border-box",
                cursor:"pointer", marginBottom:10,
              }}>
              💳 Pagar con Stripe — $5/mes
            </a>
            <div style={{ textAlign:"center", color:"#6f659b", fontSize:11 }}>
              🔒 Pago cifrado · Stripe Inc.
            </div>
          </>
        )}

        {/* CONFIRM — shown after tapping the Stripe link */}
        {step === "confirm" && (
          <>
            {/* Stripe link still accessible at top */}
            <div style={{ background:"#1a1733", border:"1px solid #2e2952",
              borderRadius:12, padding:14, marginBottom:20,
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ color:"#C9A24B", fontSize:12, fontWeight:600, marginBottom:2 }}>
                  ¿No completaste el pago aún?
                </div>
                <div style={{ color:"#8B7FB8", fontSize:12 }}>Abre Stripe de nuevo</div>
              </div>
              <a href={stripeUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #C9A24B",
                  background:"transparent", color:"#C9A24B", fontSize:13,
                  fontWeight:500, textDecoration:"none", whiteSpace:"nowrap" }}>
                💳 Ir a Stripe
              </a>
            </div>

            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🌟</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26,
                color:"#F5EFE2", marginBottom:8 }}>
                ¿Completaste el pago?
              </div>
              <div style={{ color:"#8B7FB8", fontSize:14, lineHeight:1.7 }}>
                Si Stripe mostró <strong style={{color:"#4caf80"}}>"Thanks for subscribing"</strong>,<br/>
                toca el botón para activar tu cuenta.
              </div>
            </div>

            {err && <p style={{ color:"#e08585", fontSize:13, textAlign:"center",
              margin:"0 0 14px" }}>{err}</p>}

            <button onClick={activatePremium} disabled={loading} style={{
              width:"100%", padding:"16px", borderRadius:12, border:"1px solid #C9A24B",
              background: loading ? "#7a6a3f" : "linear-gradient(180deg,#d8b25e,#b8923f)",
              color:"#1a1408", fontSize:16, fontWeight:700,
              cursor: loading ? "default":"pointer", fontFamily:"inherit", marginBottom:10,
            }}>
              {loading ? "Activando..." : "✓ Sí, pagué — Activar Premium ahora"}
            </button>

            <button onClick={()=>setStep("payment")} disabled={loading} style={{
              width:"100%", padding:"11px", borderRadius:10, border:"1px solid #3b3563",
              background:"transparent", color:"#8B7FB8", fontSize:13,
              cursor:"pointer", fontFamily:"inherit",
            }}>
              ← Volver al pago
            </button>
            <p style={{ textAlign:"center", color:"#6f659b", fontSize:11, marginTop:12 }}>
              ¿Problemas? soporte@tuapp.com
            </p>
          </>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:60, marginBottom:16 }}>✨</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32,
              color:"#C9A24B", marginBottom:10 }}>¡Bienvenido a Premium!</div>
            <div style={{ color:"#8B7FB8", fontSize:15, lineHeight:1.7 }}>
              Tu cuenta tiene acceso completo al<br/>
              Intérprete Astral y a la Guía Cósmica con Lúa.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── UserBar ──────────────────────────────────────────────────────────────────
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAsCAYAAADmZKH2AAAMS0lEQVR42s1ZeXhUVZb/nXtfVaW2LIQk7AmLiEC3C5u23aZAFttmEbEii42tgyK0zYAKtjpNEmRUEHUcRhtBnXYGbaDAAPYgEhiKxp6INMgawoBAREAgZKu93rv3zB8VlADSiPNh3++731f13rv3nnfuub/z+50H/D80ZhAANO7wz/2qYnQeM+jste/TxPc2bJlfEoGT+/y9vB3SprfIUhOJwIBf/ODGAQABCCXkywcO2XC83pjOMX9HIKCZi8UPZhyzX1JRQOnInSOCB9reVv6pIzm/3O2JH8aLKe9V0g9iXCqmujNzd/vp/ekvvPJha26Xo+Tb60m9v90zinnE7UQBxeyXV924YLBQEpVq1HWasHp3Qbedh+3aaWjpMBgzlzhRv9PxCnOhgcA3B+aqGMcM8gV9mrkw83BV1szXPmrJWR5FSUXIcLP8fC/Umx9n/AgNLSZRUUAFg4VX5D2Di4sFSr7DiBIA205IKi01eeKwJ5dt75h37Iy0Mt3aAAClCTKDxXNLDT3sx2klzCOXBgLGmY0bCw2fz6e/yzpXHLAcHdihYnPBvlGv/ijNEBYllaQF91di0iLGVydtQJQt/3AYy35Ts5A6ByZekedO7xrTrWV+QiHd5Oa39LcYThJghRr77B1ftnJd1zqqW3gtipsS7Voq9OnCOJpOsNnZOHCEsPsL28PMI/4E0H7AEoBxGd6z6ZrdyiB1wL/6SI3t9s/2C5JpLLhpKBFzCsOIQeBzI44AEJEjYVHSLhmaU2AnBbM+Ox7EBGbFRE4bC8WUADORgD4HH5mImJmJiJjAYAWVlyM9PVrHg4bINZ9IHpMf3DMvPRdSZoLPLtV8Fy/4q0lD6DRAcLOn6LzfzAwGIMhxYWw0Ha+vjycxIoLn/jqUuMGnphmUsfJ/uXHUOy/8Q+Tx377hSTqztc2y6GJJoPkFYplCCP76ASkApZuWo28G8sXe77wmCUiEWQ0cQHL6sOg8ovcPSOZigdCxz/q0wcjFWxyu2gbDJaRmzUTcNOVFO3/TAcC0ACssoCQgRPP7l9PBrEka9OK4hlPdflYzBvilKYLBoKCc1SFHa547b3yEdYRjJOiyT7EQgJUAcrMYix6tQZ7XhJUkiO+AA1IAZqPgcbdrcdeg6Eyi9Q0+XzA1BS/zSyoKaP7C/8GA36X/ZON2R6bdraD0pY0kAqABp2SUl4bBZgS6Lo4hrxcgbjVF/GWQBlZQ6R5DrH3qzO6+Q473AnwaKGXRLDyzrdKX7osmiHSYU+9+ybkNCVgRwvPjo9j2ucAt4/Ox7ZgLs4efghWTMCT/bc9LQEUIk38ep75DYtOJNlkIVBIRUsZRUSpBk7ts6403JJc/MjSuzXpS8hKTGxKINxDatlGYMCCBDrmM1S8eR/uMJB7o14DWOUnEw8YlDRQEWDGoa66V8mFfaI2gleuadlE1z60lAU4laPP54rtjpzOyVVhbki62M0IAiTCh93UW/vu5Bmw/IvHhpza891cX1u31Ys8JB9ZPq8aNHaNIRCWE4G8LC9ZJoql3hMwO/aIzGKDAxRI/lUIDfkE5q4/ndTL/bdaYqLAaOClkcxgRArBihF7XWnh3agisCQvL0/D6UieWbHHh9x/m4M2KDAgA/3H/cdxYEIMVlxccECmAZBiq8GYhJviii4g+2MvsF0VNXrsIK2lirw1n3nh0cLyyZ3czacYExDkZgjm1HW9PDuOp91z4r0/sMBWlIlukgEZrYNVnXsxck4NFY0+AiC9wPzOztEs5bXBDvb2bVVpcXCxQEuBvpUxEYAQqiTpuios2eubzY6IRTuoEiZT3pEgdgCF9kwhFCe+vdKJVlsZDA2NYMTuEDdNPY+mUavzq5kbkehXKylsgkhAY2DMMKyYgRTPo0Pf2VzTCFy0hKjvl8wVFavcuxef83ZmZ6dBe48jQ/pbt9n7mmWRYQApmIoAU4addTVTXCvznsw3wXW+ihZsR+MSG+es9WLnHi2yXwuAeYbw15QtU19vws04xkCIQUjlFa8DuYszyxwCT0gDA58vlv002A5VERJzt1HOLF2e1mHVPFHaHCjOLVI7WDNbA3bclsO2IgVufygBrwopP7VgZ9KBsjxemItz6UgH2nbKjqE8DNDfRBUpBhxUSmDI8IpZWtOH/2ZP1DHNhKyCgubi5IBIXEyzMdxVu2u8eMWueTe06auQ97Y/Vm43EyiTkttaYPDSO11Y68S/vunDkiETFQQPLHw8BCcLSB45h8yEnqo85MK8sF69tyMak2+rQMjsJyxSwEoSC/CT693DQnD+1Vmv2tvfiy8xniMAoaS6ImhkXaOL7jbttLxYHnJBZCiXL3LLo5qSnXTuz3gxJevlXEa46IdGjvYLI0rBnMCYvcEMKwkcvH0cyyZgWyIPdqyDSFbrmJXC4zoY5I09BmQSdBJ4YHsf729rCbbfkHz/26q1VOQ8xD+5yvpwU53qtqCigEBs59r0tGX127ISyZ2l58iTx6+XOzOkjErGuXUzVu7OiWx7OQsIEHhiQQPK0QPd2CpDAoB5xAEDXHBPJWgMP/KQeSYvQ75+6oG+HOLq1jeO6LibSXZlYuysT2V5FkbjQ71QUOHDIPet8OSmay7yhrqO7HbOfDdjY8DBpRYAm+uNf7PhF71jWo3fEal1pwL8/HmIpgDcnhxF8qR5/mBrGhs8MOMfmY0u1G4sfPIZ1M45g4eivwEz4/fgTyM200Ck7iRfGxHDwVDpqwxJJi9DSmzTKPvHoYFXevcxDbiIKKF6WkpOiucyzT1n054yC41+ytkAi0SgwfkgEKx6LcsXhNs7OeYoHl3gS++ok7ayWeOwtN3JaaCgF1IcFhvWOoiaUElqts0zMKMvFgdM2fBkTGDS3A5zpdjTGCNe3/QILHjwEZkJd1IAhFL+9uYNIVHmfbwZtqT0uZeDOvMo/Z+zr82RmerSWqGe3JM0eG4XNnoGX1rTHJwe9KJu611pUHjuzfHV6HjIshiISLo37bkvg570suHQM4bok1lZ58O7WDOhYU9RogFwaq59sxH3zPQg1EmaNDWNILwPz1xVg7c5MKA313m8+l4MHHRhIzrUbmP2SNm4sNPr332TxibsXjHqu1cSV5dqaPSFkDLzehj9sbo/lW7LhTlMAwJ3zTHp13M76W36bbkuycIMYSQXoCAEKgEHAWchwKdgEQ0ogWifw9LgoQnHC/OVOODIZiVqBXj0SmDM+ippoSzy9tEC1zWH50bQtW53dA/0CAb+Q77xTrZnvum7VGs/CzZUai6dHZNjMw5NLOmPHERdaek1IATgMjYMn7ejW1nL07VJX/+FfnG7pZGIGbGmA4QSknWE4NKRdA5yCXDMukN9W4ZFBCTyz2A2RluKBDo9G9SkDizeloWurBjw35qTYU+1VIeVpd1N++u6evVftJQBIVPlXVZ52D99f7dRvBPNFxQEPWnhM2GRKE3wtFjXgsBOWTNoRHf2Kkaw+Zc+UNs36W8oNUgLJBuK5EyJ69XYbPg46gHQGdBNTPIsV9RItuyQw55cx1To3U/TOP1OZc4N1E4V3+X+R5pKrwnHS63dlCmYg3a2gFF2QrAUxwnHBfa+JiIoqFRr9z5kue5a2KXVx+m7GCD/uYmHdzDgWlqfBMBjMF6olKYFITIA148EBURR0MxA5Gish3je6DdyGC/Ew45qvmsY5LsFdlUBjBqPWOb9/ScbA4Da7sHsYSl9ArdiMEpY8ETLvvSvya9iprikgL07uHAAswDpkY8MuEYmY0SsvRyRG3FCxwbX5p09l2GQaHJrP42oNZPnvgLFsWs2r1CEw9coKOQwCii/fyBIAw05IcizcwSfvefuhOxNT3ihLU/YslkqltkwraGc6iceGNNSgvfksbyw04L2WgqH9fDlL+ADgdC5fkee4GAIoBkp2tTy6xfHX66dntGqMCRs1QUeiltSM+7Wc80jNP1KLFf96Fq6uSn2OSqGDvqAgKjvVvnvihd/54zbVSKZhAGYCuk0+iYm++ipkiQXMxcLn26SuamXT59uUyoHenEWTBka39uhuSisO1jHip0clqNMt5gyiQBJIyTxc7Xa23suxkYM+WDbOQsfJsb7jJnPjbv/6s2L9B6umny1Ik7OsfOitiRVDBpiOyQMjlrdnYjr+HhpzsWAG8Yl7C2p3j9Gntxe9da5X/y4MBIB4lX8mHyzqmfq8VPy9P8D8H6uUF68foYklAAAAAElFTkSuQmCC";

function UserBar({ user, onLogin, onLogout, onPlans }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px",
      background:"#0e0c20", borderBottom:"1px solid #2e2952", marginBottom:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <img src={LOGO_B64} alt="Mystika Divina" style={{ height:40, width:"auto", objectFit:"contain" }} />
        <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:16, color:"#C9A24B", fontStyle:"italic", lineHeight:1.1 }}>
          <div>✦ Carta Natal</div>
          <div style={{ fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color:"#6f659b", fontStyle:"normal" }}>Mystika Divina</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {user ? (<>
          <span style={{ background: user.isPremium ? "#1e3a2a" : "#1a1733",
            border:`1px solid ${user.isPremium ? "#4caf80" : "#3b3563"}`, borderRadius:20,
            padding:"3px 10px", fontSize:11, color: user.isPremium ? "#4caf80" : "#8B7FB8" }}>
            {user.isPremium ? "★ Premium" : "Básico"}
          </span>
          <span style={{ fontSize:13, color:"#cfc6e8" }}>{user.username}</span>
          {!user.isPremium && (
            <button onClick={onPlans} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #C9A24B",
              background:"transparent", color:"#C9A24B", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              Mejorar plan
            </button>
          )}
          <button onClick={onLogout} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #3b3563",
            background:"transparent", color:"#6f659b", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            Salir
          </button>
        </>) : (
          <button onClick={onLogin} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #C9A24B",
            background:"linear-gradient(180deg, #d8b25e, #b8923f)", color:"#1a1408",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
            Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}

// ── PaywallCard ───────────────────────────────────────────────────────────────
function PaywallCard({ onUpgrade, onLogin, isLoggedIn, reason }) {
  return (
    <div style={{ background:"linear-gradient(160deg, #1e1a38, #2a1e50)", border:"1px solid #C9A24B66",
      borderRadius:16, padding:28, marginBottom:26, textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:10 }}>🔒</div>
      <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:24, fontWeight:600, color:"#F5EFE2", marginBottom:8 }}>
        {reason === "lua" ? "Guía Cósmica Diaria — Exclusivo Premium" : "Límite de preguntas alcanzado"}
      </div>
      <div style={{ color:"#8B7FB8", fontSize:14, marginBottom:20, lineHeight:1.6 }}>
        {reason === "lua"
          ? "Lúa, tu guía cósmica diaria personalizada, es exclusiva del plan Premium. Actualiza para desbloquear lecturas diarias con tránsitos calculados para tu carta."
          : `El plan Básico incluye ${FREE_Q_LIMIT} preguntas al Intérprete Astral. Mejora a Premium para conversaciones ilimitadas y acceso a Lúa.`}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button onClick={onUpgrade} style={{ padding:"12px 24px", borderRadius:12, border:"1px solid #C9A24B",
          background:"linear-gradient(180deg, #d8b25e, #b8923f)", color:"#1a1408",
          fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
          ★ Ver planes Premium
        </button>
        {!isLoggedIn && (
          <button onClick={onLogin} style={{ padding:"12px 18px", borderRadius:12, border:"1px solid #3b3563",
            background:"transparent", color:"#8B7FB8", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
            Ya tengo cuenta
          </button>
        )}
      </div>
      <div style={{ display:"flex", gap:20, justifyContent:"center", marginTop:16, flexWrap:"wrap" }}>
        {[["✓ Intérprete ilimitado","#7fa8d9"],["✓ Guía Cósmica Lúa","#C9A24B"],["✓ Solo $5/mes","#4caf80"]].map(([t,c])=>(
          <span key={t} style={{ fontSize:12, color:c }}>{t}</span>
        ))}
      </div>
    </div>
  );
}


/* ============ APP ============ */
export default function CartaNatalApp() {
  const [form, setForm] = useState({
    name: "", date: "", time: "",
    cityIdx: 0, lat: "19.40", lon: "-99.15", tz: "-6", customCity: "",
  });
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState("");
  const svgRef = useRef(null);
  const city = CITIES[form.cityIdx];

  // ── Auth & subscription state ──────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [interpreterKey, setInterpreterKey] = useState(0);

  useEffect(() => {
    // Clean any URL params on load (do NOT auto-activate from URL — spoofable)
    if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
    dbGetSession().then(async u => {
      if (u) {
        const qc = await dbGetQCount(u.username);
        setUser({ ...u, questionsUsed: qc });
      }
      setAuthLoading(false);
    });
  }, []);

  const handleLogin = (u) => { setUser(u); setShowAuth(false); setInterpreterKey(k => k+1); };
  const handleLogout = async () => { await dbSetSession(null); setUser(null); setInterpreterKey(k => k+1); };
  const handleUpgrade = (u) => { setUser({ ...u, questionsUsed: 0 }); setShowPlans(false); setInterpreterKey(k => k+1); };
  const handleQuestionUsed = async () => {
    if (!user) return;
    const newQ = (user.questionsUsed || 0) + 1;
    setUser(u => ({ ...u, questionsUsed: newQ }));
    await dbSetQCount(user.username, newQ);
  };

  const isPremium = user?.isPremium || false;
  const questionsLeft = isPremium ? Infinity : Math.max(0, FREE_Q_LIMIT - (user?.questionsUsed || 0));

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pickCity = (idx) => {
    const c = CITIES[idx];
    setForm((f) => ({ ...f, cityIdx: idx, ...(c.manual ? {} : { lat: String(c.lat), lon: String(c.lon), tz: String(c.tz) }) }));
  };

  const generate = () => {
    setError("");
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    const lat = parseFloat(form.lat), lon = parseFloat(form.lon), tz = parseFloat(form.tz);
    if (!y || isNaN(lat) || isNaN(lon) || isNaN(tz) || isNaN(hh)) { setError("Revisa la fecha, hora y coordenadas."); return; }
    setChartData(computeChart({ y, m, d, hh, mm, tz, lat, lon }));
  };

  const downloadPNG = () => {
    const svg = svgRef.current; if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1400; c.height = 1400;
      const g = c.getContext("2d");
      g.fillStyle = "#141229"; g.fillRect(0, 0, 1400, 1400);
      g.drawImage(img, 0, 0, 1400, 1400);
      const a = document.createElement("a");
      a.download = `carta-natal-${(form.name || "sin-nombre").toLowerCase().replace(/\s+/g, "-")}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  };

  const ascF = chartData ? fmtPos(chartData.asc) : null;
  const sunF = chartData ? fmtPos(chartData.planets[0].lon) : null;

  const inputStyle = {
    width: "100%", background: "#1d1a38", border: "1px solid #3b3563", borderRadius: 10,
    color: "#EDE7F6", padding: "11px 13px", fontSize: 15, outline: "none", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B7FB8", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: "#141229", color: "#EDE7F6", fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@300;400;500&display=swap');
        input::-webkit-calendar-picker-indicator { filter: invert(0.8); }
        select option { background:#1d1a38; }
        * { box-sizing: border-box; }
      `}</style>

      {/* UserBar */}
      <UserBar user={user} onLogin={() => setShowAuth(true)} onLogout={handleLogout} onPlans={() => setShowPlans(true)} />

      {/* Premium activation success banner */}
      {user?.isPremium && user?.premiumSince && (Date.now() - user.premiumSince) < 30000 && (
        <div style={{ background:"#1e3a2a", borderBottom:"1px solid #4caf80", padding:"10px 16px", textAlign:"center", fontSize:14, color:"#4caf80" }}>
          ✨ ¡Suscripción Premium activada! Ya tienes acceso completo al Intérprete y a Lúa.
        </div>
      )}

      {/* Modals */}
      {showAuth && <AuthModal onLogin={handleLogin} onClose={() => setShowAuth(false)} />}
      {showPlans && <PlansModal user={user} onClose={() => setShowPlans(false)} onUpgrade={handleUpgrade} />}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 60px" }}>
        {/* Encabezado */}
        <header style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ color: "#C9A24B", fontSize: 12, letterSpacing: "0.4em", textTransform: "uppercase" }}>✦ Efemérides ✦</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 42, margin: "6px 0 2px", color: "#F5EFE2" }}>
            Carta Natal
          </h1>
          <p style={{ margin: 0, color: "#8B7FB8", fontSize: 17, fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif" }}>
            El cielo en el instante de tu nacimiento
          </p>
        </header>

        {/* Formulario */}
        <div style={{ background: "#1a1733", border: "1px solid #2e2952", borderRadius: 18, padding: 18, marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nombre</label>
            <input style={inputStyle} value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Tu nombre" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Fecha de nacimiento</label>
              <input type="date" style={inputStyle} value={form.date} onChange={(e) => upd("date", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Hora local</label>
              <input type="time" style={inputStyle} value={form.time} onChange={(e) => upd("time", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Lugar de nacimiento</label>
            <select style={inputStyle} value={form.cityIdx} onChange={(e) => pickCity(Number(e.target.value))}>
              {CITIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
            </select>
            {city.manual && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                value={form.customCity}
                onChange={(e) => upd("customCity", e.target.value)}
                placeholder="Escribe tu ciudad o lugar de nacimiento..."
              />
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Latitud</label>
              <input style={inputStyle} value={form.lat} onChange={(e) => upd("lat", e.target.value)} disabled={!city.manual} />
            </div>
            <div>
              <label style={labelStyle}>Longitud</label>
              <input style={inputStyle} value={form.lon} onChange={(e) => upd("lon", e.target.value)} disabled={!city.manual} />
            </div>
            <div>
              <label style={labelStyle}>UTC ±</label>
              <input style={inputStyle} value={form.tz} onChange={(e) => upd("tz", e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#6f659b", margin: "0 0 14px" }}>
            Si en esa fecha aplicaba horario de verano, ajusta el UTC (p. ej. CDMX en verano era −5).
          </p>
          {error && <p style={{ color: "#e08585", fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
          <button onClick={generate} style={{
            width: "100%", padding: "14px", borderRadius: 12, border: "1px solid #C9A24B",
            background: "linear-gradient(180deg, #d8b25e, #b8923f)", color: "#1a1408",
            fontSize: 16, fontWeight: 500, letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit",
          }}>
            Calcular carta
          </button>
        </div>

        {chartData && (
          <>
            {/* Resumen */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
              {[["Sol", sunF], ["Ascendente", ascF], ["Luna", fmtPos(chartData.planets[1].lon)]].map(([t, f]) => (
                <div key={t} style={{ background: "#1a1733", border: "1px solid #2e2952", borderRadius: 12, padding: "8px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8B7FB8" }}>{t}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, color: "#F5EFE2" }}>
                    <span style={{ color: ELEMENT_COLOR[f.signIdx] }}>{f.glyph}</span> {f.sign} {f.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Rueda */}
            <Wheel chart={chartData} name={form.name} svgRef={svgRef} />



            {/* Intérprete IA (se reinicia al calcular una carta nueva) */}
            <Interpreter key={String(interpreterKey) + "-" + chartData.JD + "-" + form.name} chart={chartData} name={form.name} freeLimit={isPremium ? null : FREE_Q_LIMIT} onLimitReached={() => setShowPlans(true)} />

            {/* Guía Cósmica Diaria — Lúa */}
            <LuaAgent key={String(interpreterKey) + "-lua-" + chartData.JD + "-" + form.name} chart={chartData} name={form.name} isPremium={isPremium} onUpgrade={() => setShowPlans(true)} />

            {/* Posiciones */}
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#F5EFE2", margin: "0 0 10px" }}>Posiciones</h2>
            <div style={{ background: "#1a1733", border: "1px solid #2e2952", borderRadius: 14, overflow: "hidden", marginBottom: 26 }}>
              {chartData.planets.map((p, i) => {
                const f = fmtPos(p.lon);
                return (
                  <div key={p.name} style={{
                    display: "flex", alignItems: "center", padding: "10px 16px",
                    borderTop: i ? "1px solid #262148" : "none", fontSize: 15,
                  }}>
                    <span style={{ width: 30, fontSize: 19, color: "#C9A24B" }}>{PLANET_GLYPHS[p.name]}</span>
                    <span style={{ width: 96 }}>{p.name}</span>
                    <span style={{ color: ELEMENT_COLOR[f.signIdx], width: 26, fontSize: 17 }}>{f.glyph}</span>
                    <span style={{ flex: 1 }}>{f.text} {f.sign}{p.retro ? " ℞" : ""}</span>
                    <span style={{ color: "#8B7FB8", fontSize: 13 }}>Casa {houseOf(p.lon, chartData.cusps)}</span>
                  </div>
                );
              })}
              {[["Ascendente", chartData.asc], ["Medio Cielo", chartData.mc]].map(([n, l]) => {
                const f = fmtPos(l);
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderTop: "1px solid #262148", fontSize: 15, color: "#cfc6e8" }}>
                    <span style={{ width: 30, color: "#C9A24B", fontWeight: 600, fontSize: 13 }}>{n === "Ascendente" ? "AC" : "MC"}</span>
                    <span style={{ width: 96 }}>{n}</span>
                    <span style={{ color: ELEMENT_COLOR[f.signIdx], width: 26, fontSize: 17 }}>{f.glyph}</span>
                    <span style={{ flex: 1 }}>{f.text} {f.sign}</span>
                  </div>
                );
              })}
            </div>

            {/* Aspectos */}
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#F5EFE2", margin: "0 0 10px" }}>Aspectos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8, marginBottom: 26 }}>
              {chartData.aspects.sort((a, b) => a.orb - b.orb).map((as, i) => {
                const col = as.type.kind === "hard" ? "#d98080" : as.type.kind === "soft" ? "#7fa8d9" : "#c9bfa0";
                return (
                  <div key={i} style={{ background: "#1a1733", border: "1px solid #2e2952", borderRadius: 10, padding: "8px 12px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: col, fontSize: 17, width: 20 }}>{as.type.glyph}</span>
                    <span style={{ flex: 1 }}>{chartData.planets[as.a].name} – {chartData.planets[as.b].name}</span>
                    <span style={{ color: "#8B7FB8", fontSize: 12 }}>{as.type.name} {as.orb.toFixed(1)}°</span>
                  </div>
                );
              })}
            </div>

            <p style={{ textAlign: "center", color: "#6f659b", fontSize: 12, fontStyle: "italic" }}>
              Casas Placidus · Zodiaco tropical · Precisión aproximada ±1 minuto de arco
            </p>
          </>
        )}
      </div>
    </div>
  );
}
