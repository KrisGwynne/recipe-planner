// The data-access layer: the only place that queries household data. See
// "Data access" in AGENTS.md.
import "server-only";

export { ForbiddenError, requireOwner, type HouseholdContext, type Role } from "./context";
export {
  AlreadyInHouseholdError,
  createHousehold,
  deleteAccount,
  deleteAccountWithoutHousehold,
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
export { reserveImports, type Reservation } from "./import-limits";
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
export { deleteRecipe, getRecipe, getRecipeBySlug, getRecipesBySlugs, listRecipeFiles, listRecipes, saveRecipe } from "./recipes";
export {
  addEntry,
  addLeftovers,
  availableLeftovers,
  copyPlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  moveEntry,
  nextPlan,
  removeEntry,
  setEntryPortions,
  updatePlan,
  recipePlanUses,
  type AvailableLeftovers,
  type LeftoversMeal,
  type LeftoversSource,
  type Plan,
  type PlanEntry,
  type PlanSummary,
  type PlanUse,
} from "./plans";
