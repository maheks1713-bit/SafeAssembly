import { fireEvent, render, screen } from "@testing-library/react-native";
import { RightsChat } from "../RightsChat";
import { askRights } from "@/lib/api";
import type { RightsAnswer } from "@/lib/types";

jest.mock("@/lib/api", () => ({ __esModule: true, askRights: jest.fn() }));
const ask = askRights as jest.MockedFunction<typeof askRights>;

const answer = (lang: "en" | "fr"): RightsAnswer => ({
  answer: lang === "en" ? "Film from a safe distance." : "Filmez à distance.",
  cited_sections: ["Charter s. 2(b)"], confidence: "high", covered: true, ms: 10, source: "cache",
  disclaimer: lang === "en" ? "General information, not legal advice." : "Information générale, pas un avis juridique.",
});

beforeEach(() => {
  ask.mockReset();
  ask.mockImplementation(async (_q, lang) => answer(lang));
});

describe("RightsChat", () => {
  it("a suggested question gets an answer with its citation and the disclaimer", async () => {
    await render(<RightsChat />);
    await fireEvent.press(screen.getByText("Can I film police?"));
    expect(ask).toHaveBeenCalledWith("Can I film police?", "en");
    expect(await screen.findByText("Charter s. 2(b)")).toBeTruthy();
    expect(screen.getByText("General information, not legal advice.")).toBeTruthy();
  });

  it("switching to French re-asks the last question in French", async () => {
    await render(<RightsChat />);
    await fireEvent.press(screen.getByText("Can I film police?"));
    await screen.findByText("General information, not legal advice.");
    await fireEvent.press(screen.getByText("FR"));
    expect(ask).toHaveBeenLastCalledWith("Can I film police?", "fr");
    expect(await screen.findByText("Information générale, pas un avis juridique.")).toBeTruthy();
    expect(screen.getByText("Puis-je filmer la police ?")).toBeTruthy();
  });

  it("an error is shown in the chat instead of crashing", async () => {
    ask.mockRejectedValueOnce(new Error("The agent server didn't answer in time. Is it awake?"));
    await render(<RightsChat />);
    await fireEvent.press(screen.getByText("Do we need a permit?"));
    expect(await screen.findByText(/didn't answer in time/)).toBeTruthy();
  });

  it("always offers the legal observer", async () => {
    await render(<RightsChat />);
    expect(screen.getByText("Call your legal observer")).toBeTruthy();
    expect(screen.getByText("Legal-1")).toBeTruthy();
  });
});
