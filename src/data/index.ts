// The data-access layer: the only place that queries household data. See
// "Data access" in AGENTS.md.
export { ForbiddenError, requireOwner, type HouseholdContext, type Role } from "./context";
export {
  AlreadyInHouseholdError,
  createHousehold,
  getHousehold,
  getMembership,
  householdName,
  listMembers,
  type Membership,
} from "./households";
export { requireHousehold } from "./session";
