export interface CallParams {
  phoneNumber: string;
}

export interface GetCallLogParams {
  limit: number;
}

export interface CallLogEntry {
  number: string;
  name: string;
  date: number;
  duration: number;
  type: string;
}

export interface CallLogResult {
  entries: CallLogEntry[];
  count: number;
}
