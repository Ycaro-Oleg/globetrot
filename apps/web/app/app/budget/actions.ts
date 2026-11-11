'use server';

import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';

async function apiClient() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) redirect('/login?next=%2Fapp%2Fbudget');
  return createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** Adds a cost to the trip. The API validates every value and converts; nothing is checked twice here. */
export async function addExpense(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  const category = EXPENSE_CATEGORIES.find((candidate) => candidate === text(formData, 'category'));
  const status = EXPENSE_STATUSES.find((candidate) => candidate === text(formData, 'status'));
  if (!tripId || !category || !status) redirect('/app/budget?status=expense-error');
  const fxRate = text(formData, 'fxRate');
  const client = await apiClient();
  const { data } = await client.POST('/v1/trips/{id}/expenses', {
    params: { path: { id: tripId } },
    body: {
      description: text(formData, 'description'),
      category,
      status,
      amount: text(formData, 'amount'),
      currency: text(formData, 'currency'),
      ...(fxRate ? { fxRate } : {}),
    },
  });
  redirect(data ? '/app/budget?status=expense-added' : '/app/budget?status=expense-error');
}

export async function removeExpense(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  const expenseId = text(formData, 'expenseId');
  if (!tripId || !expenseId) redirect('/app/budget?status=expense-error');
  const client = await apiClient();
  const { data } = await client.DELETE('/v1/trips/{id}/expenses/{expenseId}', {
    params: { path: { id: tripId, expenseId } },
  });
  redirect(data ? '/app/budget?status=expense-removed' : '/app/budget?status=expense-error');
}

/** Saves what is set aside and the monthly amount. A blank field is left as it was. */
export async function saveSavings(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  if (!tripId) redirect('/app/budget?status=savings-error');
  const saved = text(formData, 'saved');
  const monthly = text(formData, 'monthly');
  if (!saved && !monthly) redirect('/app/budget?status=savings-error');
  const client = await apiClient();
  const { data } = await client.PUT('/v1/trips/{id}/savings', {
    params: { path: { id: tripId } },
    body: { ...(saved ? { saved } : {}), ...(monthly ? { monthly } : {}) },
  });
  redirect(data ? '/app/budget?status=savings-saved' : '/app/budget?status=savings-error');
}
