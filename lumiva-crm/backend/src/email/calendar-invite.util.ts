export interface CalendarInviteParticipant {
  email: string;
  name: string | null;
  role: string | null;
  status: string | null;
}

export interface ParsedCalendarInvite {
  uid: string | null;
  method: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
  attendees: CalendarInviteParticipant[];
  attendeesCount: number;
  status: 'requested' | 'confirmed' | 'tentative' | 'cancelled';
  sequence: number | null;
  sourceFilename: string | null;
}

export interface CalendarInviteSource {
  content: string;
  contentType?: string | null;
  filename?: string | null;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfoldIcs(input: string): string[] {
  const normalized = String(input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const out: string[] = [];
  for (const rawLine of normalized.split('\n')) {
    if (/^[ \t]/.test(rawLine) && out.length > 0) {
      out[out.length - 1] += rawLine.slice(1);
    } else if (rawLine.trim()) {
      out.push(rawLine);
    }
  }
  return out;
}

function splitPropertyHead(head: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < head.length; i += 1) {
    const ch = head[i];
    if (ch === '"' && head[i - 1] !== '\\') quoted = !quoted;
    if (ch === ';' && !quoted) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseIcsProperty(line: string): IcsProperty | null {
  let colonIndex = -1;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== '\\') quoted = !quoted;
    if (ch === ':' && !quoted) {
      colonIndex = i;
      break;
    }
  }
  if (colonIndex <= 0) return null;
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [rawName, ...rawParams] = splitPropertyHead(head);
  const name = rawName.trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  rawParams.forEach((part) => {
    const eq = part.indexOf('=');
    if (eq <= 0) return;
    const key = part.slice(0, eq).trim().toUpperCase();
    const raw = part.slice(eq + 1).trim();
    params[key] = raw.replace(/^"|"$/g, '');
  });
  return { name, params, value };
}

function unescapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseMailto(value: string): string | null {
  const raw = String(value || '').trim();
  const email = raw.replace(/^mailto:/i, '').trim().toLowerCase();
  return email && email.includes('@') ? email : null;
}

function parseIcsDate(value: string, params: Record<string, string>): {
  value: string;
  timezone: string | null;
} | null {
  const raw = String(value || '').trim();
  const timezone = params.TZID?.trim() || null;
  const dateOnly = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly || params.VALUE?.toUpperCase() === 'DATE') {
    const match = dateOnly || raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!match) return null;
    return {
      value: `${match[1]}-${match[2]}-${match[3]}`,
      timezone,
    };
  }

  const dt = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?(Z)?$/i,
  );
  if (!dt) return null;
  const [, y, mo, d, h, mi, s, z] = dt;
  if (z) {
    const parsed = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    if (Number.isNaN(parsed.getTime())) return null;
    return { value: parsed.toISOString(), timezone: 'UTC' };
  }
  return {
    value: `${y}-${mo}-${d}T${h}:${mi}:${s}`,
    timezone,
  };
}

function normalizeInviteStatus(method: string | null, rawStatus: string | null): ParsedCalendarInvite['status'] {
  const m = String(method || '').trim().toUpperCase();
  const s = String(rawStatus || '').trim().toUpperCase();
  if (m === 'CANCEL' || s === 'CANCELLED') return 'cancelled';
  if (s === 'TENTATIVE') return 'tentative';
  if (m === 'REQUEST') return 'requested';
  return 'confirmed';
}

function collectVeventProperties(lines: string[]): {
  method: string | null;
  props: IcsProperty[];
} | null {
  let method: string | null = null;
  let inEvent = false;
  const props: IcsProperty[] = [];
  for (const line of lines) {
    const prop = parseIcsProperty(line);
    if (!prop) continue;
    if (prop.name === 'METHOD') method = unescapeIcsText(prop.value).toUpperCase() || null;
    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === 'VEVENT') {
      inEvent = true;
      continue;
    }
    if (prop.name === 'END' && prop.value.toUpperCase() === 'VEVENT') {
      break;
    }
    if (inEvent) props.push(prop);
  }
  return props.length ? { method, props } : null;
}

function firstProp(props: IcsProperty[], name: string): IcsProperty | null {
  return props.find((prop) => prop.name === name) || null;
}

function parseSingleCalendarInvite(source: CalendarInviteSource): ParsedCalendarInvite | null {
  const event = collectVeventProperties(unfoldIcs(source.content));
  if (!event) return null;
  const { method, props } = event;
  const dtStart = firstProp(props, 'DTSTART');
  if (!dtStart) return null;
  const parsedStart = parseIcsDate(dtStart.value, dtStart.params);
  if (!parsedStart) return null;
  const dtEnd = firstProp(props, 'DTEND');
  const parsedEnd = dtEnd ? parseIcsDate(dtEnd.value, dtEnd.params) : null;
  const summary = unescapeIcsText(firstProp(props, 'SUMMARY')?.value || '');
  const organizer = firstProp(props, 'ORGANIZER');
  const organizerEmail = organizer ? parseMailto(organizer.value) : null;
  const attendees = props
    .filter((prop) => prop.name === 'ATTENDEE')
    .map((prop) => ({
      email: parseMailto(prop.value),
      name: unescapeIcsText(prop.params.CN || '') || null,
      role: prop.params.ROLE || null,
      status: prop.params.PARTSTAT || null,
    }))
    .filter((attendee): attendee is CalendarInviteParticipant => Boolean(attendee.email));
  const people = new Set<string>();
  if (organizerEmail) people.add(organizerEmail);
  attendees.forEach((attendee) => people.add(attendee.email));
  const sequenceRaw = firstProp(props, 'SEQUENCE')?.value;
  const sequence = sequenceRaw != null && sequenceRaw !== '' ? Number(sequenceRaw) : null;
  const rawStatus = unescapeIcsText(firstProp(props, 'STATUS')?.value || '') || null;

  return {
    uid: unescapeIcsText(firstProp(props, 'UID')?.value || '') || null,
    method,
    title: summary || 'Встреча',
    description: unescapeIcsText(firstProp(props, 'DESCRIPTION')?.value || '') || null,
    location: unescapeIcsText(firstProp(props, 'LOCATION')?.value || '') || null,
    startAt: parsedStart.value,
    endAt: parsedEnd?.value || null,
    timezone: parsedStart.timezone || parsedEnd?.timezone || null,
    organizerEmail,
    organizerName: organizer ? unescapeIcsText(organizer.params.CN || '') || null : null,
    attendees,
    attendeesCount: people.size,
    status: normalizeInviteStatus(method, rawStatus),
    sequence: Number.isFinite(sequence) ? sequence : null,
    sourceFilename: source.filename?.trim() || null,
  };
}

export function parseCalendarInviteSources(
  sources: CalendarInviteSource[],
): ParsedCalendarInvite | null {
  for (const source of sources) {
    if (!source.content?.trim()) continue;
    const parsed = parseSingleCalendarInvite(source);
    if (parsed) return parsed;
  }
  return null;
}
