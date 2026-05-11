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
