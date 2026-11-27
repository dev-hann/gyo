export interface ContactInfo {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

export interface SearchParams {
  query: string;
}

export interface SearchResult {
  contacts: ContactInfo[];
  count: number;
}

export interface SendParams {
  phoneNumber: string;
  message: string;
}

export interface ReadParams {
  limit: number;
}

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  type: string;
}

export interface ReadResult {
  messages: SmsMessage[];
  count: number;
}

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
