// Shapes of the Access extract (scripts/migration/extract/*.json) and of the
// in-memory migration plan the loader builds from it.

export type Contact = {
  Id: number;
  lastname: string | null;
  firstname: string | null;
  address: string | null;
  zipcode: string | null;
  city: string | null;
  phone1: string | null;
  phone2: string | null;
  mobile: string | null;
  email: string | null;
  civicno: string | null;
  grade: string | null;
  official: string | null;
  plist: boolean | null;
  pnotes: string | null;
  memberno: string | null;
  notes: string | null;
  link: string | null;
  filename: string | null;
  archive: string | null;
  lodge: string | null;
  userId: string | null;
  password: string | null;
  accesslevel: number | null;
  passwordSalt: string | null;
};

export type ContactCv = {
  Id: number;
  dated: string | null;
  description: string | null;
  listId: number;
};

export type AccessEvent = {
  Id: number;
  dated: string;
  description: string | null;
  lodge: string | null;
  active: boolean | null;
};

export type EventItem = {
  itemId: number;
  contId: number;
  listId: number;
  labeled: boolean | null;
  reserved: boolean | null;
  paid: boolean | null;
  attended: boolean | null;
};

export type TEvent = {
  Id: number;
  Start_Date: string | null;
  End_Date: string | null;
  Start_Time: string | null;
  End_Time: string | null;
  Event_Contact: string | null;
  Link: string | null;
  Filename: string | null;
  Lodge: string | null;
  Category: string | null;
};

export type MailList = { Id: number; description: string | null; lodge: string | null };
export type MailItem = { itemId: number; contId: number; listId: number };

export type NewsRow = {
  Id: number;
  message: string | null;
  page: number | null;
  col: number | null;
  row: number | null;
  share: boolean | null;
  lodge: string | null;
};

export type Extract = {
  contacts: Contact[];
  contactsCv: ContactCv[];
  events: AccessEvent[];
  eventsItems: EventItem[];
  tEvents: TEvent[];
  mail: MailList[];
  mailItems: MailItem[];
  news: NewsRow[];
  /** ISO date of the Access file the extract was taken from (`_summary.json` sourceDate). */
  sourceDate: string;
};

export type ArchiveValue = "Avliden" | "Urgången" | "Avförd" | null;
export type RoleName = "Admin" | "Editor" | "Member";

export type UserRow = {
  matrikelnummer: number;
  contactId: number;
  email: string;
  passwordHash: string;
  legacyPasswordHash: string | null;
  legacyPasswordSalt: string | null;
  archive: ArchiveValue;
  firstname: string;
  lastname: string;
  dateOfBirth: string; // YYYY-MM-DD
  civicno: string | null;
  mobile: string;
  homeNumber: string | null;
  city: string;
  address: string;
  zipcode: string;
  notes: string | null;
  standingList: boolean;
  roles: RoleName[];
  lodge: string | null; // canonical lodge name
  allergies: string[]; // canonical allergy titles
  photoFile: string | null; // contacts.link, relative to the photos dir
};

export type EventRow = {
  key: string; // "events:<Id>" or "tEvents:<Id>"
  source: "events" | "tEvents";
  sourceId: number;
  title: string;
  description: string;
  lodgeMeeting: boolean;
  food: boolean;
  price: number;
  startDate: string; // YYYY-MM-DD HH:MM:SS
  endDate: string;
  lodge: string | null;
};

export type AttendanceRow = {
  matrikelnummer: number;
  eventKey: string;
  /** 0 = kommer inte, 1 = kommer, 2 = obesvarat */
  rsvp: 0 | 1 | 2;
  bookFood: 0 | 1;
  attended: 0 | 1;
};

export type GroupRow = { sourceId: number; name: string; description: string };
export type GroupMemberRow = { groupSourceId: number; matrikelnummer: number };

export type PostRow = {
  sourceId: number;
  title: string;
  description: string;
  publicum: boolean;
  createdAt: string; // YYYY-MM-DD HH:MM:SS
  lodges: string[];
};

export type AchievementRow = {
  matrikelnummer: number;
  title: string;
  awardedAt: string; // YYYY-MM-DD HH:MM:SS
  source: string;
};

export type OfficialRow = {
  matrikelnummer: number;
  title: string;
  appointedAt: string;
  unAppointedAt: string | null;
  source: string;
};
