import { isNodeSelection } from "@tiptap/core";
import { useCurrentEditor } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { forwardRef, useMemo } from "react";
import type { ReactNode } from "react";

type BubbleMenuPlacement = NonNullable<BubbleMenuProps["options"]>["placement"];

interface LegacyTippyOptions {
  readonly duration?: number | [number, number];
  readonly placement?: BubbleMenuPlacement;
}

export interface EditorBubbleProps extends Omit<BubbleMenuProps, "editor" | "options"> {
  readonly children: ReactNode;
  readonly tippyOptions?: LegacyTippyOptions;
}

export const EditorBubble = forwardRef<HTMLDivElement, EditorBubbleProps>(
  ({ children, tippyOptions, ...rest }, ref) => {
    const { editor: currentEditor } = useCurrentEditor();

    const bubbleMenuProps: Omit<BubbleMenuProps, "children"> = useMemo(() => {
      const shouldShow: BubbleMenuProps["shouldShow"] = ({ editor, state }) => {
        const { selection } = state;
        const { empty } = selection;

        // don't show bubble menu if:
        // - the editor is not editable
        // - the selected node is an image
        // - the selection is empty
        // - the selection is a node selection (for drag handles)
        if (!editor.isEditable || editor.isActive("image") || empty || isNodeSelection(selection)) {
          return false;
        }
        return true;
      };

      return {
        shouldShow,
        options: {
          placement: tippyOptions?.placement,
        },
        editor: currentEditor ?? undefined,
        ...rest,
      };
    }, [rest, tippyOptions]);

    if (!currentEditor) return null;

    return (
      // We need to add this because of https://github.com/ueberdosis/tiptap/issues/2658
      <div ref={ref}>
        <BubbleMenu {...bubbleMenuProps}>{children}</BubbleMenu>
      </div>
    );
  },
);

EditorBubble.displayName = "EditorBubble";

export default EditorBubble;
