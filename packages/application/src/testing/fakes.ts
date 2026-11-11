import type {
  ChecklistItemRecord,
  ChecklistWriter,
  AuditEventInput,
  DestinationRecord,
  DestinationWriter,
  ExpenseRecord,
  ExpenseWriter,
  SavingsRecord,
  SavingsWriter,
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
  /** Routes by trip id. */
  destinations: Map<string, DestinationRecord[]>;
  expenses: Map<string, ExpenseRecord>;
  checklist: Map<string, ChecklistItemRecord>;
  savings: Map<string, SavingsRecord>;
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
    destinations: new Map(),
    expenses: new Map(),
    checklist: new Map(),
    savings: new Map(),
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
        theme: 'system' as const,
        motion: 'full' as const,
      };
      const next: PreferencesRecord = {
        locale: patch.locale ?? current.locale,
        currency: patch.currency ?? current.currency,
        homeCountry: patch.homeCountry === undefined ? current.homeCountry : patch.homeCountry,
        nationality: patch.nationality === undefined ? current.nationality : patch.nationality,
        timeZone: patch.timeZone === undefined ? current.timeZone : patch.timeZone,
        units: patch.units ?? current.units,
        theme: patch.theme ?? current.theme,
        motion: patch.motion ?? current.motion,
      };
      state.preferences.set(userId, next);
      return next;
    },
  };

  const destinationWriter: DestinationWriter = {
    async listByTrip(tripId) {
      return [...(state.destinations.get(tripId) ?? [])];
    },
    async replaceForTrip(tripId, items, now) {
      const records = items.map((item, position): DestinationRecord => ({
        ...item,
        tripId,
        position,
        createdAt: now,
        updatedAt: now,
      }));
      state.destinations.set(tripId, records);
      return [...records];
    },
  };

  const expenseWriter: ExpenseWriter = {
    async listByTrip(tripId) {
      return [...state.expenses.values()]
        .filter((record) => record.tripId === tripId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(id) {
      return state.expenses.get(id) ?? null;
    },
    async insert(expense) {
      const record: ExpenseRecord = { ...expense, updatedAt: expense.createdAt };
      state.expenses.set(record.id, record);
      return record;
    },
    async update(id, patch, updatedAt) {
      const current = state.expenses.get(id);
      if (!current) throw new Error('expense vanished');
      const next: ExpenseRecord = { ...current, ...patch, updatedAt };
      state.expenses.set(id, next);
      return next;
    },
    async delete(id) {
      state.expenses.delete(id);
    },
    async countByTrip(tripId) {
      return [...state.expenses.values()].filter((record) => record.tripId === tripId).length;
    },
  };

  const checklistWriter: ChecklistWriter = {
    async listByTrip(tripId) {
      return [...state.checklist.values()]
        .filter((record) => record.tripId === tripId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async findById(id) {
      return state.checklist.get(id) ?? null;
    },
    async insertMany(items) {
      return items.map((item) => {
        const record: ChecklistItemRecord = { ...item, updatedAt: item.createdAt };
        state.checklist.set(record.id, record);
        return record;
      });
    },
    async update(id, patch, updatedAt) {
      const current = state.checklist.get(id);
      if (!current) throw new Error('checklist item vanished');
      const next: ChecklistItemRecord = { ...current, ...patch, updatedAt };
      state.checklist.set(id, next);
      return next;
    },
    async delete(id) {
      state.checklist.delete(id);
    },
    async countByTrip(tripId) {
      return [...state.checklist.values()].filter((record) => record.tripId === tripId).length;
    },
  };

  const savingsWriter: SavingsWriter = {
    async find(tripId) {
      return state.savings.get(tripId) ?? null;
    },
    async upsert(tripId, patch) {
      const current = state.savings.get(tripId) ?? { tripId, savedMinor: 0n, monthlyMinor: 0n };
      const next: SavingsRecord = {
        tripId,
        savedMinor: patch.savedMinor ?? current.savedMinor,
        monthlyMinor: patch.monthlyMinor ?? current.monthlyMinor,
      };
      state.savings.set(tripId, next);
      return next;
    },
  };

  const transaction: Transaction = {
    trips: tripWriter,
    expenses: expenseWriter,
    checklist: checklistWriter,
    savings: savingsWriter,
    destinations: destinationWriter,
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
    destinations: destinationWriter,
    expenses: expenseWriter,
    checklist: checklistWriter,
    savings: savingsWriter,
    preferences: preferencesWriter,
    unitOfWork: {
      // Commit or roll back as one, like a database transaction.
      async run(work) {
        const before: FakeState = {
          trips: new Map(state.trips),
          destinations: new Map(state.destinations),
          expenses: new Map(state.expenses),
          checklist: new Map(state.checklist),
          savings: new Map(state.savings),
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
          state.destinations = before.destinations;
          state.expenses = before.expenses;
          state.checklist = before.checklist;
          state.savings = before.savings;
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
