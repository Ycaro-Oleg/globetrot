// One file per area; every table is exported from here so `connectDatabase` can type queries with it.
// Further tables are added by the issues that need them. Conventions: docs/architecture/data-model.md.
export * from './auth';
export * from './trip';
export * from './preference';
export * from './destination';
export * from './budget';
export * from './checklist';
export * from './visa';
