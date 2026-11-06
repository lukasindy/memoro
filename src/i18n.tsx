import React from 'react';
import { Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from 'react-native';
import { EXACT, RULES } from './en';

// App-Sprache: 'de' (Standard, Texte unverändert) oder 'en' (Texte werden beim Anzeigen übersetzt)
export type UiLang = 'de' | 'en';
let ui: UiLang = 'de';
const cache = new Map<string, string>();

export const getUi = () => ui;
export function setUi(l: UiLang) {
  if (l === ui) return;
  ui = l;
  cache.clear();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = RULES.map(([de, en]) => ({
  re: new RegExp('^' + de.split('${}').map(escape).join('(.*?)') + '$'),
  en,
}));

const SINGULAR = /\b1 (words|days|lessons|minutes|questions|tasks|pairs|lines|steps)\b/g;

function translate(key: string): string | undefined {
  const hit = EXACT[key];
  if (hit !== undefined) return hit;
  for (const r of compiled) {
    const m = r.re.exec(key);
    if (m) return r.en.replace(/\$(T?)(\d)/g, (_x, t: string, n: string) => (t ? tr(m[+n] ?? '') : m[+n] ?? ''));
  }
  return undefined;
}

export function tr(s: string): string {
  if (ui === 'de' || !s) return s;
  const c = cache.get(s);
  if (c !== undefined) return c;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const core = m[2];
  let result = s;
  if (core) {
    const out = translate(core.replace(/\s+/g, ' '));
    if (out !== undefined) {
      const lead = /^[.,;:!?)”]/.test(out) ? '' : m[1];
      result = (lead + out + m[3]).replace(SINGULAR, (_x, w: string) => '1 ' + w.slice(0, -1));
    }
  }
  if (cache.size > 3000) cache.clear();
  cache.set(s, result);
  return result;
}

function trChildren(c: React.ReactNode): React.ReactNode {
  if (ui === 'de') return c;
  if (typeof c === 'string') return tr(c);
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? tr(x) : x));
  return c;
}

export const Text = React.forwardRef<any, TextProps>(function Text(props, ref) {
  return <RNText {...props} ref={ref}>{trChildren(props.children)}</RNText>;
});

export const TextInput = React.forwardRef<any, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput {...props} ref={ref} placeholder={props.placeholder ? tr(props.placeholder) : props.placeholder} />;
});

// Text, der nie übersetzt wird (z. B. die Sprachnamen "Deutsch" / "English")
export const RawText = RNText;
