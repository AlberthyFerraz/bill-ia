// Interpretador local de frases em português para criar lembretes.
// Não usa internet: reconhece padrões comuns de data e hora.

export type ParsedKind = 'task' | 'reminder' | 'event';

export interface ParsedRequest {
  title: string;
  when: Date | null;
  kind: ParsedKind;
  asCall: boolean;
  // Trecho que descreve o horário, para mostrar na resposta (ex.: "daqui 10 minutos").
  timeHint: string | null;
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50,
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

// Remove acentos mantendo o mesmo tamanho da string, para os índices baterem com o texto original.
function fold(text: string): string {
  return text
    .split('')
    .map((c) => c.normalize('NFD')[0] ?? c)
    .join('')
    .toLowerCase();
}

function toNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMBER_WORDS[token] ?? null;
}

interface Range { start: number; end: number }

export function parseRequest(input: string, now: Date = new Date()): ParsedRequest {
  const original = input.trim();
  // Cópia "dobrada" onde os trechos já usados são apagados com espaços.
  let work = fold(original);
  const used: Range[] = [];

  function take(re: RegExp): RegExpExecArray | null {
    const m = re.exec(work);
    if (!m) return null;
    used.push({ start: m.index, end: m.index + m[0].length });
    work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
    return m;
  }

  function textOf(m: RegExpExecArray): string {
    return original.slice(m.index, m.index + m[0].length).trim();
  }

  const hints: string[] = [];

  // 1. Pedido para tocar como chamada.
  const asCall = /\b(me\s+lig(a|ue|ar)|lig(a|ue)\s+(pra|para)\s+mim|chamada)\b/.test(work);

  // 2. Tipo do item.
  let kind: ParsedKind = 'reminder';
  if (/\btarefas?\b/.test(work)) kind = 'task';
  else if (/\b(agend\w*|reuniao|consulta|compromisso|evento)\b/.test(work)) kind = 'event';

  let when: Date | null = null;

  // 3. Tempo relativo: "daqui 10 minutos", "em meia hora", "daqui a 2 horas".
  const rel = take(
    /\b(?:daqui\s+a|daqui|em|dentro\s+de)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|meia)\s*(minutos?|mins?|horas?|hrs?|h|dias?|semanas?)\b/,
  );
  if (rel) {
    const unit = rel[2];
    let amountMin: number;
    if (rel[1] === 'meia') {
      amountMin = unit.startsWith('h') ? 30 : 0;
    } else {
      const n = toNumber(rel[1]) ?? 0;
      if (unit.startsWith('min')) amountMin = n;
      else if (unit.startsWith('h')) amountMin = n * 60;
      else if (unit.startsWith('dia')) amountMin = n * 60 * 24;
      else amountMin = n * 60 * 24 * 7;
    }
    if (amountMin > 0) {
      when = new Date(now.getTime() + amountMin * 60 * 1000);
      hints.push(textOf(rel));
    }
  }

  if (!when) {
    // 4. Dia.
    let day: Date | null = null;
    const dayAfter = take(/\bdepois\s+de\s+amanha\b/);
    if (dayAfter) {
      day = addDays(startOfDay(now), 2);
      hints.push(textOf(dayAfter));
    } else {
      const tomorrow = take(/\bamanha\b/);
      if (tomorrow) {
        day = addDays(startOfDay(now), 1);
        hints.push(textOf(tomorrow));
      } else {
        const today = take(/\bhoje\b/);
        if (today) {
          day = startOfDay(now);
          hints.push(textOf(today));
        }
      }
    }

    if (!day) {
      const wd = take(/\b(?:(?:na|no|nesta|neste|proxima|proximo)\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira|\s+feira)?\b/);
      if (wd) {
        const target = WEEKDAYS[wd[1]];
        let diff = (target - now.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        day = addDays(startOfDay(now), diff);
        hints.push(textOf(wd));
      }
    }

    if (!day) {
      const dm = take(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (dm) {
        const d = parseInt(dm[1], 10);
        const mo = parseInt(dm[2], 10) - 1;
        let y = dm[3] ? parseInt(dm[3], 10) : now.getFullYear();
        if (y < 100) y += 2000;
        day = new Date(y, mo, d);
        if (!dm[3] && day < startOfDay(now)) day = new Date(y + 1, mo, d);
        hints.push(textOf(dm));
      } else {
        const dd = take(/\bdia\s+(\d{1,2})\b/);
        if (dd) {
          const d = parseInt(dd[1], 10);
          day = new Date(now.getFullYear(), now.getMonth(), d);
          if (day < startOfDay(now)) day = new Date(now.getFullYear(), now.getMonth() + 1, d);
          hints.push(textOf(dd));
        }
      }
    }

    // 5. Horário.
    let hour: number | null = null;
    let minute = 0;
    const noon = take(/\b(?:ao\s+)?meio[\s-]dia\b/);
    const midnight = noon ? null : take(/\b(?:a\s+)?meia[\s-]noite\b/);
    if (noon) {
      hour = 12;
      hints.push(textOf(noon));
    } else if (midnight) {
      hour = 0;
      hints.push(textOf(midnight));
    } else {
      const t =
        take(/\b(?:as|a|ate\s+as|por\s+volta\s+das|pras|para\s+as)?\s*(\d{1,2})(?::(\d{2})|h(\d{2})?\b|\s*horas?\b)/) ??
        take(/\b(?:as|pras|para\s+as|por\s+volta\s+das)\s+(\d{1,2})\b/);
      if (t) {
        hour = parseInt(t[1], 10);
        minute = t[2] ? parseInt(t[2], 10) : t[3] ? parseInt(t[3], 10) : 0;
        hints.push(textOf(t));
      }
    }

    const period = take(/(?:\b(?:da|de|pela|a)|^|\s)\s*(manha|tarde|noite|madrugada)\b/);
    if (period) {
      hints.push(textOf(period));
      if (hour === null) hour = period[1] === 'manha' ? 9 : period[1] === 'tarde' ? 15 : period[1] === 'noite' ? 20 : 3;
      else if ((period[1] === 'tarde' || period[1] === 'noite') && hour < 12) hour += 12;
    }

    if (hour !== null && hour <= 23 && minute <= 59) {
      const base = day ?? startOfDay(now);
      when = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute);
      // Sem dia explícito e horário já passou: entende como amanhã.
      if (!day && when <= now) when = addDays(when, 1);
    } else if (day) {
      when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    }
  }

  return {
    title: cleanTitle(original, used),
    when,
    kind,
    asCall,
    timeHint: hints.length ? hints.join(' ') : null,
  };
}

function cleanTitle(original: string, used: Range[]): string {
  let text = '';
  let i = 0;
  for (const r of [...used].sort((a, b) => a.start - b.start)) {
    text += original.slice(i, r.start) + ' ';
    i = r.end;
  }
  text += original.slice(i);

  const fillers: RegExp[] = [
    /^\s*(por\s+favor,?\s+)?/i,
    /^\s*(bill,?\s+)?/i,
    /^\s*(me\s+)?(lembr[ae]r?|lembre-me|avis[ae]r?|lig[ae]r?|ligue)(\s+(pra|para)\s+mim)?\s*(de|que|para|pra|pro|do|da)?\s+/i,
    /^\s*(cri[ae]r?|adicion[ae]r?|agend[ae]r?|marc[ae]r?|anot[ae]r?|coloc[ae]r?)\s+(uma?\s+)?(nova\s+)?(tarefa|lembrete|evento|compromisso)?\s*(de|para|pra|:)?\s*/i,
    /^\s*(tarefa|lembrete|evento)\s*(de|para|pra|:)?\s*/i,
  ];
  for (const re of fillers) text = text.replace(re, '');

  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s+(de|para|pra|as|às|a|à|no|na|em|e)\s*$/i, '')
    .replace(/^[\s,.:;-]+|[\s,.:;!?-]+$/g, '')
    .trim();

  if (!text) return 'Lembrete';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
