export type UserRecord = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  revokedAt?: string | Date | null;
  picture?: string | null;
  archive?: "Deceased" | "Retired" | "Removed" | null;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  official: string;
  mobile: string;
  homeNumber?: string | null;
  city: string;
  address: string;
  zipcode: string;
  notes?: string | null;
};

export type CreateUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  official: string;
  mobile: string;
  city: string;
  address: string;
  zipcode: string;
  picture?: string | null;
  notes?: string | null;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;
