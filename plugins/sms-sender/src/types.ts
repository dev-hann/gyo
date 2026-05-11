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
