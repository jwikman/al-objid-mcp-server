export interface AuthorizationInfo {
  authKey: string;
  authorized: boolean;
  error?: string;
  user?: { name: string; email: string };
  valid?: boolean;
}