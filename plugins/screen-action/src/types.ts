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
