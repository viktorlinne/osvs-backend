export { isValidUserRecord, trimUserInput } from "./users/shared";
export {
  findByEmail,
  findById,
  getUserRoles,
  getUserAchievements,
  getUserOfficials,
  listAchievements,
  listRoles,
  listPublicUsers,
  getPublicUserById,
} from "./users/read";
export {
  updateUserProfile,
  updatePassword,
  updatePicture,
  setUserRevokedAt,
  revokeAllSessions,
  setUserAchievement,
  setUserRoles,
  createUser,
} from "./users/write";

import { isValidUserRecord, trimUserInput } from "./users/shared";
import {
  findByEmail,
  findById,
  getUserRoles,
  getUserAchievements,
  getUserOfficials,
  listAchievements,
  listRoles,
  listPublicUsers,
  getPublicUserById,
} from "./users/read";
import {
  updateUserProfile,
  updatePassword,
  updatePicture,
  setUserRevokedAt,
  revokeAllSessions,
  setUserAchievement,
  setUserRoles,
  createUser,
} from "./users/write";

export default {
  isValidUserRecord,
  trimUserInput,
  findByEmail,
  findById,
  getUserRoles,
  getUserAchievements,
  getUserOfficials,
  listAchievements,
  listRoles,
  listPublicUsers,
  getPublicUserById,
  updateUserProfile,
  updatePassword,
  updatePicture,
  setUserRevokedAt,
  revokeAllSessions,
  setUserAchievement,
  setUserRoles,
  createUser,
};

