# @gyo-framework/contact-search

Gyo plugin for searching contacts via Android ContactsProvider.

## Installation

```bash
npm install @gyo-framework/contact-search
```

## Usage

```typescript
import { ContactSearch } from '@gyo-framework/contact-search';

const contactSearch = new ContactSearch();

// Search contacts
const { contacts, count } = await contactSearch.search({ query: 'john' });

// Check availability
if (contactSearch.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
contactSearch.destroy();
```

## API

### `ContactSearch`

| Method | Returns | Description |
|--------|---------|-------------|
| `search(params)` | `Promise<SearchResult>` | Search contacts by name |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface ContactInfo {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

interface SearchParams {
  query: string;
}

interface SearchResult {
  contacts: ContactInfo[];
  count: number;
}
```

## Android Setup

1. Add `READ_CONTACTS` permission to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
```

2. Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.contact_search.ContactSearchBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("contact_search", ContactSearchBridge(this))
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
