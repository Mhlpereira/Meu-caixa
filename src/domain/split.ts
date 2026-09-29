import type { Cents } from './types';

export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
}

export interface SplitShare {
  participant: Participant;
  amount: Cents;
}

export interface ReceiptScan {
  accessKey: string | null;
  total: Cents | null;
  raw: string;
}

const ACCESS_KEY_PATTERN = /\d{44}/;

export function parseReceiptCode(raw: string): ReceiptScan {
  const digitsOnly = raw.replace(/\D/g, '');
  const keyMatch = ACCESS_KEY_PATTERN.exec(digitsOnly);
  const accessKey = keyMatch ? keyMatch[0] : null;

  return { accessKey, total: extractTotal(raw), raw };
}

function extractTotal(raw: string): Cents | null {
  const params = raw.split(/[?&]/).find((part) => part.startsWith('p='));
  if (!params) return null;

  const fields = decodeURIComponent(params.slice(2)).split('|');
  if (fields.length < 7) return null;

  const value = Number(fields[5]);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100);
}

export function splitEqually(total: Cents, count: number): Cents[] {
  if (count < 1) return [];

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}

export function shareFor(total: Cents, participants: Participant[]): SplitShare[] {
  const amounts = splitEqually(total, participants.length);
  return participants.map((participant, index) => ({
    participant,
    amount: amounts[index] ?? 0,
  }));
}

export function myShare(shares: SplitShare[]): Cents {
  return shares
    .filter((share) => share.participant.isMe)
    .reduce((total, share) => total + share.amount, 0);
}

export function owedByOthers(shares: SplitShare[]): Cents {
  return shares
    .filter((share) => !share.participant.isMe)
    .reduce((total, share) => total + share.amount, 0);
}

export function describeSplit(shares: SplitShare[]): string {
  const others = shares.filter((share) => !share.participant.isMe);
  if (others.length === 0) return '';

  const names = others.map((share) => share.participant.name).join(', ');
  return `Dividido com ${names}`;
}

export function suggestName(existing: string[], index: number): string {
  const fallback = `Pessoa ${index + 1}`;
  return existing.includes(fallback) ? `${fallback} (${index + 1})` : fallback;
}
