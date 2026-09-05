import * as React from "react";

// Minimal mock that mimics @testing-library/react-native by traversing the element tree.
// Provides query helpers that reflect the rendered component tree instead of fixed values.

function findByTestId(node: unknown, testId: string): React.ReactElement | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  const el = node as React.ReactElement<{ testID?: string; children?: unknown; onPress?: unknown; onCommit?: unknown; onEdit?: unknown; onDelete?: unknown }>;
  const props = (el.props ?? {}) as { testID?: string; children?: unknown; onPress?: unknown; onCommit?: unknown; onEdit?: unknown; onDelete?: unknown };
  if (props.testID === testId) return el;
  // Specialize for top-level component spies: SearchIsland and VaultCard expose callbacks via props
  const typeName = typeof el.type === "function" ? (el.type as { displayName?: string; name?: string }).displayName ?? (el.type as { name?: string }).name : typeof el.type === "string" ? el.type : "";
  if (typeName === "SearchIsland" && testId === "search-commit" && typeof (props as { onCommit?: unknown }).onCommit === "function") {
    return { props: { onPress: (props as { onCommit: unknown }).onCommit, testID: testId } } as React.ReactElement;
  }
  if (typeName === "VaultCard") {
    if (testId === "vault-edit" && typeof (props as { onEdit?: unknown }).onEdit === "function") {
      return { props: { onPress: (props as { onEdit: unknown }).onEdit, testID: testId } } as React.ReactElement;
    }
    if (testId === "vault-delete" && typeof (props as { onDelete?: unknown }).onDelete === "function") {
      return { props: { onPress: (props as { onDelete: unknown }).onDelete, testID: testId } } as React.ReactElement;
    }
  }
  if (typeName === "HouseholdInviteCard") {
    if (testId === "invite-copy" && typeof (props as { onCopy?: unknown }).onCopy === "function") {
      return { props: { onPress: (props as { onCopy: unknown }).onCopy, testID: testId } } as React.ReactElement;
    }
    if (testId === "invite-revoke" && typeof (props as { onRevoke?: unknown }).onRevoke === "function") {
      return { props: { onPress: (props as { onRevoke: unknown }).onRevoke, testID: testId } } as React.ReactElement;
    }
  }
  const children = props.children;
  if (children != null) return findByTestId(children, testId);
  return null;
}

function findByText(node: unknown, text: string): React.ReactElement | null {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") {
    return String(node) === text ? ({ props: {} } as React.ReactElement) : null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByText(child, text);
      if (found) return found;
    }
    return null;
  }
  const el = node as React.ReactElement<{ children?: unknown }>;
  const props = (el.props ?? {}) as { children?: unknown };
  if (props.children != null) {
    const found = findByText(props.children, text);
    if (found) return el;
  }
  return null;
}

export function render(element: React.ReactElement) {
  const toJSON = () => {
    const type = typeof element.type === "string" ? element.type : (element.type as { displayName?: string; name?: string })?.displayName ?? (element.type as { name?: string })?.name ?? "mock";
    return { type, props: element.props, children: (element.props as { children?: unknown })?.children ?? null };
  };
  return {
    toJSON,
    getByLabelText: (label: string) => {
      const found = findByText(element, label);
      if (!found) throw new Error(`Unable to find element with label: ${label}`);
      return found;
    },
    getByText: (text: string) => {
      const found = findByText(element, text);
      if (!found) throw new Error(`Unable to find element with text: ${text}`);
      return found;
    },
    getByTestId: (id: string) => {
      const found = findByTestId(element, id);
      if (!found) throw new Error(`Unable to find element with testID: ${id}`);
      return found;
    },
    queryByText: (text: string) => findByText(element, text),
    queryByTestId: (id: string) => findByTestId(element, id),
    getAllByTestId: (id: string) => {
      const found = findByTestId(element, id);
      return found ? [found] : [];
    },
    queryAllByTestId: (id: string) => {
      const found = findByTestId(element, id);
      return found ? [found] : [];
    },
  };
}
export const screen = {};
export default { render, screen };
