export enum AuthProvider {
  EMAIL_PASSWORD = 'email_password',
  PASSWORDLESS = 'passwordless',
  ANONYMOUS = 'anonymous',
}

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  ANONYMOUS = 'anonymous',
}

export interface UserDTO {
  id: string;
  nickname: string;
  avatarUrl?: string;
  role: UserRole;
  region: string;
}

export interface AuthPayload {
  userId: string;
  role: UserRole;
}
