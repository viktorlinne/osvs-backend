export type CreateLodgeBody = {
  name?: string;
  city?: string;
  description?: string | null;
  email?: string | null;
  picture?: string | null;
};

export type UpdateLodgeBody = {
  name?: string | null;
  city?: string | null;
  description?: string | null;
  email?: string | null;
  picture?: string | null;
};

export type UpdateUserProfileBody = Partial<{
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  work?: string | null;
  mobile?: string;
  city?: string;
  address?: string;
  zipcode?: string;
  notes?: string | null;
  accommodationAvailable?: boolean | null;
  archive?: "Avliden" | "Urgången" | "Avförd" | null;
  /** Admin/Editor only (PUT /users/:matrikelnummer). */
  feeExempt?: boolean;
  /** Admin/Editor only (PUT /users/:matrikelnummer). */
  standingList?: boolean;
}>;

export type AddAchievementBody = {
  achievementId?: number;
  awardedAt?: string | null;
  /** Optional change-log note (OSVS-26). */
  note?: string | null;
};

export type SetRolesBody = {
  roleIds?: number[];
};

export type SetLodgeBody = {
  lodgeId?: number | string | null;
};

export type SetUserLocationBody = {
  lat?: number | string;
  lng?: number | string;
};

export type ListUsersQuery = {
  name?: string;
  achievementId?: string | number;
  lodgeId?: string | number;
  officialId?: string | number;
  accommodationAvailable?: string | number | boolean;
  page?: string | number;
  pageSize?: string | number;
};

export type ListEventsQuery = {
  lodgeId?: string | number;
};

export type CreateEventBody = {
  title?: string;
  description?: string | null;
  lodgeMeeting?: boolean | null;
  price?: number;
  startDate?: string | null;
  endDate?: string | null;
  lodgeIds?: Array<number | string>;
  groupIds?: Array<number | string>;
  userIds?: Array<number | string>;
};

export type UpdateEventBody = Partial<CreateEventBody>;

export type LinkLodgeBody = {
  lodgeId?: number | string;
};

export type RSVPBody = {
  status?: string;
};

export type RsvpApiStatus = string;

export type FoodBookingBody = {
  bookFood?: boolean;
};

export type PatchEventAttendanceBody = Partial<{
  rsvp: boolean;
  bookFood: boolean;
  attended: boolean;
  paymentPaid: boolean;
}>;

export type ListPostsQuery = {
  lodgeId?: string | number | Array<string | number>;
  title?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type ListRevisionsQuery = {
  year?: string | number;
  lodgeId?: string | number;
};

export type CreatePostBody = {
  title?: string;
  description?: string;
  lodgeIds?: Array<number | string>;
  publicum?: boolean | number | string;
};

export type UpdatePostBody = Partial<CreatePostBody>;

export type LoginBody = {
  email?: string;
  password?: string;
};

export type ForgotPasswordBody = {
  email?: string;
};

export type VerifyPasswordActionBody = {
  token?: string;
};

export type CompletePasswordActionBody = {
  token?: string;
  password?: string;
};

export type RegisterBody = {
  email?: string;
  firstname?: string;
  lastname?: string;
  dateOfBirth?: string;
  work?: string;
  mobile?: string;
  homeNumber?: string;
  city?: string;
  address?: string;
  zipcode?: string;
  notes?: string | null;
  lodgeId?: string | number | null;
  allergyIds?: Array<number | string> | string;
};
