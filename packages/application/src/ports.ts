/** What the application layer needs from storage. Adapters (apps/api, packages/db) implement these. */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

export interface UserReader {
  findById(userId: string): Promise<UserRecord | null>;
}

export interface Ports {
  readonly users: UserReader;
}
