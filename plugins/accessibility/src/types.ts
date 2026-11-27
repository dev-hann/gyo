export interface AccessibilityStatus {
  /** True once the user has enabled the service in the system settings and it is connected. */
  enabled: boolean;
}

export interface NodeInfo {
  text: string;
  contentDescription: string;
  className: string;
  bounds: string;
  isClickable: boolean;
  isEditable: boolean;
  children: NodeInfo[];
}

export interface ReadResult {
  root: NodeInfo | null;
  windowName: string;
  packageName: string;
}

export interface FindParams {
  text: string;
}

/** What `ScreenReader.find()` returns: the nodes that hold the text, each with its children. */
export interface ScreenReaderFindResult {
  nodes: NodeInfo[];
  count: number;
}

export interface TapParams {
  x: number;
  y: number;
}

export interface TypeParams {
  text: string;
}

export interface SwipeParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
}

export interface GlobalActionParams {
  action: string;
}

export interface FindByTextParams {
  text: string;
  exact: boolean;
}

export interface FindByIdParams {
  id: string;
}

export interface ElementInfo {
  text: string;
  contentDescription: string;
  className: string;
  bounds: string;
  isClickable: boolean;
  isFocusable: boolean;
  isEditable: boolean;
  centerX: number;
  centerY: number;
}

/** What `ScreenFind.findByText()` and `ScreenFind.findById()` return: the elements found, each with its center. */
export interface ScreenFindResult {
  elements: ElementInfo[];
  count: number;
}
