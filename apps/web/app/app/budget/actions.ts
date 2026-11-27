'use server';

import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '@globetrot/domain';
import { revalidatePath } from 'next/cache';
import { actionApiClient } from '../../../lib/action-client';

const apiClient = actionApiClient;

export interface ExpenseInput {
  readonly tripId: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly fxRate?: string | undefined;
  /** On a trip planned together, who paid it (a user id). */
  readonly paidBy?: string | null | undefined;
}

/**
 * Adds a cost to the trip. The API validates every value and converts with the rate typed; nothing is checked
 * twice here. Returns whether it worked, so the screen can say so (and offer an undo after a removal).
 */
export async function addExpense(input: ExpenseInput): Promise<{ ok: boolean }> {
  const category = EXPENSE_CATEGORIES.find((candidate) => candidate === input.category);
  const status = EXPENSE_STATUSES.find((candidate) => candidate === input.status);
  const client = await apiClient();
  if (!client || !category || !status || !input.tripId) return { ok: false };
  const fxRate = input.fxRate?.trim();
  const { data } = await client.POST('/v1/trips/{id}/expenses', {
    params: { path: { id: input.tripId } },
    body: {
      description: input.description.trim(),
      category,
      status,
      amount: input.amount.trim(),
      currency: input.currency,
      ...(fxRate ? { fxRate } : {}),
      ...(input.paidBy ? { paidBy: input.paidBy } : {}),
    },
  });
  if (data) revalidatePath('/app/budget');
  return { ok: Boolean(data) };
}

/** The person's own savings for their part of a shared trip. `true` when it saved. */
export async function saveMyMoney(
  tripId: string,
  body: { saved: string; monthly: string },
): Promise<boolean> {
  const client = await apiClient();
  if (!client || !tripId) return false;
  const { data } = await client.PUT('/v1/trips/{id}/money/me', {
    params: { path: { id: tripId } },
    body,
  });
  if (data) revalidatePath('/app/budget');
  return Boolean(data?.saved);
}

export async function removeExpense(tripId: string, expenseId: string): Promise<{ ok: boolean }> {
  const client = await apiClient();
  if (!client || !tripId || !expenseId) return { ok: false };
  const { data } = await client.DELETE('/v1/trips/{id}/expenses/{expenseId}', {
    params: { path: { id: tripId, expenseId } },
  });
  if (data) revalidatePath('/app/budget');
  return { ok: Boolean(data) };
}

export interface SavingsPatch {
  readonly saved?: string | undefined;
  readonly monthly?: string | undefined;
  /** `null` clears the ceiling. */
  readonly ceiling?: string | null | undefined;
}

/** Saves what is set aside, the monthly amount and the trip ceiling. Fields left out keep their value. */
export async function saveSavings(tripId: string, patch: SavingsPatch): Promise<{ ok: boolean }> {
  const client = await apiClient();
  if (!client || !tripId) return { ok: false };
  const body = {
    ...(patch.saved !== undefined ? { saved: patch.saved } : {}),
    ...(patch.monthly !== undefined ? { monthly: patch.monthly } : {}),
    ...(patch.ceiling !== undefined ? { ceiling: patch.ceiling } : {}),
  };
  if (!Object.keys(body).length) return { ok: false };
  const { data } = await client.PUT('/v1/trips/{id}/savings', {
    params: { path: { id: tripId } },
    body,
  });
  if (data) revalidatePath('/app/budget');
  return { ok: Boolean(data) };
}
