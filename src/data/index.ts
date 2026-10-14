// The data-access layer: the only place that queries household data. See
// "Data access" in AGENTS.md.
import "server-only";

export { ForbiddenError, requireOwner, type HouseholdContext, type Role } from "./context";
export {
  AlreadyInHouseholdError,
  createHousehold,
  deleteHousehold,
  getDeparture,
  getHousehold,
  getMembership,
  householdCounts,
  householdName,
  leaveHousehold,
  listMembers,
  removeMember,
  renameHousehold,
  setRole,
  type Membership,
} from "./households";
export { requireHousehold } from "./session";
export {
  INVITE_DAYS,
  acceptInvite,
  createInvite,
  getInvite,
  listInvites,
  revokeInvite,
  type AcceptResult,
  type InvitePreview,
  type InviteStatus,
  type Invitee,
} from "./invites";
export {
  getRecipeHousehold,
  markCooked,
  setFavourite,
  setNotes,
  setRating,
  unmarkCooked,
  type RecipeHousehold,
} from "./recipe-household";
export { deleteRecipe, getRecipe, getRecipeBySlug, getRecipesBySlugs, listRecipes, saveRecipe } from "./recipes";
export {
  addEntry,
  copyPlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  moveEntry,
  removeEntry,
  setEntryPortions,
  updatePlan,
  type Plan,
  type PlanEntry,
  type PlanSummary,
} from "./plans";
