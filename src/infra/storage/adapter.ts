export interface StorageUploadResult {
  key: string;
}

export interface StorageAdapter {
  upload(
    key: string,
    data: Buffer,
    contentType: string
  ): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

export default StorageAdapter;
