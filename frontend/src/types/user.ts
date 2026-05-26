type UserRole = 'user' | 'admin';
type UserStatus = 'active' | 'blocked';

type User = {
  id: string;
  email: string;
  fullName: string;
  isSystemAdmin?: boolean;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string | null;
};

type AuthData = {
  email: string;
  password: string;
};

type RegisterData = AuthData & {
  fullName: string;
};

type UpdateUserAccessPayload = {
  userId: string;
  role?: UserRole;
  status?: UserStatus;
};

type AuthResponse = {
  user: User;
  accessToken: string;
  tokenType: 'Bearer';
};

export type { AuthData, AuthResponse, RegisterData, UpdateUserAccessPayload, User, UserRole, UserStatus };
