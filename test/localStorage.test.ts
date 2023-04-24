import StorageProvider from '../src/localStorage';

describe('StorageProvider', () => {
  const storageProvider = new StorageProvider();

  beforeEach(() => {
    localStorage.clear();
  });

  test('setItem should set item in localStorage', async () => {
    await storageProvider.setItem('testKey', 'testValue');
    expect(localStorage.getItem('testKey')).toBe('testValue');
  });

  test('getItem should return item from localStorage', async () => {
    localStorage.setItem('testKey', 'testValue');
    const result = await storageProvider.getItem('testKey');
    expect(result).toBe('testValue');
  });

  test('getItem should return empty string if key does not exist', async () => {
    const result = await storageProvider.getItem('nonExistentKey');
    expect(result).toBe('');
  });
});
