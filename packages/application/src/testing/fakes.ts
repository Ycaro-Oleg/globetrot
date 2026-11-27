import type {
  PlaceResult,
  SightResult,
  ChecklistItemRecord,
  ChecklistWriter,
  StampRecordRow,
  VisaRecord,
  VisaWriter,
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
  DayPlaceRecord,
  DayPlaceWriter,
  MediaRecord,
  MediaWriter,
  AccountWriter,
  AssistantWriter,
  BillingWriter,
  ProposalRecord,
  SubscriptionRecord,
  ShareWriter,
  TripShareRecord,
} from '../ports';
import {
  createFakeCommunity,
  emptyCommunityState,
  type FakeCommunityState,
} from './fake-community';

/** In-memory ports for unit tests (here and in apps/api). Real adapters are tested against PostgreSQL. */
export interface FakeState {
  trips: Map<string, TripRecord>;
  /** Routes by trip id. */
  destinations: Map<string, DestinationRecord[]>;
  expenses: Map<string, ExpenseRecord>;
  checklist: Map<string, ChecklistItemRecord>;
  /** First-earned stamps, keyed by `${tripId}\u0000${milestone}`. */
  stamps: Map<string, StampRecordRow & { readonly tripId: string }>;
  dayPlaces: Map<string, DayPlaceRecord>;
  /** Keyed by `${userId}\u0000${countryCode}`. */
  visas: Map<string, VisaRecord>;
  savings: Map<string, SavingsRecord>;
  preferences: Map<string, PreferencesRecord>;
  community: FakeCommunityState;
  media: Map<string, MediaRecord>;
  proposals: Map<string, ProposalRecord>;
  aiUsage: { userId: string; createdAt: Date }[];
  /** When each account signed up; an account not listed signed up "now" (in its trial). */
  signedUpAt: Map<string, Date>;
  subscriptions: Map<string, SubscriptionRecord>;
  /** Public links by trip id. */
  shares: Map<string, TripShareRecord>;
  credits: { userId: string; delta: number; reason: string; ref: string | null }[];
  passes: {
    id: string;
    tripId: string;
    userId: string;
    purchasedAt: Date;
    validUntil: Date;
    providerRef: string;
  }[];
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
  /** Whether the fake payment provider is configured. */
  const payments = { enabled: false };
  const places = {
    offline: false,
    hits: new Map<string, number>(),
    known: [
      {
        key: 'fake:kyoto',
        name: 'Kyoto',
        countryCode: 'JP',
        region: 'Kansai',
        latitude: 35.0116,
        longitude: 135.7681,
        attribution: '© OpenStreetMap contributors',
      },
    ] as PlaceResult[],
    /** What the fake provider answers for sights (none unless a test sets them). */
    sights: [] as SightResult[],
  };
  const state: FakeState = {
    trips: new Map(),
    destinations: new Map(),
    expenses: new Map(),
    checklist: new Map(),
    stamps: new Map(),
    dayPlaces: new Map(),
    visas: new Map(),
    savings: new Map(),
    preferences: new Map(),
    community: emptyCommunityState(),
    media: new Map(),
    proposals: new Map(),
    aiUsage: [],
    signedUpAt: new Map(),
    subscriptions: new Map(),
    shares: new Map(),
    credits: [],
    passes: [],
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
    async copiesOf(ownerId, postIds) {
      const copies = new Map<string, string>();
      for (const trip of state.trips.values()) {
        const from = trip.copiedFromPostId;
        if (
          trip.ownerId === ownerId &&
          trip.status !== 'archived' &&
          from &&
          postIds.includes(from)
        ) {
          copies.set(from, trip.id);
        }
      }
      return copies;
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
        homeCity: null,
        homePoint: null,
        pipOptIn: false,
        pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
        pipName: null,
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
        homeCity: patch.homeCity === undefined ? current.homeCity : patch.homeCity,
        homePoint: patch.homePoint === undefined ? current.homePoint : patch.homePoint,
        pipOptIn: patch.pipOptIn ?? current.pipOptIn,
        pipLook: patch.pipLook ?? current.pipLook,
        pipName: patch.pipName === undefined ? current.pipName : patch.pipName,
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

  const dayPlaceWriter: DayPlaceWriter = {
    async listByTrip(tripId) {
      return [...state.dayPlaces.values()]
        .filter((record) => record.tripId === tripId)
        .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
    },
    async findById(id) {
      return state.dayPlaces.get(id) ?? null;
    },
    async insert(row) {
      const record: DayPlaceRecord = { ...row, updatedAt: row.createdAt };
      state.dayPlaces.set(record.id, record);
      return record;
    },
    async placeMany(entries, updatedAt) {
      for (const entry of entries) {
        const current = state.dayPlaces.get(entry.id);
        if (current) state.dayPlaces.set(entry.id, { ...current, ...entry, updatedAt });
      }
    },
    async delete(id) {
      state.dayPlaces.delete(id);
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
    async stamps(tripId) {
      return [...state.stamps.values()]
        .filter((stamp) => stamp.tripId === tripId)
        .map(({ milestone, earnedOn }) => ({ milestone, earnedOn }));
    },
    async addStamps(tripId, stamps) {
      for (const stamp of stamps) {
        const key = `${tripId}\u0000${stamp.milestone}`;
        if (!state.stamps.has(key)) state.stamps.set(key, { tripId, ...stamp });
      }
    },
  };

  const visaWriter: VisaWriter = {
    async listByUser(userId) {
      return [...state.visas.values()]
        .filter((record) => record.userId === userId)
        .sort((a, b) => b.stampedAt.getTime() - a.stampedAt.getTime());
    },
    async stampMissing(userId, entries, now) {
      const stamped: VisaRecord[] = [];
      for (const entry of entries) {
        const key = `${userId}\u0000${entry.countryCode}`;
        if (state.visas.has(key)) continue;
        const record: VisaRecord = { userId, ...entry, stampedAt: now };
        state.visas.set(key, record);
        stamped.push(record);
      }
      return stamped;
    },
  };

  const savingsWriter: SavingsWriter = {
    async find(tripId) {
      return state.savings.get(tripId) ?? null;
    },
    async upsert(tripId, patch) {
      const current = state.savings.get(tripId) ?? {
        tripId,
        savedMinor: 0n,
        monthlyMinor: 0n,
        ceilingMinor: null,
      };
      const next: SavingsRecord = {
        tripId,
        savedMinor: patch.savedMinor ?? current.savedMinor,
        monthlyMinor: patch.monthlyMinor ?? current.monthlyMinor,
        ceilingMinor: patch.ceilingMinor === undefined ? current.ceilingMinor : patch.ceilingMinor,
      };
      state.savings.set(tripId, next);
      return next;
    },
  };

  const community = createFakeCommunity(
    () => state.community,
    () => users,
    () => state.preferences,
  );

  const storage = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const mediaWriter: MediaWriter = {
    async findById(id) {
      return state.media.get(id) ?? null;
    },
    async findMany(ids) {
      return ids.flatMap((id) => (state.media.has(id) ? [state.media.get(id)!] : []));
    },
    async insert(record) {
      state.media.set(record.id, record);
    },
    async countSince(ownerId, since) {
      return [...state.media.values()].filter((m) => m.ownerId === ownerId && m.createdAt >= since)
        .length;
    },
  };

  const removeTrip = (tripId: string) => {
    state.trips.delete(tripId);
    state.destinations.delete(tripId);
    state.savings.delete(tripId);
    for (const map of [state.expenses, state.checklist, state.dayPlaces] as Map<
      string,
      { tripId: string }
    >[]) {
      for (const [id, row] of map) if (row.tripId === tripId) map.delete(id);
    }
  };
  const accountWriter: AccountWriter = {
    async exportFor(userId) {
      const found = users.find((u) => u.id === userId);
      if (!found) return null;
      const trips = [...state.trips.values()].filter((t) => t.ownerId === userId);
      return JSON.parse(
        JSON.stringify({
          account: { name: found.name, email: found.email },
          preferences: state.preferences.get(userId) ?? null,
          trips: trips.map((t) => ({ ...t, stops: state.destinations.get(t.id) ?? [] })),
          visas: [...state.visas.values()].filter((v) => v.userId === userId),
          community: {
            handle: state.community.profiles.get(userId) ?? null,
            posts: [...state.community.posts.values()].filter((p) => p.authorId === userId),
          },
          media: [...state.media.values()].filter((m) => m.ownerId === userId),
        }),
      );
    },
    async mediaIdsOf(userId) {
      return [...state.media.values()].filter((m) => m.ownerId === userId).map((m) => m.id);
    },
    async deleteAccount(userId) {
      for (const t of [...state.trips.values()]) if (t.ownerId === userId) removeTrip(t.id);
      state.preferences.delete(userId);
      for (const [key, v] of state.visas) if (v.userId === userId) state.visas.delete(key);
      for (const [id, m] of state.media) if (m.ownerId === userId) state.media.delete(id);
      const c = state.community;
      c.profiles.delete(userId);
      for (const [id, p] of c.posts) if (p.authorId === userId) c.posts.delete(id);
      for (const [id, cm] of c.comments) if (cm.authorId === userId) c.comments.delete(id);
      const index = users.findIndex((u) => u.id === userId);
      if (index >= 0) users.splice(index, 1);
    },
    async deleteArchivedTrip(tripId, ownerId) {
      const t = state.trips.get(tripId);
      if (!t || t.ownerId !== ownerId || t.status !== 'archived') return false;
      removeTrip(tripId);
      return true;
    },
  };

  /** What the fake model answers next: a JSON string, or null for "not available". */
  const ai: { next: string | null; requests: { system: string; user: string }[] } = {
    next: '{"summary":"","changes":[]}',
    requests: [],
  };
  const assistantWriter: AssistantWriter = {
    async findProposal(id) {
      return state.proposals.get(id) ?? null;
    },
    async listProposals(tripId, limit) {
      return [...state.proposals.values()]
        .filter((p) => p.tripId === tripId)
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, limit);
    },
    async insertProposal(record) {
      state.proposals.set(record.id, {
        ...record,
        status: 'proposed',
        applied: [],
        undo: null,
        decidedAt: null,
      });
    },
    async updateProposal(id, patch) {
      const current = state.proposals.get(id);
      // Stored as JSON in the database: keep the fake honest about that.
      if (!current) return;
      const undo = patch.undo === undefined ? current.undo : JSON.parse(JSON.stringify(patch.undo));
      state.proposals.set(id, { ...current, ...patch, undo });
    },
    async recordUsage(row) {
      state.aiUsage.push({ userId: row.userId, createdAt: row.createdAt });
    },
    async countRequestsSince(userId, since) {
      return state.aiUsage.filter((u) => u.userId === userId && u.createdAt >= since).length;
    },
  };

  const billingWriter: BillingWriter = {
    async findAccount(userId) {
      if (!users.some((user) => user.id === userId)) return null;
      return {
        signedUpAt: state.signedUpAt.get(userId) ?? time,
        subscription: state.subscriptions.get(userId) ?? null,
        topUpBalance: state.credits
          .filter((line) => line.userId === userId)
          .reduce((sum, line) => sum + line.delta, 0),
        passes: state.passes
          .filter((pass) => pass.userId === userId)
          .map(({ tripId, validUntil }) => ({ tripId, validUntil })),
      };
    },
    async findProviderCustomer(userId) {
      return state.subscriptions.get(userId)?.providerCustomerId ?? null;
    },
    async findUserByProviderSubscription(id) {
      for (const [userId, record] of state.subscriptions) {
        if (record.providerSubscriptionId === id) return userId;
      }
      return null;
    },
    async addCredits(row) {
      if (row.ref !== null && state.credits.some((line) => line.ref === row.ref)) return false;
      state.credits.push({
        userId: row.userId,
        delta: row.delta,
        reason: row.reason,
        ref: row.ref,
      });
      return true;
    },
    async saveSubscription(userId, record) {
      state.subscriptions.set(userId, record);
    },
    async grantTripPass(row) {
      if (state.passes.some((pass) => pass.providerRef === row.providerRef)) return false;
      state.passes.push({ ...row });
      return true;
    },
  };

  const shareWriter: ShareWriter = {
    async findByTrip(tripId) {
      return state.shares.get(tripId) ?? null;
    },
    async findBySlug(slug) {
      return [...state.shares.values()].find((share) => share.slug === slug) ?? null;
    },
    async insert(record) {
      state.shares.set(record.tripId, record);
    },
    async setShowAmounts(tripId, showAmounts) {
      const current = state.shares.get(tripId);
      if (current) state.shares.set(tripId, { ...current, showAmounts });
    },
    async deleteByTrip(tripId) {
      state.shares.delete(tripId);
    },
  };

  const transaction: Transaction = {
    trips: tripWriter,
    expenses: expenseWriter,
    checklist: checklistWriter,
    dayPlaces: dayPlaceWriter,
    visas: visaWriter,
    savings: savingsWriter,
    destinations: destinationWriter,
    preferences: preferencesWriter,
    community,
    media: mediaWriter,
    account: accountWriter,
    assistant: assistantWriter,
    billing: billingWriter,
    shares: shareWriter,
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
    dayPlaces: dayPlaceWriter,
    visas: visaWriter,
    savings: savingsWriter,
    preferences: preferencesWriter,
    community,
    media: mediaWriter,
    storage: {
      async put(key, bytes, contentType) {
        storage.set(key, { bytes, contentType });
      },
      async get(key) {
        return storage.get(key)?.bytes ?? null;
      },
      async delete(key) {
        storage.delete(key);
      },
      async list(prefix) {
        return {
          keys: [...storage.keys()].filter((key) => key.startsWith(prefix)).sort(),
          next: null,
        };
      },
    },
    account: accountWriter,
    assistant: assistantWriter,
    billing: billingWriter,
    shares: shareWriter,
    payments: {
      async checkoutUrl(input) {
        return payments.enabled
          ? `https://pay.example.test/checkout?item=${input.item}&interval=${input.interval}&currency=${input.currency}${input.tripId ? `&trip=${input.tripId}` : ''}`
          : null;
      },
      async portalUrl(input) {
        return payments.enabled
          ? `https://pay.example.test/portal/${input.providerCustomerId}`
          : null;
      },
    },
    ai: {
      async completeJson(input) {
        ai.requests.push({ system: input.system, user: input.user });
        if (ai.next === null) return null;
        return {
          content: ai.next,
          provider: 'fake',
          model: 'fake-1',
          inputTokens: 10,
          outputTokens: 5,
        };
      },
    },
    unitOfWork: {
      // Commit or roll back as one, like a database transaction.
      async run(work) {
        const before: FakeState = {
          trips: new Map(state.trips),
          destinations: new Map(state.destinations),
          expenses: new Map(state.expenses),
          checklist: new Map(state.checklist),
          stamps: new Map(state.stamps),
          dayPlaces: new Map(state.dayPlaces),
          visas: new Map(state.visas),
          savings: new Map(state.savings),
          preferences: new Map(state.preferences),
          community: structuredClone(state.community),
          media: new Map(state.media),
          proposals: new Map(state.proposals),
          aiUsage: [...state.aiUsage],
          signedUpAt: new Map(state.signedUpAt),
          subscriptions: new Map(state.subscriptions),
          shares: new Map(state.shares),
          credits: [...state.credits],
          passes: [...state.passes],
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
          state.stamps = before.stamps;
          state.dayPlaces = before.dayPlaces;
          state.visas = before.visas;
          state.savings = before.savings;
          state.preferences = before.preferences;
          state.community = before.community;
          state.media = before.media;
          state.proposals = before.proposals;
          state.aiUsage = before.aiUsage;
          state.signedUpAt = before.signedUpAt;
          state.subscriptions = before.subscriptions;
          state.shares = before.shares;
          state.credits = before.credits;
          state.audit = before.audit;
          state.idempotency = before.idempotency;
          throw error;
        }
      },
    },
    clock: { now: () => time },
    ids: {
      newId: () => `00000000-0000-7000-8000-${String(++counter).padStart(12, '0')}`,
      newToken: () => `token${String(++counter).padStart(17, '0')}`,
    },
    cities: {
      // A few cities, like the built-in GeoNames index: prefix match, a name in another language for big ones.
      search(query, { language, limit }) {
        const fold = (text: string) =>
          text
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const q = fold(query.trim());
        return FAKE_CITIES.filter((city) =>
          [city.name, ...city.alts].some((n) => fold(n).startsWith(q)),
        )
          .slice(0, limit)
          .map((city) => ({
            key: city.key,
            name:
              language === 'pt-BR' &&
              city.alts.some((n) => fold(n).startsWith(q)) &&
              !fold(city.name).startsWith(q)
                ? city.alts.find((n) => fold(n).startsWith(q))!
                : city.name,
            countryCode: city.countryCode,
            region: city.region,
            latitude: city.latitude,
            longitude: city.longitude,
            attribution: 'GeoNames',
          }));
      },
    },
    geocoding: {
      // A tiny gazetteer: enough for the board's tests. `places.offline` makes it behave like a provider that is down.
      async search(query) {
        if (places.offline) return null;
        const text = query.toLowerCase();
        return places.known.filter((place) => place.name.toLowerCase().includes(text));
      },
      async reverse(point) {
        if (places.offline) return undefined;
        return (
          places.known.find(
            (place) =>
              Math.abs(place.latitude - point.latitude) < 0.5 &&
              Math.abs(place.longitude - point.longitude) < 0.5,
          ) ?? null
        );
      },
      async sights() {
        // Offline, or a provider with nothing around: the caller falls back to its own list.
        if (places.offline || places.sights.length === 0) return places.offline ? null : [];
        return places.sights;
      },
    },
    rateLimiter: {
      consume(key, limitPerMinute) {
        const used = (places.hits.get(key) ?? 0) + 1;
        places.hits.set(key, used);
        return used <= limitPerMinute;
      },
    },
  };

  return {
    ports,
    /** Live view of what is stored. Reassigned on rollback, so read it through this object. */
    state,
    faults,
    payments,
    places,
    ai,
    setNow(date: Date) {
      time = date;
    },
  };
}

const FAKE_CITIES = [
  {
    key: 'gn:6320062',
    name: 'Fortaleza',
    alts: [],
    countryCode: 'BR',
    region: 'Ceará',
    latitude: -3.717,
    longitude: -38.543,
  },
  {
    key: 'gn:2643743',
    name: 'London',
    alts: ['Londres'],
    countryCode: 'GB',
    region: 'England',
    latitude: 51.509,
    longitude: -0.126,
  },
  {
    key: 'gn:2267057',
    name: 'Lisbon',
    alts: ['Lisboa'],
    countryCode: 'PT',
    region: 'Lisbon',
    latitude: 38.717,
    longitude: -9.133,
  },
] as const;
