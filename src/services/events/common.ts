import type { EventRecord } from "../../types";

export type EventRow = Record<string, unknown>;

export function mapEventRow(row: EventRow): EventRecord {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    lodgeMeeting:
      row.lodgeMeeting == null ? false : Boolean(Number(row.lodgeMeeting)),
    price: Number(row.price ?? 0),
    startDate: String(row.startDate ?? ""),
    endDate: String(row.endDate ?? ""),
  };
}

