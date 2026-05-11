export interface AppInfo {
  packageName: string;
  name: string;
}

export interface ListAppsResult {
  apps: AppInfo[];
  count: number;
}

export interface OpenAppParams {
  packageName: string;
}

export interface OpenUrlParams {
  url: string;
}

export interface SearchAppsParams {
  query: string;
}

export interface SearchAppsResult {
  apps: AppInfo[];
  count: number;
}
