import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import type { RefObject } from "react";
import type { ReactNode } from "react";
import { EditorCommandOut } from "../components/editor-command";

type SuggestionAllow = NonNullable<SuggestionOptions["allow"]>;

interface CommandRenderer {
  readonly element: HTMLElement;
  readonly ref: { onKeyDown?: (props: SuggestionKeyDownProps) => boolean } | null;
  destroy(): void;
  updateProps(props: SuggestionProps): void;
}

type CommandRendererFactory = (props: SuggestionProps) => CommandRenderer;

export const createSlashCommandAllow = (userAllow?: SuggestionAllow): SuggestionAllow => {
  return (props) => {
    const parent = props.state.doc.resolve(props.range.from).parent;
    if (parent.type.name === "codeBlock") {
      return false;
    }

    return userAllow?.(props) ?? true;
  };
};

const Command = Extension.create({
  name: "slash-command",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      } as SuggestionOptions,
    };
  },
  addProseMirrorPlugins() {
    const suggestion = this.options.suggestion as SuggestionOptions;

    return [
      Suggestion({
        ...suggestion,
        editor: this.editor,
        allow: createSlashCommandAllow(suggestion.allow),
      }),
    ];
  },
});

export const createRenderItems = (
  elementRef: RefObject<Element> | null | undefined,
  createRenderer: CommandRendererFactory,
) => {
  let component: CommandRenderer | null = null;
  let unmount: (() => void) | null = null;
  let compatibilityContainerOwnsElement = false;
  let cleanedUp = true;

  return {
    onStart: (props: SuggestionProps) => {
      component = createRenderer(props);
      cleanedUp = false;

      const container = elementRef?.current;
      if (container) {
        container.appendChild(component.element);
        compatibilityContainerOwnsElement = true;
      }

      unmount = props.mount(component.element);
    },
    onUpdate: (props: SuggestionProps) => {
      component?.updateProps(props);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        return true;
      }

      return component?.ref?.onKeyDown?.(props) ?? false;
    },
    onExit: () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      unmount?.();
      unmount = null;

      if (compatibilityContainerOwnsElement) {
        component?.element.remove();
        compatibilityContainerOwnsElement = false;
      }

      component?.destroy();
      component = null;
    },
  };
};

const createReactRenderer: CommandRendererFactory = (props) =>
  new ReactRenderer(EditorCommandOut, {
    props,
    editor: props.editor,
  }) as CommandRenderer;

const renderItems = (elementRef?: RefObject<Element> | null) =>
  createRenderItems(elementRef, createReactRenderer);

export interface SuggestionItem {
  title: string;
  description: string;
  icon: ReactNode;
  searchTerms?: string[];
  command?: (props: { editor: Editor; range: Range }) => void;
}

export const createSuggestionItems = (items: SuggestionItem[]) => items;

export const handleCommandNavigation = (event: KeyboardEvent) => {
  if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
    const slashCommand = document.querySelector("#slash-command");
    if (slashCommand) {
      return true;
    }
  }
};

export { Command, renderItems };
