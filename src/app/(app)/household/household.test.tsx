import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { expiresIn, madeBy } from "./household-settings";

const mocks = vi.hoisted(() => ({
  requireHousehold: vi.fn(),
  listMembers: vi.fn(),
  listInvites: vi.fn(),
  householdCounts: vi.fn(),
  refresh: vi.fn(),
  actions: {
    renameAction: vi.fn(),
    setRoleAction: vi.fn(),
    removeMemberAction: vi.fn(),
    revokeInviteAction: vi.fn(),
    leaveAction: vi.fn(),
    deleteHouseholdAction: vi.fn(),
  },
}));
vi.mock("@/data", () => ({
  requireHousehold: mocks.requireHousehold,
  listMembers: mocks.listMembers,
  listInvites: mocks.listInvites,
  householdCounts: mocks.householdCounts,
}));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./actions", () => mocks.actions);
vi.mock("../../welcome/invite/actions", () => ({ createInviteAction: vi.fn() }));

const { default: HouseholdPage } = await import("./page");

const NOW = new Date("2026-10-14T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const kris = { userId: "kris", name: "Kris Gwynne", email: "kris@example.com", image: null, role: "owner", joinedAt: daysAgo(30) };
const sam = { userId: "sam", name: "Sam Gwynne", email: "sam@example.com", image: null, role: "member", joinedAt: daysAgo(2) };
const alex = { userId: "alex", name: "Alex Morgan", email: "alex@example.com", image: null, role: "member", joinedAt: daysAgo(1) };

function as(userId: string, role: "owner" | "member", members = [kris, sam, alex]) {
  const user = members.find((m) => m.userId === userId)!;
  mocks.requireHousehold.mockResolvedValue({
    user: { id: userId, name: user.name, email: user.email, image: null },
    household: { householdId: "h1", name: "The Gwynnes", role },
    ctx: { householdId: "h1", role },
  });
  mocks.listMembers.mockResolvedValue(members);
}

async function show() {
  render(<ToastProvider>{await HouseholdPage()}</ToastProvider>);
}

const click = (name: string | RegExp) => act(async () => fireEvent.click(screen.getByRole("button", { name })));
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mocks.householdCounts.mockResolvedValue({ recipes: 42, plans: 3 });
  mocks.listInvites.mockResolvedValue([
    { id: "i1", createdAt: daysAgo(2), expiresAt: new Date(NOW.getTime() + 4.5 * 24 * 60 * 60 * 1000), createdBy: "Kris Gwynne", createdById: "kris" },
  ]);
  for (const action of Object.values(mocks.actions)) action.mockResolvedValue(true);
  mocks.actions.renameAction.mockResolvedValue({ saved: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("invite link wording", () => {
  it("says when it expires and who made it", () => {
    expect(expiresIn(new Date(NOW.getTime() + 4.5 * 24 * 60 * 60 * 1000), NOW)).toBe("Expires in 5 days");
    expect(expiresIn(new Date(NOW.getTime() + 60 * 60 * 1000), NOW)).toBe("Expires in 1 day");
    expect(madeBy({ createdAt: daysAgo(2), createdBy: null }, NOW)).toBe("Made by you 2 days ago");
    expect(madeBy({ createdAt: daysAgo(1), createdBy: "Sam Gwynne" }, NOW)).toBe("Made by Sam yesterday");
    expect(madeBy({ createdAt: NOW, createdBy: "" }, NOW)).toBe("Made by someone today");
  });
});

describe("as an owner (design A, B)", () => {
  beforeEach(() => as("kris", "owner"));

  it("shows the name, members, open links and account", async () => {
    await show();
    expect(screen.getByRole("button", { name: /The Gwynnes.*Rename/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members 3" })).toBeInTheDocument();
    expect(screen.getByText("(you)").closest("div")).toHaveTextContent("Kris Gwynne (you)kris@example.comOwner");
    // Other members open their options; your own row doesn't.
    expect(screen.getByRole("button", { name: /Sam Gwynne/ })).toHaveTextContent("Member");
    expect(screen.queryByRole("button", { name: /Kris Gwynne/ })).not.toBeInTheDocument();
    expect(screen.getByText("Expires in 5 days")).toBeInTheDocument();
    expect(screen.getByText("Made by you 2 days ago")).toBeInTheDocument();
    expect(screen.getByText("Signed in with Google as kris@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Leave The Gwynnes/ })).toHaveTextContent("Make someone else an owner first.");
    expect(screen.getByRole("button", { name: /Delete The Gwynnes/ })).toBeInTheDocument();
    // Comes with PP-164 and PP-158.
    expect(screen.queryByText("Download all recipes")).not.toBeInTheDocument();
    expect(screen.queryByText(/Delete my account/)).not.toBeInTheDocument();
  });

  it("renames (design D)", async () => {
    await show();
    await click(/Rename/);
    expect(dialog()).toHaveAccessibleName("Rename household");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: /Name/ }), { target: { value: "The Gwynne kitchen" } });
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Save" })));
    expect(mocks.actions.renameAction).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Renamed");
  });

  it("shows a problem with the new name", async () => {
    mocks.actions.renameAction.mockResolvedValue({ error: "Enter a name for the household" });
    await show();
    await click(/Rename/);
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Save" })));
    expect(within(dialog()).getByText("Enter a name for the household")).toBeInTheDocument();
  });

  it("opens the invite sheet, and refreshes the links when it closes (design E)", async () => {
    await show();
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Invite someone" })[0]));
    expect(dialog()).toHaveAccessibleName("Invite someone");
    expect(within(dialog()).getByText("Tap Copy or Share to make a link")).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Done" })));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("cancels a link", async () => {
    await show();
    await click("Cancel link");
    expect(mocks.actions.revokeInviteAction).toHaveBeenCalledWith("i1");
    expect(screen.getByRole("status")).toHaveTextContent("Link cancelled");
  });

  it("makes a member an owner, with Undo (design F)", async () => {
    await show();
    await click(/Sam Gwynne/);
    expect(dialog()).toHaveAccessibleName("Sam Gwynne");
    expect(within(dialog()).getByText("Member · joined 12 Oct")).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: /Make an owner/ })));
    expect(mocks.actions.setRoleAction).toHaveBeenCalledWith("sam", "owner");
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Sam is now an owner");
    await act(async () => fireEvent.click(within(toast).getByRole("button", { name: "Undo" })));
    expect(mocks.actions.setRoleAction).toHaveBeenLastCalledWith("sam", "member");
  });

  it("makes another owner a member", async () => {
    as("kris", "owner", [kris, { ...sam, role: "owner" }]);
    await show();
    await click(/Sam Gwynne/);
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Make a member" })));
    expect(mocks.actions.setRoleAction).toHaveBeenCalledWith("sam", "member");
  });

  it("removes someone after asking (design G)", async () => {
    await show();
    await click(/Sam Gwynne/);
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: /Remove from household/ })));
    expect(dialog()).toHaveAccessibleName("Remove Sam from The Gwynnes?");
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Remove Sam" })));
    expect(mocks.actions.removeMemberAction).toHaveBeenCalledWith("sam");
    expect(screen.getByRole("status")).toHaveTextContent("Removed Sam");
  });

  it("asks the only owner to choose another owner before leaving (design I)", async () => {
    await show();
    await click(/Leave The Gwynnes/);
    expect(dialog()).toHaveAccessibleName("Choose another owner first");
    expect(dialog()).toHaveTextContent("Make Sam or Alex an owner, then you can leave.");
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: /Delete the household/ })));
    expect(dialog()).toHaveAccessibleName("Delete The Gwynnes?");
    expect(mocks.actions.leaveAction).not.toHaveBeenCalled();
  });

  it("lets an owner leave while another owner stays", async () => {
    as("kris", "owner", [kris, { ...sam, role: "owner" }]);
    await show();
    expect(screen.getByRole("button", { name: /Leave The Gwynnes/ })).not.toHaveTextContent("owner first");
    await click(/Leave The Gwynnes/);
    expect(dialog()).toHaveAccessibleName("Leave The Gwynnes?");
  });

  it("deletes the household once its name is typed (design J)", async () => {
    await show();
    await click(/Delete The Gwynnes/);
    expect(dialog()).toHaveTextContent("42 recipes, with their notes, ratings and cooking history");
    expect(dialog()).toHaveTextContent("3 meal plans");
    expect(dialog()).toHaveTextContent("The household itself: Sam and Alex lose access");
    const button = within(dialog()).getByRole("button", { name: "Delete household" });
    const field = within(dialog()).getByRole("textbox", { name: /to confirm/ });
    fireEvent.change(field, { target: { value: "The Gwyn" } });
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: " the gwynnes " } });
    expect(button).toBeEnabled();
    await act(async () => fireEvent.click(button));
    expect(mocks.actions.deleteHouseholdAction).toHaveBeenCalledWith(" the gwynnes ");
  });

  it("offers only Delete to the only person in the household", async () => {
    as("kris", "owner", [kris]);
    await show();
    expect(screen.queryByRole("button", { name: /Leave/ })).not.toBeInTheDocument();
    await click(/Delete The Gwynnes/);
    expect(dialog()).toHaveTextContent("The household itself");
    expect(dialog()).not.toHaveTextContent("lose access");
  });
});

describe("as a member (design C, H)", () => {
  beforeEach(() => as("sam", "member"));

  it("shows the household without the owner's controls", async () => {
    await show();
    expect(screen.queryByRole("button", { name: /Rename/ })).not.toBeInTheDocument();
    expect(screen.getByText("The Gwynnes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kris Gwynne|Alex Morgan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite someone" })).not.toBeInTheDocument();
    expect(screen.getByText("Kris is the owner, so they invite people and look after the household.")).toBeInTheDocument();
    expect(mocks.listInvites).not.toHaveBeenCalled();
    expect(screen.queryByText("Open invite links")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete The Gwynnes/ })).not.toBeInTheDocument();
  });

  it("names every owner", async () => {
    as("sam", "member", [kris, { ...alex, role: "owner" }, sam]);
    await show();
    expect(screen.getByText("Kris and Alex are the owners, so they invite people and look after the household.")).toBeInTheDocument();
  });

  it("leaves after asking", async () => {
    await show();
    await click(/Leave The Gwynnes/);
    expect(dialog()).toHaveTextContent(
      "You'll lose access to its 42 recipes and 3 meal plans. They stay with Kris and Alex. To come back, ask an owner for a new invite.",
    );
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Leave household" })));
    expect(mocks.actions.leaveAction).toHaveBeenCalled();
  });

  it("says so when leaving fails", async () => {
    mocks.actions.leaveAction.mockResolvedValue(false);
    await show();
    await click(/Leave The Gwynnes/);
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Leave household" })));
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't leave. Try again.");
  });
});
