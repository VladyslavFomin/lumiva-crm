/**
 * География для блока «Карта» в аналитике: сопоставление названий стран из данных (ru/en/tr,
 * ISO-коды, частые синонимы) с фигурами world-atlas 110m, континенты и готовые виды карты.
 */

export const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export type ContinentCode = 'EU' | 'AS' | 'AF' | 'NA' | 'SA' | 'OC';
export type MapRegionScope = 'world' | 'europe' | 'asia' | 'africa' | 'north_america' | 'south_america' | 'oceania';
/** 'world' | континент | `country:DE` */
export type MapScope = MapRegionScope | `country:${string}`;

export const REGION_SCOPES: MapRegionScope[] = [
  'world',
  'europe',
  'asia',
  'north_america',
  'south_america',
  'africa',
  'oceania',
];

const SCOPE_CONTINENT: Record<Exclude<MapRegionScope, 'world'>, ContinentCode> = {
  europe: 'EU',
  asia: 'AS',
  africa: 'AF',
  north_america: 'NA',
  south_america: 'SA',
  oceania: 'OC',
};

/** Вид карты (Mercator, см. MAP_PROJECTION) для мира и континентов. */
export const REGION_VIEWS: Record<MapRegionScope, { center: [number, number]; zoom: number }> = {
  world: { center: [12, 22], zoom: 1 },
  europe: { center: [18, 52], zoom: 3.1 },
  asia: { center: [92, 32], zoom: 1.8 },
  north_america: { center: [-92, 42], zoom: 1.9 },
  south_america: { center: [-60, -22], zoom: 2.3 },
  africa: { center: [18, 2], zoom: 2.1 },
  oceania: { center: [150, -25], zoom: 2.6 },
};

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 440;
export const MAP_SCALE = 128;

/** world-atlas 110m: числовой ISO-код (или имя, если кода нет) → [ISO-2, континенты]. */
const ATLAS: Record<string, [string, ContinentCode[]]> = {
  '242': ['FJ', ['OC']], '834': ['TZ', ['AF']], '732': ['EH', ['AF']], '124': ['CA', ['NA']],
  '840': ['US', ['NA']], '398': ['KZ', ['AS']], '860': ['UZ', ['AS']], '598': ['PG', ['OC']],
  '360': ['ID', ['AS']], '032': ['AR', ['SA']], '152': ['CL', ['SA']], '180': ['CD', ['AF']],
  '706': ['SO', ['AF']], '404': ['KE', ['AF']], '729': ['SD', ['AF']], '148': ['TD', ['AF']],
  '332': ['HT', ['NA']], '214': ['DO', ['NA']], '643': ['RU', ['EU', 'AS']], '044': ['BS', ['NA']],
  '238': ['FK', ['SA']], '578': ['NO', ['EU']], '304': ['GL', ['NA']], '260': ['TF', []],
  '626': ['TL', ['AS']], '710': ['ZA', ['AF']], '426': ['LS', ['AF']], '484': ['MX', ['NA']],
  '858': ['UY', ['SA']], '076': ['BR', ['SA']], '068': ['BO', ['SA']], '604': ['PE', ['SA']],
  '170': ['CO', ['SA']], '591': ['PA', ['NA']], '188': ['CR', ['NA']], '558': ['NI', ['NA']],
  '340': ['HN', ['NA']], '222': ['SV', ['NA']], '320': ['GT', ['NA']], '084': ['BZ', ['NA']],
  '862': ['VE', ['SA']], '328': ['GY', ['SA']], '740': ['SR', ['SA']], '250': ['FR', ['EU']],
  '218': ['EC', ['SA']], '630': ['PR', ['NA']], '388': ['JM', ['NA']], '192': ['CU', ['NA']],
  '716': ['ZW', ['AF']], '072': ['BW', ['AF']], '516': ['NA', ['AF']], '686': ['SN', ['AF']],
  '466': ['ML', ['AF']], '478': ['MR', ['AF']], '204': ['BJ', ['AF']], '562': ['NE', ['AF']],
  '566': ['NG', ['AF']], '120': ['CM', ['AF']], '768': ['TG', ['AF']], '288': ['GH', ['AF']],
  '384': ['CI', ['AF']], '324': ['GN', ['AF']], '624': ['GW', ['AF']], '430': ['LR', ['AF']],
  '694': ['SL', ['AF']], '854': ['BF', ['AF']], '140': ['CF', ['AF']], '178': ['CG', ['AF']],
  '266': ['GA', ['AF']], '226': ['GQ', ['AF']], '894': ['ZM', ['AF']], '454': ['MW', ['AF']],
  '508': ['MZ', ['AF']], '748': ['SZ', ['AF']], '024': ['AO', ['AF']], '108': ['BI', ['AF']],
  '376': ['IL', ['AS']], '422': ['LB', ['AS']], '450': ['MG', ['AF']], '275': ['PS', ['AS']],
  '270': ['GM', ['AF']], '788': ['TN', ['AF']], '012': ['DZ', ['AF']], '400': ['JO', ['AS']],
  '784': ['AE', ['AS']], '634': ['QA', ['AS']], '414': ['KW', ['AS']], '368': ['IQ', ['AS']],
  '512': ['OM', ['AS']], '548': ['VU', ['OC']], '116': ['KH', ['AS']], '764': ['TH', ['AS']],
  '418': ['LA', ['AS']], '104': ['MM', ['AS']], '704': ['VN', ['AS']], '408': ['KP', ['AS']],
  '410': ['KR', ['AS']], '496': ['MN', ['AS']], '356': ['IN', ['AS']], '050': ['BD', ['AS']],
  '064': ['BT', ['AS']], '524': ['NP', ['AS']], '586': ['PK', ['AS']], '004': ['AF', ['AS']],
  '762': ['TJ', ['AS']], '417': ['KG', ['AS']], '795': ['TM', ['AS']], '364': ['IR', ['AS']],
  '760': ['SY', ['AS']], '051': ['AM', ['AS', 'EU']], '752': ['SE', ['EU']], '112': ['BY', ['EU']],
  '804': ['UA', ['EU']], '616': ['PL', ['EU']], '040': ['AT', ['EU']], '348': ['HU', ['EU']],
  '498': ['MD', ['EU']], '642': ['RO', ['EU']], '440': ['LT', ['EU']], '428': ['LV', ['EU']],
  '233': ['EE', ['EU']], '276': ['DE', ['EU']], '100': ['BG', ['EU']], '300': ['GR', ['EU']],
  '792': ['TR', ['EU', 'AS']], '008': ['AL', ['EU']], '191': ['HR', ['EU']], '756': ['CH', ['EU']],
  '442': ['LU', ['EU']], '056': ['BE', ['EU']], '528': ['NL', ['EU']], '620': ['PT', ['EU']],
  '724': ['ES', ['EU']], '372': ['IE', ['EU']], '540': ['NC', ['OC']], '090': ['SB', ['OC']],
  '554': ['NZ', ['OC']], '036': ['AU', ['OC']], '144': ['LK', ['AS']], '156': ['CN', ['AS']],
  '158': ['TW', ['AS']], '380': ['IT', ['EU']], '208': ['DK', ['EU']], '826': ['GB', ['EU']],
  '352': ['IS', ['EU']], '031': ['AZ', ['AS', 'EU']], '268': ['GE', ['AS', 'EU']], '608': ['PH', ['AS']],
  '458': ['MY', ['AS']], '096': ['BN', ['AS']], '705': ['SI', ['EU']], '246': ['FI', ['EU']],
  '703': ['SK', ['EU']], '203': ['CZ', ['EU']], '232': ['ER', ['AF']], '392': ['JP', ['AS']],
  '600': ['PY', ['SA']], '887': ['YE', ['AS']], '682': ['SA', ['AS']], '010': ['AQ', []],
  '196': ['CY', ['EU']], '504': ['MA', ['AF']], '818': ['EG', ['AF']], '434': ['LY', ['AF']],
  '231': ['ET', ['AF']], '262': ['DJ', ['AF']], '800': ['UG', ['AF']], '646': ['RW', ['AF']],
  '070': ['BA', ['EU']], '807': ['MK', ['EU']], '688': ['RS', ['EU']], '499': ['ME', ['EU']],
  '780': ['TT', ['NA']], '728': ['SS', ['AF']],
  // без числового кода в world-atlas
  'N. Cyprus': ['CY', ['EU']],
  Somaliland: ['SO', ['AF']],
  Kosovo: ['XK', ['EU']],
};

export type AtlasGeo = {
  rsmKey: string;
  id?: string;
  properties: Record<string, unknown>;
  geometry?: unknown;
};

/** ISO-2 и континенты фигуры карты. */
export function atlasInfo(geo: { id?: string | number; properties?: Record<string, unknown> }) {
  const byId = geo.id != null ? ATLAS[String(geo.id).padStart(3, '0')] : undefined;
  const name = String(geo.properties?.name ?? '');
  const hit = byId ?? ATLAS[name];
  return hit ? { iso: hit[0], continents: hit[1] } : null;
}

export const ALL_MAP_COUNTRIES: string[] = Array.from(new Set(Object.values(ATLAS).map(([iso]) => iso))).filter(
  (iso) => iso !== 'AQ' && iso !== 'TF',
);

export function isoInScope(iso: string, continents: ContinentCode[], scope: MapScope): boolean {
  if (scope === 'world') return true;
  if (scope.startsWith('country:')) return scope.slice(8) === iso;
  const continent = SCOPE_CONTINENT[scope as Exclude<MapRegionScope, 'world'>];
  return continent ? continents.includes(continent) : true;
}

// ---------- названия стран из данных → ISO-2 ----------

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zа-я0-9ıişğüöç]+/gi, '');

const ALIASES: Record<string, string> = {
  сша: 'US', usa: 'US', америка: 'US', unitedstates: 'US', unitedstatesofamerica: 'US', abd: 'US',
  великобритания: 'GB', англия: 'GB', uk: 'GB', britain: 'GB', greatbritain: 'GB', england: 'GB', ingiltere: 'GB', birlesikkrallik: 'GB',
  турция: 'TR', turkiye: 'TR', turkey: 'TR', türkiye: 'TR',
  оаэ: 'AE', uae: 'AE', эмираты: 'AE', bae: 'AE',
  чехия: 'CZ', czechrepublic: 'CZ', czechia: 'CZ', cekya: 'CZ',
  македония: 'MK', севернаямакедония: 'MK', northmacedonia: 'MK', macedonia: 'MK', kuzeymakedonya: 'MK',
  молдавия: 'MD', белоруссия: 'BY', киргизия: 'KG', кыргызстан: 'KG',
  корея: 'KR', южнаякорея: 'KR', southkorea: 'KR', севернаякорея: 'KP', northkorea: 'KP',
  косово: 'XK', kosovo: 'XK',
  боснияигерцеговина: 'BA', bosnia: 'BA', босния: 'BA',
  голландия: 'NL', holland: 'NL', hollanda: 'NL',
  россия: 'RU', рф: 'RU', russia: 'RU', rusya: 'RU',
  германия: 'DE', almanya: 'DE', deutschland: 'DE',
  кипр: 'CY', конго: 'CG', дрконго: 'CD', drcongo: 'CD',
  котдивуар: 'CI', ivorycoast: 'CI',
  ирландия: 'IE', швейцария: 'CH', isvicre: 'CH',
};

let nameIndex: Map<string, string> | null = null;
function buildNameIndex() {
  const idx = new Map<string, string>();
  const locales = ['ru', 'en', 'tr', 'de', 'uk'];
  const codes = new Set([...ALL_MAP_COUNTRIES, 'MT', 'SG', 'AD', 'MC', 'LI', 'SM', 'VA', 'BH', 'HK', 'MV', 'MU']);
  for (const loc of locales) {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([loc], { type: 'region' });
    } catch {
      names = null;
    }
    if (!names) continue;
    for (const code of codes) {
      try {
        const n = names.of(code);
        if (n && n !== code) idx.set(normalize(n), code);
      } catch {
        // ignore
      }
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) idx.set(normalize(alias), code);
  return idx;
}

/** «Германия», «Germany», «Almanya», «DE», «Турция (TR)» → ISO-2, иначе null. */
export function resolveCountryIso(label: string): string | null {
  const raw = String(label ?? '').trim();
  if (!raw) return null;
  if (!nameIndex) nameIndex = buildNameIndex();
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && upper !== 'NA' && (ALL_MAP_COUNTRIES.includes(upper) || nameIndex.has(normalize(raw)))) {
    return ALL_MAP_COUNTRIES.includes(upper) ? upper : nameIndex.get(normalize(raw)) ?? null;
  }
  const direct = nameIndex.get(normalize(raw));
  if (direct) return direct;
  // «Турция (TR)», «Германия / DE», «Germany - Berlin»
  const stripped = raw.replace(/\(.*?\)/g, ' ').split(/[/,;|–—-]/)[0];
  const second = nameIndex.get(normalize(stripped));
  if (second) return second;
  const code = /\b([A-Z]{2})\b/.exec(raw)?.[1];
  return code && code !== 'NA' && ALL_MAP_COUNTRIES.includes(code) ? code : null;
}

/** Доля значений измерения, похожих на страны — для автоподбора колонки при создании карты. */
export function countryMatchRate(labels: string[]): number {
  const list = labels.filter((l) => String(l ?? '').trim());
  if (!list.length) return 0;
  return list.filter((l) => resolveCountryIso(l)).length / list.length;
}

// ---------- рамка страны для вида «одна страна» ----------

type Topology = {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: { countries: { geometries: Array<{ id?: string; type: string; arcs: any; properties?: Record<string, unknown> }> } };
};

let topologyPromise: Promise<Topology> | null = null;
export function loadWorldTopology(): Promise<Topology> {
  if (!topologyPromise) {
    topologyPromise = fetch(GEO_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Topology>;
      })
      .catch((e) => {
        topologyPromise = null;
        throw e;
      });
  }
  return topologyPromise;
}

let decodedArcs: WeakMap<Topology, Array<Array<[number, number]>>> = new WeakMap();
function arcsOf(topo: Topology) {
  let cached = decodedArcs.get(topo);
  if (cached) return cached;
  const [sx, sy] = topo.transform?.scale ?? [1, 1];
  const [tx, ty] = topo.transform?.translate ?? [0, 0];
  cached = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      if (topo.transform) {
        x += dx;
        y += dy;
        return [x * sx + tx, y * sy + ty] as [number, number];
      }
      return [dx, dy] as [number, number];
    });
  });
  decodedArcs.set(topo, cached);
  return cached;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** Центр и масштаб, чтобы страна (её самая большая часть — без заморских территорий) заняла карту. */
export function countryView(topo: Topology, iso: string): { center: [number, number]; zoom: number } | null {
  const arcs = arcsOf(topo);
  let best: { minX: number; maxX: number; minY: number; maxY: number; area: number } | null = null;
  for (const g of topo.objects.countries.geometries) {
    const info = atlasInfo(g);
    if (!info || info.iso !== iso) continue;
    const polygons: number[][][] = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    for (const rings of polygons) {
      const outer = rings[0] || [];
      const points: Array<[number, number]> = [];
      for (const a of outer) points.push(...(arcs[a < 0 ? ~a : a] || []));
      if (!points.length) continue;
      // Часть через линию смены дат (Россия, Фиджи): считаем долготы в 0..360.
      const rawSpan = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
      const lonOf = (lon: number) => (rawSpan > 180 && lon < 0 ? lon + 360 : lon);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [lon, lat] of points) {
        const x = lonOf(lon);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, lat);
        maxY = Math.max(maxY, lat);
      }
      const area = (maxX - minX) * (maxY - minY);
      if (Number.isFinite(area) && (!best || area > best.area)) best = { minX, maxX, minY, maxY, area };
    }
  }
  if (!best) return null;
  const dLon = ((best.maxX - best.minX) * Math.PI) / 180;
  const y1 = mercY(best.minY);
  const y2 = mercY(best.maxY);
  const zoomX = MAP_WIDTH / (MAP_SCALE * Math.max(dLon, 0.02));
  const zoomY = MAP_HEIGHT / (MAP_SCALE * Math.max(Math.abs(y2 - y1), 0.02));
  const zoom = Math.max(1, Math.min(20, Math.min(zoomX, zoomY) * 0.72));
  const centerLon = (best.minX + best.maxX) / 2;
  return { center: [centerLon > 180 ? centerLon - 360 : centerLon, invMercY((y1 + y2) / 2)], zoom };
}
