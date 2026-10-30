/**
 * Справочник стран ISO 3166-1: alpha-2 → alpha-3. Названия не храним — фронт берёт их из
 * Intl.DisplayNames на языке интерфейса (ru/en/tr и любой другой).
 */
const RAW =
  'AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW AX:ALA AZ:AZE ' +
  'BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS ' +
  'BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ CA:CAN CC:CCK CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN ' +
  'CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST ' +
  'EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF ' +
  'GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY HK:HKG HM:HMD ' +
  'HN:HND HR:HRV HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM ' +
  'JO:JOR JP:JPN KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO LB:LBN LC:LCA ' +
  'LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL MK:MKD ' +
  'ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ NA:NAM ' +
  'NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG ' +
  'PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI PS:PSE PT:PRT PW:PLW PY:PRY QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA ' +
  'SA:SAU SB:SLB SC:SYC SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ' +
  'ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON ' +
  'TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR ' +
  'VN:VNM VU:VUT WF:WLF WS:WSM XK:XKX YE:YEM YT:MYT ZA:ZAF ZM:ZMB ZW:ZWE';

const PAIRS = RAW.split(' ').map((p) => p.split(':') as [string, string]);

export const COUNTRY_CODES: readonly string[] = PAIRS.map(([a2]) => a2);
const A2 = new Set(COUNTRY_CODES);
const A3_TO_A2 = new Map(PAIRS.map(([a2, a3]) => [a3, a2]));
// В паспортах встречаются нестандартные коды (D — Германия, GBD/GBN/GBO… — британские виды гражданства)
A3_TO_A2.set('D', 'DE').set('D<<', 'DE').set('GBD', 'GB').set('GBN', 'GB').set('GBO', 'GB').set('GBS', 'GB').set('GBP', 'GB');

/** 'tr' | 'TUR' | 'TR' → 'TR'; неизвестное → null. */
export function normalizeCountry(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  if (!s) return null;
  if (s.length === 2) return A2.has(s) ? s : s === 'UK' ? 'GB' : null;
  return A3_TO_A2.get(s) ?? null;
}

export function normalizeCountryList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(normalizeCountry).filter((c): c is string => !!c))];
}
