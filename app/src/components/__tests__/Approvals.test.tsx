// The Approvals inbox (src/app/organizer/approvals.tsx): the human-in-the-loop gate.
// Lives outside src/app because every file there is a route.
import { fireEvent, render, screen } from "@testing-library/react-native";
import Approvals from "@/app/organizer/approvals";
import { approveDraft, rejectDraft } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { getRows, refetchAll } from "@/lib/store";

jest.mock("@/lib/api", () => ({ __esModule: true, approveDraft: jest.fn(), rejectDraft: jest.fn() }));
jest.mock("@/lib/confirm", () => ({ __esModule: true, confirm: jest.fn(), info: jest.fn() }));

const approve = approveDraft as jest.MockedFunction<typeof approveDraft>;
const reject = rejectDraft as jest.MockedFunction<typeof rejectDraft>;
const confirmMock = confirm as jest.MockedFunction<typeof confirm>;

beforeEach(() => {
  refetchAll();
  approve.mockReset().mockResolvedValue(undefined);
  reject.mockReset().mockResolvedValue(undefined);
  confirmMock.mockReset();
});

const pendingDraft = (kind: string) => getRows("drafts").find((d) => d.kind === kind && d.status === "pending")!;

describe("Approvals", () => {
  it("lists pending drafts with a count, the 911 decision first", async () => {
    await render(<Approvals />);
    expect(screen.getByText("Approvals · 2")).toBeTruthy();
    const titles = screen.getAllByText(/call 911\?|Correct a false post/).map((n) => n.props.children);
    expect(String(titles[0])).toMatch(/call 911\?/);
  });

  it("Call 911 asks for confirmation that says it never dials, and only approves after the person confirms", async () => {
    await render(<Approvals />);
    await fireEvent.press(screen.getByText("Call 911"));
    expect(approve).not.toHaveBeenCalled();
    const [title, message, ok, onOk, destructive] = confirmMock.mock.calls[0];
    expect([title, ok, destructive]).toEqual(["Call 911?", "Log: call 911", true]);
    expect(message).toMatch(/does not dial/);
    await onOk();
    expect(approve).toHaveBeenCalledWith(pendingDraft("escalation_911"), undefined);
  });

  it("'Not needed' rejects the 911 draft", async () => {
    await render(<Approvals />);
    await fireEvent.press(screen.getByText("Not needed"));
    expect(reject).toHaveBeenCalledWith(pendingDraft("escalation_911"));
  });

  it("approving an unedited correction sends no edits", async () => {
    await render(<Approvals />);
    await fireEvent.press(screen.getByText("Approve & send"));
    expect(approve).toHaveBeenCalledWith(pendingDraft("correction"), undefined);
  });

  it("the organizer's edits are shown as edited and sent with the approval", async () => {
    await render(<Approvals />);
    const d = pendingDraft("correction");
    await fireEvent.changeText(screen.getByLabelText("Draft text, English. Editable."), "The vigil is ON. Ignore the rumour.");
    expect(screen.getByText("Edited by you")).toBeTruthy();
    await fireEvent.press(screen.getByText("Approve & send"));
    expect(approve).toHaveBeenCalledWith(d, { body_en: "The vigil is ON. Ignore the rumour.", body_fr: d.body_fr });
  });

  it("an empty English draft can't be approved", async () => {
    await render(<Approvals />);
    await fireEvent.changeText(screen.getByLabelText("Draft text, English. Editable."), "   ");
    await fireEvent.press(screen.getByText("Approve & send"));
    expect(approve).not.toHaveBeenCalled();
  });

  it("a server error is shown on the card", async () => {
    approve.mockRejectedValueOnce(new Error("Draft already approved"));
    await render(<Approvals />);
    await fireEvent.press(screen.getByText("Approve & send"));
    expect(await screen.findByText("Draft already approved")).toBeTruthy();
  });

  it("already-sent items appear under 'Sent earlier' with a human-approved badge", async () => {
    await render(<Approvals />);
    expect(screen.getByText("Sent earlier")).toBeTruthy();
    expect(screen.queryAllByText(/approved/i).length).toBeGreaterThan(0);
  });
});
