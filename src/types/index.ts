// Plain TypeScript types derived from db/schema.sql

export type Role = {
  id: number;
  role?: "Admin" | "Editor" | "Member";
  name?: string;
};

export type Lodge = {
  id: number;
  name: string;
  description?: string | null;
  address?: string | null;
};

export type User = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string; // ISO date
  picture: string;
  archive?: "Deceased" | "Retired" | "Removed" | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string; // ISO date
  official?: string | null;
  revokedAt?: string | null; // ISO datetime
  mobile: string;
  homeNumber?: string | null;
  city: string;
  address: string;
  zipcode: string;
  notes?: string | null;
};

export type Post = {
  id: number;
  title: string;
  description: string;
  picture?: string | null;
};

export type Event = {
  id: number;
  title: string;
  description: string;
  lodgeMeeting?: boolean | null;
  price: number;
  startDate: string; // ISO datetime
  endDate: string; // ISO datetime
  // Relation placeholders
  event_payments?: unknown[];
  events_attendances?: unknown[];
  lodges_events?: unknown[];
};

export type Mail = { id: number; lid: number; title: string; content: string };

export type Achievement = {
  id: number;
  title: "I:a Graden" | "II:a Graden" | "III:e Graden";
};

export type UserAchievement = {
  id: number;
  uid: number;
  aid: number;
  awardedAt: string;
};

export type EventsAttendance = { uid: number; eid: number; rsvp: boolean };

export type UsersMail = {
  uid: number;
  mid: number;
  sentAt: string;
  isRead: boolean;
  delivered: boolean;
};

export type MembershipPayment = {
  id: number;
  uid: number;
  amount: number;
  year: number;
  status: "Pending" | "Paid" | "Failed" | "Refunded";
  provider?: string | null;
  provider_ref?: string | null;
  currency: string;
  invoice_token?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type EventPayment = MembershipPayment & { eid: number };

// Lowercase/table-name aliases for existing code that referenced `@osvs/types`
export type events = Event;
export type event_payments = EventPayment;
export type events_attendances = EventsAttendance;
export type lodges_events = unknown[];
export type users_mails = UsersMail;

// Re-export other type modules for compatibility
export * from "./user";
export * from "./requests";

export type RevokedToken = { jti: string; expiresAt: string };
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

// HTTP DTOs / local request shapes
export type ListLodgesQuery = {
  limit?: string | number;
  offset?: string | number;
};
export type CreateLodgeBody = {
  name?: string;
  description?: string | null;
  address?: string;
};
export type UpdateLodgeBody = {
  name?: string;
  description?: string | null;
  address?: string | null;
};
// Users DTOs
export type UpdateUserProfileBody = Partial<{
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  official?: string | null;
  mobile?: string;
  city?: string;
  address?: string;
  zipcode?: string;
}>;

export type AddAchievementBody = {
  achievementId?: number;
  awardedAt?: string | null;
};
export type SetRolesBody = { roleIds?: number[] };
export type SetLodgeBody = { lodgeId?: number | null };
export type ListUsersQuery = {
  limit?: string | number;
  offset?: string | number;
  name?: string;
  achievementId?: string | number;
  lodgeId?: string | number;
};
// Events DTOs
export type ListEventsQuery = {
  limit?: string | number;
  offset?: string | number;
  lodgeId?: string | number;
  esId?: string | number;
};
export type CreateEventBody = {
  title?: string;
  description?: string;
  lodgeMeeting?: boolean | null;
  price?: number;
  startDate?: string;
  endDate?: string;
  lodgeIds?: number[];
};
export type UpdateEventBody = Partial<CreateEventBody>;
export type LinkLodgeBody = { lodgeId?: number | string | undefined };
export type RSVPBody = { status?: string };

// Posts DTOs
export type ListPostsQuery = {
  limit?: string | number;
  offset?: string | number;
};
export type CreatePostBody = { title?: string; description?: string };
export type UpdatePostBody = Partial<CreatePostBody>;

// Mails DTOs
export type CreateMailBody = { lid?: number; title?: string; content?: string };

// Stripe / Payments DTOs
export type CreateCheckoutBody = {
  price_id?: string;
  quantity?: number | string;
};
export type SessionStatusQuery = { session_id?: string };
export type CreateMembershipBody = { year?: number; amount?: number };
export type CreateEventPaymentBody = Record<string, unknown>;

// Swish DTOs (reuse membership shape)
export type SwishCreateMembershipBody = CreateMembershipBody;

// Auth DTOs
export type LoginBody = { email?: string; password?: string };
export type ForgotPasswordBody = { email?: string };
export type ResetPasswordBody = { token?: string; password?: string };
export type RegisterBody = {
  username?: string;
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  dateOfBirth?: string;
  official?: string;
  mobile?: string;
  city?: string;
  address?: string;
  zipcode?: string;
  notes?: string | null;
  lodgeId?: string | number | null;
};

// Compatibility aliases for prior `@osvs/types` shape
export type UserRecord = User;
export type PublicUser = Omit<User, "passwordHash">;
export type posts = Post;
export type mails = Mail;
export type membership_payments = MembershipPayment;

export type UserRole = "Admin" | "Editor" | "Member";
export const UserRoleValues = ["Admin", "Editor", "Member"] as const;
export function isValidRole(r: unknown): r is UserRole {
  return (
    typeof r === "string" && (UserRoleValues as readonly string[]).includes(r)
  );
}
