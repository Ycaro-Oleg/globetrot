import type {
  AuditEventInput,
  NewTrip,
  Ports,
  PreferencesRecord,
  PreferencesWriter,
  Transaction,
  TripPatch,
  TripRecord,
  TripWriter,
  UserRecord,
} from '../ports';

/** In-memory ports for unit tests (here and in apps/api). Real adapters are tested against PostgreSQL. */
export interface FakeState {
  trips: Map<string, TripRecord>;
  preferences: Map<string, PreferencesRecord>;
  audit: AuditEventInput[];
  idempotency: Map<string, { fingerprint: string; response: unknown }>;
}

export interface FakeOptions {
  readonly users?: readonly UserRecord[];
  readonly now?: Date;
}

export function createFakePorts(options: FakeOptions = {}) {
  const users = [...(options.users ?? [])];
  let time = options.now ?? new Date('2026-11-07T12:00:00.000Z');
  let counter = 0;
  const faults = { auditFails: false };
  const state: FakeState = {
    trips: new Map(),
    preferences: new Map(),
    audit: [],
    idempotency: new Map(),
  };

  const tripWriter: TripWriter = {
    async findById(id) {
      return state.trips.get(id) ?? null;
    },
    async listByOwner(ownerId, { includeArchived }) {
      return [...state.trips.values()]
        .filter((trip) => trip.ownerId === ownerId)
        .filter((trip) => includeArchived || trip.status !== 'archived')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async insert(trip: NewTrip) {
      const record: TripRecord = { ...trip, updatedAt: trip.createdAt };
      state.trips.set(record.id, record);
      return record;
    },
    async update(id: string, patch: TripPatch, updatedAt: Date) {
      const current = state.trips.get(id);
      if (!current) throw new Error('trip vanished');
      const next: TripRecord = {
        ...current,
        ...(patch.title === undefined ? {} : { title: patch.title }),
        ...(patch.startDate === undefined ? {} : { startDate: patch.startDate }),
        ...(patch.currency === undefined ? {} : { currency: patch.currency }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        updatedAt,
      };
      state.trips.set(id, next);
      return next;
    },
  };

  const preferencesWriter: PreferencesWriter = {
    async find(userId) {
      return state.preferences.get(userId) ?? null;
    },
    async upsert(userId, patch) {
      const current = state.preferences.get(userId) ?? {
        locale: 'en',
        currency: 'USD',
        homeCountry: null,
        nationality: null,
        timeZone: null,
        units: 'metric' as const,
      };
      const next: PreferencesRecord = {
        locale: patch.locale ?? current.locale,
        currency: patch.currency ?? current.currency,
        homeCountry: patch.homeCountry === undefined ? current.homeCountry : patch.homeCountry,
        nationality: patch.nationality === undefined ? current.nationality : patch.nationality,
        timeZone: patch.timeZone === undefined ? current.timeZone : patch.timeZone,
        units: patch.units ?? current.units,
      };
      state.preferences.set(userId, next);
      return next;
    },
  };

  const transaction: Transaction = {
    trips: tripWriter,
    preferences: preferencesWriter,
    audit: {
      async record(event) {
        if (faults.auditFails) throw new Error('audit store is down');
        state.audit.push(event);
      },
    },
    idempotency: {
      async begin({ ownerId, key, fingerprint }) {
        const id = `${ownerId}\u0000${key}`;
        const existing = state.idempotency.get(id);
        if (!existing) {
          state.idempotency.set(id, { fingerprint, response: undefined });
          return { state: 'new' };
        }
        if (existing.fingerprint !== fingerprint) return { state: 'mismatch' };
        return { state: 'replay', response: existing.response };
      },
      async complete(ownerId, key, response) {
        const entry = state.idempotency.get(`${ownerId}\u0000${key}`);
        if (entry) entry.response = response;
      },
    },
  };

  const ports: Ports = {
    users: {
      async findById(userId) {
        return users.find((user) => user.id === userId) ?? null;
      },
    },
    trips: tripWriter,
    preferences: preferencesWriter,
    unitOfWork: {
      // Commit or roll back as one, like a database transaction.
      async run(work) {
        const before: FakeState = {
          trips: new Map(state.trips),
          preferences: new Map(state.preferences),
          audit: [...state.audit],
          idempotency: new Map(
            [...state.idempotency].map(([key, value]) => [key, { ...value }] as const),
          ),
        };
        try {
          return await work(transaction);
        } catch (error) {
          state.trips = before.trips;
          state.preferences = before.preferences;
          state.audit = before.audit;
          state.idempotency = before.idempotency;
          throw error;
        }
      },
    },
    clock: { now: () => time },
    ids: {
      newId: () => `00000000-0000-7000-8000-${String(++counter).padStart(12, '0')}`,
    },
  };

  return {
    ports,
    /** Live view of what is stored. Reassigned on rollback, so read it through this object. */
    state,
    faults,
    setNow(date: Date) {
      time = date;
    },
  };
}
