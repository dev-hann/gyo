# Documentation Conventions

## Language

English only. No exceptions.

## Document Types

| Type | Purpose | Naming |
|------|---------|--------|
| Spec | Types, signatures, rules, structure | `UPPERCASE.md` (e.g. `CLI.md`, `PLUGINS.md`) |
| Index | Links and one-line descriptions only | `README.md` |
| Changelog | Version history in structured format | `CHANGELOG.md` |
| Template | User-facing docs embedded in project templates | Any (may contain placeholders) |

## Writing Rules

1. **Spec-like, not tutorial.** Define WHAT (contracts, interfaces, rules), not HOW.
2. **Code is source of truth.** Reference source files for implementation details. Do not inline them.
3. **Single responsibility.** One document = one concern.
4. **No duplication.** If content exists in another document, write `> See [title](path)` instead.
5. **No examples in specs.** Usage examples belong in `examples/` directories, not in spec documents.
6. **No prose explanations.** Use tables, lists, code blocks, and diagrams. Minimize paragraphs.

## Cross-Referencing

Use the `> See` format to reference other documents:

```markdown
> See [Command Architecture](./CLI.md#command-architecture) for class hierarchy.
```

Never copy content from another document into the current one.

## Layer Indexes

Each directory that contains documentation must have a `README.md` that serves as an index:

```markdown
# Directory Name

## Documents

| Document | Description |
|----------|-------------|
| [FILENAME.md](./FILENAME.md) | One-line description |
```

Indexes contain links and descriptions only. No specs, no tutorials, no examples.

## When to Create a New Document

1. A new concern emerges that does not fit any existing document.
2. A document exceeds its defined scope and needs to be split.
3. A new package or module is added.

New documents must follow the naming conventions and be listed in their layer index.

## When Not to Create a New Document

- The content fits an existing document's scope.
- The content is about implementation details (belongs in code comments or source).
- The content is a usage example (belongs in `examples/`).

## Structure Within a Document

1. Title (`#`)
2. One-line purpose statement
3. Sections (`##`) organized by sub-concern
4. Tables for structured data (types, options, commands)
5. Code blocks for type signatures and interfaces only

## Prohibited

- Inline implementation code (reference the source file instead)
- Step-by-step tutorials in spec documents
- Translated content (English only)
- Emoji in headings or table headers
- Phrases like "you can", "it's easy to", "simply"
