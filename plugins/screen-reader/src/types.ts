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

export interface FindResult {
  nodes: NodeInfo[];
  count: number;
}
