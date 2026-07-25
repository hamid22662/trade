import {
  closeWebDatabase,
  deleteWebDatabaseForAccount,
  getWebDatabase,
  resetWebDatabase,
} from './webDatabase';

export const getDb = getWebDatabase;

export async function resetDatabase() {
  await resetWebDatabase();
}

export async function deleteAccountDatabase(accountId: string) {
  await deleteWebDatabaseForAccount(accountId);
}

export { closeWebDatabase };
