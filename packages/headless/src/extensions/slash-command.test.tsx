import assert from "node:assert/strict";
import test from "node:test";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import type { RefObject } from "react";
import * as slashCommand from "./slash-command";

type Allow = NonNullable<SuggestionOptions["allow"]>;

interface RendererLike {
  readonly element: HTMLElement;
  readonly ref?: { onKeyDown: (props: SuggestionKeyDownProps) => boolean };
  destroy(): void;
  updateProps(props: SuggestionProps): void;
}

type RendererFactory = (props: SuggestionProps) => RendererLike;
type RenderLifecycle = ReturnType<
  (elementRef: RefObject<Element> | null | undefined, createRenderer: RendererFactory) => {
    onStart(props: SuggestionProps): void;
    onUpdate(props: SuggestionProps): void;
    onKeyDown(props: { event: KeyboardEvent }): boolean;
    onExit(): void;
  }
>;

function requireFunction<T>(name: string): T {
  const value = (slashCommand as Record<string, unknown>)[name];
  assert.equal(typeof value, "function", `${name} must be exported for focused contract tests`);
  return value as T;
}

function allowProps(nodeName: string): Parameters<Allow>[0] {
  return {
    editor: {},
    range: { from: 4, to: 5 },
    state: {
      doc: {
        resolve: (position: number) => {
          assert.equal(position, 4);
          return { parent: { type: { name: nodeName } } };
        },
      },
    },
  } as unknown as Parameters<Allow>[0];
}

function suggestionProps(mount: SuggestionProps["mount"]): SuggestionProps {
  return {
    editor: {},
    range: { from: 1, to: 2 },
    query: "",
    text: "/",
    items: [],
    command: () => undefined,
    decorationNode: null,
    clientRect: null,
    placement: "bottom-start",
    offset: { mainAxis: 4, crossAxis: 0 },
    flip: true,
    floatingUi: { placement: "bottom-start", strategy: "absolute", middleware: [] },
    mount,
    loading: false,
  } as unknown as SuggestionProps;
}

test("slash allow accepts paragraphs and rejects code blocks", () => {
  const createSlashCommandAllow = requireFunction<(allow?: Allow) => Allow>(
    "createSlashCommandAllow",
  );
  const allow = createSlashCommandAllow();

  assert.equal(allow(allowProps("paragraph")), true);
  assert.equal(allow(allowProps("codeBlock")), false);
});

test("slash allow composes the consumer veto after the code-block guard", () => {
  const createSlashCommandAllow = requireFunction<(allow?: Allow) => Allow>(
    "createSlashCommandAllow",
  );
  let consumerCalls = 0;
  const consumerAllow: Allow = () => {
    consumerCalls += 1;
    return false;
  };

  assert.equal(createSlashCommandAllow(consumerAllow)(allowProps("paragraph")), false);
  assert.equal(consumerCalls, 1);

  const permissiveAllow: Allow = () => {
    consumerCalls += 1;
    return true;
  };
  assert.equal(createSlashCommandAllow(permissiveAllow)(allowProps("codeBlock")), false);
  assert.equal(consumerCalls, 1, "the consumer callback must not run inside a code block");
});

test("slash renderer mounts once, updates props, delegates keys, and cleans up once", () => {
  const createRenderItems = requireFunction<
    (elementRef: RefObject<Element> | null | undefined, createRenderer: RendererFactory) => RenderLifecycle
  >("createRenderItems");
  let mountCalls = 0;
  let unmountCalls = 0;
  let updateCalls = 0;
  let destroyCalls = 0;
  const element = { remove: () => undefined } as unknown as HTMLElement;
  const renderer: RendererLike = {
    element,
    ref: { onKeyDown: ({ event }: { event: KeyboardEvent }) => event.key === "Enter" },
    updateProps: () => {
      updateCalls += 1;
    },
    destroy: () => {
      destroyCalls += 1;
    },
  };
  const lifecycle = createRenderItems(undefined, () => renderer);
  const props = suggestionProps((mountedElement) => {
    mountCalls += 1;
    assert.equal(mountedElement, element);
    return () => {
      unmountCalls += 1;
    };
  });

  lifecycle.onStart(props);
  lifecycle.onUpdate({ ...props, query: "hea" });
  assert.equal(lifecycle.onKeyDown({ event: { key: "Escape" } as KeyboardEvent }), true);
  assert.equal(lifecycle.onKeyDown({ event: { key: "Enter" } as KeyboardEvent }), true);
  assert.equal(lifecycle.onKeyDown({ event: { key: "ArrowLeft" } as KeyboardEvent }), false);
  lifecycle.onExit();
  lifecycle.onExit();

  assert.equal(mountCalls, 1);
  assert.equal(updateCalls, 1);
  assert.equal(unmountCalls, 1);
  assert.equal(destroyCalls, 1);
});

test("legacy container owns the mounted element while a null ref delegates ownership", () => {
  const createRenderItems = requireFunction<
    (elementRef: RefObject<Element> | null | undefined, createRenderer: RendererFactory) => RenderLifecycle
  >("createRenderItems");
  let appendCalls = 0;
  let removeCalls = 0;
  const element = {
    remove: () => {
      removeCalls += 1;
    },
  } as unknown as HTMLElement;
  const renderer: RendererLike = {
    element,
    updateProps: () => undefined,
    destroy: () => undefined,
  };
  const container = {
    appendChild: (child: Node) => {
      appendCalls += 1;
      assert.equal(child, element);
      return child;
    },
  } as unknown as Element;
  const mount: SuggestionProps["mount"] = () => () => undefined;

  const owned = createRenderItems({ current: container }, () => renderer);
  owned.onStart(suggestionProps(mount));
  owned.onExit();
  assert.equal(appendCalls, 1);
  assert.equal(removeCalls, 1);

  const delegated = createRenderItems({ current: null }, () => renderer);
  delegated.onStart(suggestionProps(mount));
  delegated.onExit();
  assert.equal(appendCalls, 1);
  assert.equal(removeCalls, 1);
});
