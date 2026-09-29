import assert from "node:assert/strict";
import test from "node:test";
import type { BubbleMenuProps } from "@tiptap/react/menus";
import * as editorBubble from "./editor-bubble";

type BubbleOptions = BubbleMenuProps["options"];
type ResolveBubbleMenuOptions = (
  nativeOptions?: BubbleOptions,
  legacyOptions?: {
    duration?: number | [number, number];
    onHidden?: () => void;
    placement?: NonNullable<BubbleOptions>["placement"];
  },
) => BubbleOptions;

function resolver(): ResolveBubbleMenuOptions {
  const value = (editorBubble as Record<string, unknown>).resolveBubbleMenuOptions;
  assert.equal(
    typeof value,
    "function",
    "resolveBubbleMenuOptions must be exported for focused contract tests",
  );
  return value as ResolveBubbleMenuOptions;
}

test("legacy bubble options map placement and hidden callback without duration", () => {
  const onHidden = () => undefined;
  const options = resolver()(undefined, {
    duration: [100, 150],
    onHidden,
    placement: "bottom-start",
  });

  assert.equal(options?.placement, "bottom-start");
  assert.equal(options?.onHide, onHidden);
  assert.equal("duration" in (options ?? {}), false);
});

test("native bubble options retain fields and override legacy mappings", () => {
  const nativeOnHide = () => undefined;
  const nativeOnUpdate = () => undefined;
  const native: BubbleOptions = {
    strategy: "fixed",
    placement: "right-end",
    offset: { mainAxis: 12, crossAxis: 3 },
    flip: false,
    onHide: nativeOnHide,
    onUpdate: nativeOnUpdate,
  };

  const options = resolver()(native, {
    onHidden: () => undefined,
    placement: "top",
  });

  assert.equal(options?.strategy, "fixed");
  assert.equal(options?.placement, "right-end");
  assert.deepEqual(options?.offset, { mainAxis: 12, crossAxis: 3 });
  assert.equal(options?.flip, false);
  assert.equal(options?.onHide, nativeOnHide);
  assert.equal(options?.onUpdate, nativeOnUpdate);
});

test("native bubble options keep the same meaning without legacy options", () => {
  const native: BubbleOptions = {
    placement: "left",
    shift: { padding: 8 },
    onShow: () => undefined,
  };

  assert.deepEqual(resolver()(native), native);
});
