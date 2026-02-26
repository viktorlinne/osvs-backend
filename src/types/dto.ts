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
}>;

export type AddAchievementBody = {
  achievementId?: number;
  awardedAt?: string | null;
};

export type SetRolesBody = {
  roleIds?: number[];
};

export type SetLodgeBody = {
  lodgeId?: number | string | null;
};

export type ListUsersQuery = {
  name?: string;
  achievementId?: string | number;
  lodgeId?: string | number;
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
};

export type UpdateEventBody = Partial<CreateEventBody>;

export type LinkLodgeBody = {
  lodgeId?: number | string;
};

export type RSVPBody = {
  status?: string;
};

export type RsvpApiStatus = string;

export type ListPostsQuery = {
  lodgeId?: string | number | Array<string | number>;
};

export type CreatePostBody = {
  title?: string;
  description?: string;
  lodgeIds?: Array<number | string>;
};

export type UpdatePostBody = Partial<CreatePostBody>;

export type LoginBody = {
  email?: string;
  password?: string;
};

export type RegisterBody = {
  email?: string;
  password?: string;
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
};
