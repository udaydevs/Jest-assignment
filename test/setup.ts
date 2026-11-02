import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1' },
  });

  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error('Test database connection was not established');
  }

  const collections = await database.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
