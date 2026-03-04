import { Response } from "express";

export function sendSuccess(res: Response, payload: unknown) {
  return res.status(200).json(payload);
}

export function sendCreated(res: Response, payload: unknown) {
  return res.status(201).json(payload);
}

const TRANSLATIONS: Record<string, string> = {
  "An unexpected error occurred": "Ett ovantat fel intraffade",
  "Authorization check failed": "Behorighetskontrollen misslyckades",
  "Bad Request": "Ogiltig begaran",
  "Cannot book food for past or started events":
    "Det gar inte att boka mat for tidigare eller paborjade evenemang",
  "Cannot RSVP for past or started events":
    "Det gar inte att OSA till tidigare eller paborjade evenemang",
  Conflict: "Konflikt",
  "Conflict error": "Konfliktfel",
  "description must be a string": "description maste vara en strang",
  "email and password required": "E-post och losenord kravs",
  "Event not found": "Evenemanget hittades inte",
  "Failed to clear user location override":
    "Kunde inte ta bort anvandarens platsoverskrivning",
  "Failed to create document": "Kunde inte skapa dokument",
  "Failed to create revision": "Kunde inte skapa revision",
  "Failed to create user": "Kunde inte skapa anvandare",
  "Failed to get achievements": "Kunde inte hamta utmarkelser",
  "Failed to get attended events": "Kunde inte hamta narvarade evenemang",
  "Failed to get roles": "Kunde inte hamta roller",
  "Failed to get user": "Kunde inte hamta anvandare",
  "Failed to get user lodge": "Kunde inte hamta anvandarens loge",
  "Failed to list achievements": "Kunde inte lista utmarkelser",
  "Failed to list allergies": "Kunde inte lista allergier",
  "Failed to list membership payments": "Kunde inte lista medlemsbetalningar",
  "Failed to list officials": "Kunde inte lista ambeten",
  "Failed to list user map pins": "Kunde inte lista anvandare pa kartan",
  "Failed to list users": "Kunde inte lista anvandare",
  "Failed to load updated attendance": "Kunde inte lasa in uppdaterad narvaro",
  "Failed to set achievement": "Kunde inte satta utmarkelse",
  "Failed to set manual user location":
    "Kunde inte satta manuell anvandarposition",
  "Failed to set member allergies": "Kunde inte spara medlemmens allergier",
  "Failed to set member officials": "Kunde inte spara medlemmens ambeten",
  "Failed to set roles": "Kunde inte spara roller",
  "Failed to set user lodge": "Kunde inte satta anvandarens loge",
  "Failed to upload file": "Kunde inte ladda upp fil",
  "Failed to upload profile picture": "Kunde inte ladda upp profilbild",
  "File is required": "Fil kravs",
  "Food booking is not enabled for this event":
    "Matbokning ar inte aktiverad for detta evenemang",
  Forbidden: "Atkomst nekad",
  "Internal server error": "Internt serverfel",
  "Invalid endDate format": "Ogiltigt format for endDate",
  "Invalid event datetime format": "Ogiltigt datum-/tidsformat for evenemang",
  "Invalid id": "Ogiltigt id",
  "Invalid ids": "Ogiltiga id:n",
  "Invalid JSON in request body": "Ogiltig JSON i forfragningskroppen",
  "Invalid lodge filter": "Ogiltigt logefilter",
  "Invalid lodge id": "Ogiltigt loge-id",
  "Invalid lodgeId": "Ogiltigt lodgeId",
  "Invalid startDate format": "Ogiltigt format for startDate",
  "Invalid target user id": "Ogiltigt mal-anvandar-id",
  "Invalid token": "Ogiltig token",
  "Invalid token payload": "Ogiltig tokendata",
  "Invalid user id": "Ogiltigt anvandar-id",
  "Invalid year": "Ogiltigt ar",
  "Invalid year filter": "Ogiltigt arsfilter",
  "Lodge is required": "Loge kravs",
  "Missing required fields": "Saknade obligatoriska falt",
  "Missing target user id": "Saknar mal-anvandar-id",
  "No file uploaded": "Ingen fil uppladdad",
  "No valid attendance fields provided": "Inga giltiga narvarofalt angavs",
  "Not Found": "Hittades inte",
  "Not found": "Hittades inte",
  "Not invited to this event": "Du ar inte inbjuden till detta evenemang",
  "Profile picture is required": "Profilbild kravs",
  "RSVP must be 'going' before booking food":
    "OSA maste vara 'kommer' innan mat kan bokas",
  "RSVP must be 'going' to book food":
    "OSA maste vara 'kommer' for att boka mat",
  "Saknar uppdateringstokenF": "Saknar uppdateringstoken",
  "startDate must be before endDate": "startDate maste vara fore endDate",
  "Title is required": "Titel kravs",
  "title must be a string": "title maste vara en strang",
  "Token revoked": "Token har aterkallats",
  Unauthorized: "Obehorig",
  "User is not invited to this event":
    "Anvandaren ar inte inbjuden till detta evenemang",
  "User not found": "Anvandaren hittades inte",
  "Validation failed": "Validering misslyckades",
  "Year must be a valid year": "Year maste vara ett giltigt ar",
};

function fallbackMessageByStatus(status: number): string {
  if (status === 400) return "Ogiltig begaran";
  if (status === 401) return "Obehorig";
  if (status === 403) return "Atkomst nekad";
  if (status === 404) return "Resursen hittades inte";
  if (status === 409) return "Konflikt";
  if (status === 429) return "For manga forfragningar";
  if (status >= 500) return "Internt serverfel";
  return "Ett ovantat fel intraffade";
}

function translateOne(message: string, status: number): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) return fallbackMessageByStatus(status);

  const exact = TRANSLATIONS[trimmed];
  if (exact) return exact;

  const requiredMatch = trimmed.match(/^(.+): required$/i);
  if (requiredMatch) return `${requiredMatch[1]}: obligatoriskt`;

  const missingFieldsMatch = trimmed.match(
    /^Missing required user fields:\s*(.+)$/i,
  );
  if (missingFieldsMatch) {
    return `Saknade obligatoriska anvandarfalt: ${missingFieldsMatch[1]}`;
  }

  const validationDetailMatch = trimmed.match(/^Validation failed:\s*(.+)$/i);
  if (validationDetailMatch) {
    return `Validering misslyckades: ${validationDetailMatch[1]}`;
  }

  const looksEnglish =
    /\b(and|before|booking|cannot|check|conflict|create|description|email|enddate|error|event|failed|fields|file|for|forbidden|found|get|ids?|invalid|is|json|list|load|lodge|member|missing|must|not|payload|picture|provided|required|request|revision|roles|rsvp|server|set|startdate|target|title|token|unauthorized|upload|user|valid|validation|year)\b/i;
  if (looksEnglish.test(trimmed)) return fallbackMessageByStatus(status);

  return trimmed;
}

function normalizeErrorMessage(status: number, message?: string | string[]): string {
  if (Array.isArray(message)) {
    const normalized = message
      .map((item) => translateOne(String(item), status))
      .filter((item) => item.length > 0);
    if (normalized.length > 0) {
      return Array.from(new Set(normalized)).join(", ");
    }
    return fallbackMessageByStatus(status);
  }

  if (typeof message === "string") return translateOne(message, status);

  return fallbackMessageByStatus(status);
}

export function sendError(
  res: Response,
  status = 400,
  message?: string | string[],
) {
  const payload = { message: normalizeErrorMessage(status, message) };
  return res.status(status).json(payload);
}

export default { sendSuccess, sendCreated, sendError };
