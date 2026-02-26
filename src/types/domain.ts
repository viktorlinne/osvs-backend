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
  createdAt: string | Date;
  picture?: string | null;
  archive?: "Deceased" | "Retired" | "Removed" | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string | Date;
  work?: string | null;
  revokedAt?: string | Date | null;
  accommodationAvailable?: boolean | number | null;
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
  archive?: "Deceased" | "Retired" | "Removed" | null;
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
  lodges?: Array<Pick<Lodge, "id" | "name">>;
};

export type EventRecord = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting?: boolean | null;
  price: number;
  startDate: string;
  endDate: string;
};

export type MembershipPayment = {
  id: number;
  uid: number;
  amount: number;
  year: number;
  status: "Pending" | "Paid" | "Failed" | "Refunded";
  provider?: string | null;
  provider_ref?: string | null;
  currency?: string | null;
  invoice_token?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EventPaymentRecord = MembershipPayment & {
  eid: number;
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

export type PasswordReset = {
  token_hash: string;
  uid: number;
  expiresAt: string;
  createdAt: string;
};
