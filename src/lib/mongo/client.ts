import { MongoClient, Db, Collection, Document as MongoDocument } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "sendora";

if (!uri) {
    throw new Error(
        "MONGODB_URI is not set. Add it to .env.local — e.g. MONGODB_URI=mongodb://localhost:27017 or your Atlas connection string."
    );
}

// Reuse a single client across hot reloads in dev
declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;
if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
        const client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db(dbName);
}

export async function getCollection<T extends MongoDocument = MongoDocument>(name: string): Promise<Collection<T>> {
    const db = await getDb();
    return db.collection<T>(name);
}
