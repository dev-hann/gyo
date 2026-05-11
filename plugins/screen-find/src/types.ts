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

export interface FindResult {
  elements: ElementInfo[];
  count: number;
}
