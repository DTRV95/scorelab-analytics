import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * jsdom has no layout engine, so it cannot catch the bug this guards: the
 * dialog is a grid, a grid's implicit column is sized `auto`, and `auto`'s
 * maximum is max-content — so one wide child stretched the column past
 * `max-w-lg` and dragged every sibling out of the box with it. Measured in
 * Chromium, a 340px dialog was laying its contents out at 1113px.
 *
 * What is checkable here is that the column stays named. Removing the class
 * brings the whole thing back.
 */
describe("the dialog box holds its width", () => {
  it("names its own column instead of letting the content size it", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Inserir jogo</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(dialog.className).toContain("max-w-lg");
  });
});
