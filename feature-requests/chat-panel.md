# Feature Request: AI Chat Panel

## Status
Not started. Deferred — to be implemented in a dedicated branch after the inline completions feature is shipped.

## Summary
Add a chat panel alongside the Monaco editor that allows editors to have a conversational AI interaction with the code currently open. The chat is backed by the same SkyCMS server-side Copilot proxy already used for inline completions.

---

## Motivation
The current inline completions feature (ghost-text, Tab to accept) covers single-token and short multi-line suggestions. It does not support:
- Asking open-ended questions about the code ("what does this do?")
- Requesting multi-step refactors ("convert this table to a CSS grid layout")
- Explaining errors or suggesting fixes with reasoning
- Making targeted edits to a selected region with natural language

A chat panel fills this gap while reusing the existing backend proxy infrastructure.

---

## User Experience

- Chat panel renders alongside the editor (side panel or slide-in drawer).
- User selects code (optional), types a message, presses Enter or clicks Send.
- Response streams in token-by-token (no waiting for the full reply).
- Code blocks in responses have an **Insert** button and a **Replace selection** button.
- Full undo support — all editor edits go through Monaco's `executeEdits()` and are reversible with Ctrl+Z.

---

## How it would work (technical notes)

### Reading editor context

All context is read from the live editor instance at send time:

```typescript
const userMessage = chatInput.value;
const model = editor.getModel();
const selection = editor.getSelection();
const selectedText = model.getValueInRange(selection);  // empty string if no selection
const fullSource = editor.getValue();
const language = model.getLanguageId();
const cursorLine = editor.getPosition().lineNumber;
```

This is synchronous — no copy, same in-memory model as inline completions.

### Request format (to new server endpoint)

```
POST /api/copilot/chat
{
  "messages": [
    {
      "role": "system",
      "content": "You are a code assistant. Language: html.\n\nFile:\n<file>\n{fullSource}\n</file>\n\nSelected text:\n<selection>\n{selectedText}\n</selection>"
    },
    { "role": "user",   "content": "previous user message" },
    { "role": "assistant", "content": "previous assistant reply" },
    { "role": "user",   "content": "current user message" }
  ]
}
```

Message history is maintained **client-side** only — no database, no server state. The server is stateless; history is replayed in full on every request (standard OpenAI chat pattern).

### Server side

A new `POST /api/copilot/chat` action on `CopilotController`. Reuses:
- `ICopilotProxyOptionsService` (same options, same token)
- `IHttpClientFactory` (same `HttpClient`)
- Rate limiter (`copilot-inline` policy, or a new `copilot-chat` policy with lower limits)

The key difference from inline completions: the server forwards an SSE (Server-Sent Events) stream back to the client rather than buffering a full response.

### Applying code back to the editor

Code blocks in the response are detected by the chat renderer. Each has two buttons:

- **Insert at cursor** — `editor.executeEdits('chat-insert', [{ range: cursorRange, text: codeBlock }])`
- **Replace selection** — `editor.executeEdits('chat-replace', [{ range: lastSelection, text: codeBlock }])`

Both routes go through Monaco's edit stack, making them fully undoable.

---

## Architecture relationship to inline completions

```
Monaco editor instance
    │
    ├── InlineCompletionsProvider  ← already built
    │       reads: prefix/suffix at cursor
    │       writes: ghost text (Monaco internal)
    │
    └── ChatPanel (new)
            reads: selection, full buffer, language, cursor position
            writes: via editor.executeEdits() on user-initiated "Apply"
            talks to: POST /api/copilot/chat (new endpoint)
```

The chat panel and inline provider are **parallel, independent consumers** of the same editor model. Neither depends on the other.

---

## Work breakdown (estimated)

| Area | Notes | Effort |
|---|---|---|
| `POST /api/copilot/chat` controller action | SSE streaming proxy, reuse existing options/HttpClient | Small |
| `chat.ts` client module | Context capture, message history, fetch with streaming | Medium |
| Chat panel UI | HTML/CSS panel, message list, input, Send button | Medium |
| SSE / streaming response rendering | Token-by-token text append | Medium |
| Markdown + code block rendering | `marked` + code highlight, Insert/Replace buttons | Medium |
| `editor.executeEdits()` apply logic | Insert at cursor, replace selection, undo support | Small |
| Tests | Unit tests for context capture and message history | Small |
| **Total** | | ~2–4 days |

---

## Dependencies / prerequisites

- Inline completions feature merged and stable (current branch).
- `CopilotProxyOptions` and `ICopilotProxyOptionsService` already in place — no changes needed.
- A markdown renderer library to be selected (e.g. `marked`, `markdown-it`).
- Decision on whether to reuse `copilot-inline` rate limiter policy or add a separate `copilot-chat` policy with different limits (chat requests are heavier and less frequent than completions).

---

## Open questions

1. **Panel layout** — side panel (resizable split) or slide-in drawer over the editor?
2. **Context size limit** — full file as context, or truncate at N characters? Large files may exceed model context windows.
3. **Rate limiter policy** — share `copilot-inline` or add `copilot-chat` with separate (lower) per-minute limits?
4. **History persistence** — keep message history for the duration of the page session only, or persist to `localStorage` between page loads?
5. **Multi-turn context** — cap history replay at N turns to avoid exceeding model token limits?
