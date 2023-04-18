export default class StorageProvider {
  public async setItem(key: string, data: string): Promise<void> {
    try {
      localStorage.setItem(key, data);
    } catch (ex) {
      console.error(ex);
    }
  }

  public async getItem(key: string): Promise<string> {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      console.error(e);
      return "";
    }
  }
}
