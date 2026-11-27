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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

### Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
```
`gyo install` points it out when the line is missing. The system asks the user for the permission at run time; `search` returns an empty result until it is granted.
## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
