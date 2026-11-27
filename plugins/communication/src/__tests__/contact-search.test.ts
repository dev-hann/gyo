import { ContactSearch } from '../index';
import type { SearchResult } from '../index';
import { clearNativeSide, communicationRequest, handled, posted } from './helpers/native';

describe('ContactSearch', () => {
  let contactSearch: ContactSearch;
  let postMessage: jest.Mock;

  beforeEach(() => {
    clearNativeSide();
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    contactSearch = new ContactSearch();
  });

  afterEach(() => {
    contactSearch.destroy();
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      delete window.androidBridge;

      expect(contactSearch.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      expect(contactSearch.isAvailable()).toBe(true);
    });
  });

  describe('search', () => {
    it('should invoke search with the query and return the contacts', async () => {
      const contacts: SearchResult = {
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            phoneNumbers: ['+1234567890'],
            emails: ['john@example.com'],
          },
          { id: '2', name: 'John Smith', phoneNumbers: ['+0987654321'], emails: [] },
        ],
        count: 2,
      };

      const pending = handled(contactSearch.search({ query: 'john' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, contacts);

      const result = await pending;
      expect(sent).toEqual(communicationRequest('search', { query: 'john' }));
      expect(result).toEqual(contacts);
      expect(result.contacts).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should return an empty result when no contacts match', async () => {
      const pending = handled(contactSearch.search({ query: 'nonexistent' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, { contacts: [], count: 0 });

      const result = await pending;
      expect(sent).toEqual(communicationRequest('search', { query: 'nonexistent' }));
      expect(result.contacts).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should return a contact with multiple phone numbers and emails', async () => {
      const pending = handled(contactSearch.search({ query: 'jane' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, {
        contacts: [
          {
            id: '3',
            name: 'Jane Doe',
            phoneNumbers: ['+1111111111', '+2222222222'],
            emails: ['jane@work.com', 'jane@home.com'],
          },
        ],
        count: 1,
      });

      const result = await pending;
      expect(sent).toEqual(communicationRequest('search', { query: 'jane' }));
      expect(result.contacts[0].phoneNumbers).toHaveLength(2);
      expect(result.contacts[0].emails).toHaveLength(2);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      expect(contactSearch.isAvailable()).toBe(true);

      contactSearch.destroy();

      expect(contactSearch.isAvailable()).toBe(false);
    });
  });
});
