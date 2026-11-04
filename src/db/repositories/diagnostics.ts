import type { Diagnostic } from '../../domain/types';
import { db } from '../schema';

const MAX_ROWS = 50;

export async function logDiagnostic(
  level: Diagnostic['level'],
  message: string,
  context?: string,
): Promise<void> {
  await db.diagnostics.add({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    level,
    message,
    context,
  });

  const count = await db.diagnostics.count();
  if (count <= MAX_ROWS) return;

  const excess = await db.diagnostics.orderBy('at').limit(count - MAX_ROWS).primaryKeys();
  await db.diagnostics.bulkDelete(excess);
}

export async function listDiagnostics(): Promise<Diagnostic[]> {
  return db.diagnostics.orderBy('at').reverse().toArray();
}

export async function clearDiagnostics(): Promise<void> {
  await db.diagnostics.clear();
}
