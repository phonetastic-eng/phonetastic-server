/**
 * Abstraction over object storage (Tigris/S3) for attachment file storage.
 */
export interface StorageService {
  /**
   * Uploads a file to object storage.
   *
   * @param key - The storage key (path) for the object.
   * @param content - The file content as a Buffer.
   * @param contentType - The MIME type of the file.
   */
  putObject(key: string, content: Buffer, contentType: string): Promise<void>;

  /**
   * Downloads a file from object storage.
   *
   * @param key - The storage key (path) of the object.
   * @returns The file content as a Buffer.
   */
  getObject(key: string): Promise<Buffer>;
}

/**
 * In-memory stub implementation of StorageService for testing.
 */
export class StubStorageService implements StorageService {
  private store = new Map<string, { content: Buffer; contentType: string }>();

  async putObject(key: string, content: Buffer, contentType: string): Promise<void> {
    this.store.set(key, { content, contentType });
  }

  async getObject(key: string): Promise<Buffer> {
    const entry = this.store.get(key);
    if (!entry) throw new Error(`Object not found: ${key}`);
    return entry.content;
  }

  /**
   * Clears all stored objects. For testing.
   */
  clear(): void {
    this.store.clear();
  }
}
