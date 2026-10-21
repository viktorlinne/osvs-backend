export const RoleValues = ["Admin", "Editor", "Member"] as const;

export type RoleValue = (typeof RoleValues)[number];

export function isValidRole(value: unknown): value is RoleValue {
  return (
    typeof value === "string" &&
    (RoleValues as readonly string[]).includes(value)
  );
}

export type Role = {
  id: number;
  role?: RoleValue;
  name?: string;
};

export type Lodge = {
  id: number;
  name: string;
  city: string;
  description: string;
  email?: string | null;
  picture?: string | null;
};

export type Group = {
  id: number;
  name: string;
  description?: string | null;
  userIds: number[];
  memberCount: number;
};

export type GroupMember = {
  matrikelnummer: number;
  firstname: string;
  lastname: string;
  email: string;
  archive: string | null;
};

export type MailingStatus = "queued" | "sending" | "done" | "cancelled";
export type OutboxStatus = "pending" | "sending" | "sent" | "failed" | "skipped";
export type MailingSkipReason =
  | "archived"
  | "no_email"
  | "placeholder"
  | "invalid_email"
  | "duplicate"
  | "dev_allowlist";

export type MailingCounts = {
  sent: number;
  /** pending + in progress */
  pending: number;
  failed: number;
  skipped: number;
};

export type MailingSummary = {
  id: number;
  groupId: number | null;
  groupName: string;
  subject: string;
  senderId: number | null;
  senderName: string | null;
  senderEmail: string | null;
  status: MailingStatus;
  createdAt: string;
  counts: MailingCounts;
};

export type MailingRecipient = {
  id: number;
  uid: number | null;
  name: string | null;
  email: string | null;
  status: OutboxStatus;
  skipReason: string | null;
  /** Swedish explanation of skipReason, null when not skipped. */
  reason: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
};

export type MailingPreview = {
  recipients: number;
  skipped: number;
  skippedByReason: Partial<Record<MailingSkipReason, number>>;
  /** Outside production: how many of `recipients` the dev allowlist blocks. */
  devAllowlist: { active: boolean; blocked: number };
};

export type Achievement = {
  id: number;
  aid?: number;
  title: string;
  awardedAt?: string | null;
};

export type Allergy = {
  id: number;
  title: string;
};

export type Official = {
  id: number;
  title: string;
};

export type OfficialHistory = {
  id: number;
  title: string;
  appointedAt: string;
  unappointedAt: string;
};

export type UserRecord = {
  matrikelnummer: number;
  email: string;
  passwordHash?: string;
  legacyPasswordHash?: string | null;
  legacyPasswordSalt?: string | null;
  createdAt: string | Date;
  picture?: string | null;
  archive?: "Avliden" | "Urgången" | "Avförd" | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string | Date;
  work?: string | null;
  revokedAt?: string | Date | null;
  accommodationAvailable?: boolean | number | null;
  feeExempt?: boolean | number | null;
  standingList?: boolean | number | null;
  mobile: string;
  homeNumber?: string | null;
  city: string;
  address: string;
  zipcode: string;
  notes?: string | null;
};

export type PublicUser = {
  matrikelnummer: number;
  email: string;
  createdAt: string;
  picture?: string | null;
  archive?: "Avliden" | "Urgången" | "Avförd" | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  work?: string | null;
  revokedAt?: string | Date | null;
  accommodationAvailable?: boolean | null;
  mobile: string;
  homeNumber?: string | null;
  city: string;
  address: string;
  zipcode: string;
  notes?: string | null;
  lodgeId?: number | null;
  lodgeName?: string | null;
  /** Only present for Admin/Editor callers (see UserAdminFlags). */
  feeExempt?: boolean;
  /** Only present for Admin/Editor callers (see UserAdminFlags). */
  standingList?: boolean;
};

/** Per-user flags managed by Admin/Editor (OSVS-27, OSVS-28). */
export type UserAdminFlags = {
  feeExempt: boolean;
  standingList: boolean;
};

export type UserMapPin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  lodgeId: number | null;
  lodgeName: string | null;
  highestGradeRank: number | null;
  highestGrade: string | null;
};

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  work?: string | null;
  homeNumber?: string | null;
  mobile: string;
  city: string;
  address: string;
  zipcode: string;
  picture?: string | null;
  notes?: string | null;
  accommodationAvailable?: boolean | null;
};

export type Post = {
  id: number;
  title: string;
  description: string;
  picture?: string | null;
  publicum?: boolean;
  lodges?: Array<Pick<Lodge, "id" | "name">>;
};

export type EventRecord = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting?: boolean | null;
  food?: boolean | null;
  price: number;
  startDate: string;
  endDate: string;
  lodgeIds?: number[];
  groupIds?: number[];
  userIds?: number[];
};

export type AttendedEvent = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
};

export type AttendedEventsSummary = {
  events: AttendedEvent[];
  sinceLastAchievementCount: number;
  lastAchievementAt: string | null;
  totalMeetingsCount: number;
  meetingsAfterGrade8Count: number;
  createdAt: string | null;
};

export type EventAttendanceRow = {
  uid: number;
  firstname: string;
  lastname: string;
  allergies: string[];
  rsvp: boolean;
  bookFood: boolean;
  attended: boolean;
  paymentStatus: "Pending" | "Paid" | null;
  paymentPaid: boolean;
};

export type MembershipPayment = {
  id: number;
  uid: number;
  amount: number;
  year: number;
  status: "Pending" | "Paid";
  createdAt?: string;
  updatedAt?: string;
};

export type EventPaymentRecord = MembershipPayment & {
  eid: number;
};

export type RevisionRecord = {
  id: number;
  lid: number;
  lodgeName: string;
  title: string;
  year: number;
  picture: string | null;
};

export type DocumentRecord = {
  id: number;
  title: string;
  picture: string | null;
};

export type RevokedToken = {
  jti: string;
  expiresAt: string;
};

export type RefreshToken = {
  token_hash: string;
  uid: number;
  expiresAt: string;
  createdAt: string;
  isRevoked: boolean;
  replacedBy?: string | null;
  lastUsed?: string | null;
};

export type PasswordActionPurpose = "SET_PASSWORD" | "RESET_PASSWORD";

export type PasswordActionToken = {
  token_hash: string;
  uid: number;
  purpose: PasswordActionPurpose;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string | null;
};
