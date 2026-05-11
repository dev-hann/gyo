import { ContactSearch } from '../ContactSearch';
import type { SearchResult } from '../types';

describe('ContactSearch', () => {
  let contactSearch: ContactSearch;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    contactSearch = new ContactSearch();
  });

  afterEach(() => {
    contactSearch.destroy();
  });

  describe('constructor', () => {
    it('should create instance with contact_search bridge name', () => {
      expect(contactSearch).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(contactSearch.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(contactSearch.isAvailable()).toBe(true);
    });
  });

  describe('search', () => {
    it('should invoke search with query and return contacts', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: SearchResult = {
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            phoneNumbers: ['+1234567890'],
            emails: ['john@example.com'],
          },
          {
            id: '2',
            name: 'John Smith',
            phoneNumbers: ['+0987654321'],
            emails: [],
          },
        ],
        count: 2,
      };

      const invokeSpy = jest.spyOn(
        (contactSearch as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await contactSearch.search({ query: 'john' });

      expect(result).toEqual(mockResult);
      expect(result.contacts).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(invokeSpy).toHaveBeenCalledWith('search', { query: 'john' });
    });

    it('should return empty result when no contacts match', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: SearchResult = { contacts: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (contactSearch as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await contactSearch.search({ query: 'nonexistent' });

      expect(result.contacts).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should return contact with multiple phone numbers and emails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: SearchResult = {
        contacts: [
          {
            id: '3',
            name: 'Jane Doe',
            phoneNumbers: ['+1111111111', '+2222222222'],
            emails: ['jane@work.com', 'jane@home.com'],
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (contactSearch as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await contactSearch.search({ query: 'jane' });

      expect(result.contacts[0].phoneNumbers).toHaveLength(2);
      expect(result.contacts[0].emails).toHaveLength(2);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(contactSearch.isAvailable()).toBe(true);

      contactSearch.destroy();

      expect(contactSearch.isAvailable()).toBe(false);
    });
  });
});
