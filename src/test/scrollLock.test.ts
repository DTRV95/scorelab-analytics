import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

/** Every selector list that sets overflow-x, with the block it belongs to. */
function blocksSetting(property: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of css.matchAll(pattern)) {
    const [, selector, body] = match;
    if (new RegExp(`${property}\\s*:`).test(body)) {
      found.push({ selector: selector.trim(), body: body.trim() });
    }
  }

  return found;
}

describe("the page behind an open dialog", () => {
  it("never puts overflow on html, which would unlock the page", () => {
    // A dialog's scroll lock is `body[data-scroll-locked] { overflow: hidden }`,
    // and the viewport only takes its overflow from body while html's own
    // overflow is still visible. The moment html carries an overflow of its
    // own, the viewport scrolls on html and that lock does nothing: opening
    // "Inserir jogo" on a phone and dragging to reach the games scrolled the
    // page behind the pop-up instead of the list inside it.
    const offenders = [
      ...blocksSetting("overflow-x"),
      ...blocksSetting("overflow-y"),
      ...blocksSetting("overflow"),
    ].filter(({ selector }) =>
      selector
        .split(",")
        .some((part) => /(^|\s)html\b/.test(part.trim()) && !part.includes("[")),
    );

    expect(offenders.map((entry) => entry.selector)).toEqual([]);
  });

  it("still keeps a too-wide child from dragging the page sideways", () => {
    // The containment moved to body and #root rather than being dropped.
    const containers = blocksSetting("overflow-x").filter(({ body }) =>
      /overflow-x\s*:\s*hidden/.test(body),
    );

    expect(
      containers.some(({ selector }) => /\bbody\b/.test(selector)),
    ).toBe(true);
    expect(
      containers.some(({ selector }) => /#root\b/.test(selector)),
    ).toBe(true);
  });
});
