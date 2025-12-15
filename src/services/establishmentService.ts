import * as estRepo from "../repositories/establishments.repo";

export type EstablishmentRecord = {
  id: number;
  name: string;
  description: string | null;
};

export async function listEstablishments(
  limit?: number,
  offset?: number
): Promise<EstablishmentRecord[]> {
  const rows = await estRepo.listEstablishments(limit, offset);
  const arr = rows as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? ""),
      description: r.description == null ? null : String(r.description),
    }))
    .filter((r) => Number.isFinite(r.id));
}

export async function getEstablishmentById(
  id: number
): Promise<EstablishmentRecord | null> {
  const r = await estRepo.findById(id);
  if (!r) return null;
  return {
    id: Number(r.id),
    name: String(r.name ?? ""),
    description: r.description == null ? null : String(r.description),
  };
}

export async function createEstablishment(payload: {
  name: string;
  description?: string | null;
}): Promise<number> {
  return await estRepo.insertEstablishment(payload);
}

export async function updateEstablishment(
  id: number,
  payload: Partial<{ name: string; description?: string | null }>
): Promise<void> {
  await estRepo.updateEstablishmentRecord(
    id,
    payload as Record<string, unknown>
  );
}

export async function deleteEstablishment(id: number): Promise<void> {
  await estRepo.deleteEstablishment(id);
}

// Link / unlink lodges
export async function linkLodgeToEstablishment(
  estId: number,
  lodgeId: number
): Promise<void> {
  await estRepo.insertLodgeEstablishment(estId, lodgeId);
}

export async function unlinkLodgeFromEstablishment(
  estId: number,
  lodgeId: number
): Promise<void> {
  await estRepo.deleteLodgeEstablishment(estId, lodgeId);
}

export default {
  listEstablishments,
  getEstablishmentById,
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  linkLodgeToEstablishment,
  unlinkLodgeFromEstablishment,
};
