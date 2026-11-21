import * as SQLite from 'expo-sqlite';

export type ItemKind = 'task' | 'reminder' | 'event';

export interface Item {
  id: number;
  kind: ItemKind;
  title: string;
  notes: string | null;
  // Data/hora em ISO. Para tarefas sem prazo fica null.
  when_at: string | null;
  // Se true, toca como chamada (alarme em tela cheia) no horário.
  as_call: number;
  done: number;
  notification_id: string | null;
  calendar_event_id: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('billia.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          notes TEXT,
          when_at TEXT,
          as_call INTEGER NOT NULL DEFAULT 0,
          done INTEGER NOT NULL DEFAULT 0,
          notification_id TEXT,
          calendar_event_id TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function listItems(): Promise<Item[]> {
  const db = await getDb();
  return db.getAllAsync<Item>('SELECT * FROM items ORDER BY done ASC, when_at IS NULL, when_at ASC');
}

export async function insertItem(data: Omit<Item, 'id' | 'done' | 'notification_id' | 'calendar_event_id'>): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO items (kind, title, notes, when_at, as_call) VALUES (?, ?, ?, ?, ?)',
    data.kind,
    data.title,
    data.notes,
    data.when_at,
    data.as_call,
  );
  return result.lastInsertRowId;
}

export async function setItemFields(id: number, fields: Partial<Item>) {
  const db = await getDb();
  const keys = Object.keys(fields) as (keyof Item)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k] as string | number | null);
  await db.runAsync(`UPDATE items SET ${sets} WHERE id = ?`, ...values, id);
}

export async function deleteItem(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string | null) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
