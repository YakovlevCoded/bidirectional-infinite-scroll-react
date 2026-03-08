# Bidirectional Infinite Scroll — React Demo

A log viewer with virtualized bidirectional infinite scroll, scroll anchoring, and chart synchronization.

**[Live Demo](https://log-viewer-infinite-scroll-demo.netlify.app)** | **[Blog Post](https://dev.to/leonid_frontend/how-to-build-bidirectional-infinite-scroll-in-react-5290)**

## What's Inside

- Infinite scroll in both directions (up and down)
- Scroll anchoring — no content jump when data is prepended above the viewport
- Virtualized list with `@tanstack/react-virtual` (~20 DOM nodes for any number of items)
- Dynamic row heights — expandable log entries with `useLayoutEffect` measurement
- Bar chart synced to scroll position (click a bar to jump to that day)

## Stack

- React + TypeScript + Vite
- @tanstack/react-virtual
- react-chartjs-2 + Chart.js
- Tailwind CSS

## Run Locally

```bash
npm install
npm run dev
```

## The Core Idea

When you prepend items to a virtualized list, the scroll position stays at the same pixel offset but the content shifts down. The fix is one line:

```ts
virtualizer.scrollToOffset(currentOffset + prependedItems * rowHeight);
```

See the [blog post](https://dev.to/leonid_frontend/how-to-build-bidirectional-infinite-scroll-in-react-5290) for the full walkthrough.
