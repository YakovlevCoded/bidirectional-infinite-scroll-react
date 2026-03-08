---
title: How to Build Bidirectional Infinite Scroll in React
published: true
description: A step-by-step guide to infinite scroll that loads data in both directions without content jumping.
tags: react, typescript, performance, tutorial
cover_image:
---

Most infinite scroll tutorials cover one direction: down. Detect the bottom, load more, done. But real-world apps often need to scroll **both ways** — chat history, log viewers, timelines. And scrolling up introduces a problem that scrolling down never has.

In this guide, I'll walk you through building a bidirectional infinite scroll from scratch. I'm using React and `@tanstack/react-virtual`, but the core technique is framework-agnostic — it's just math on scroll offsets. You can apply it in Vue, Svelte, or vanilla JS.

**[Live Demo](https://log-viewer-infinite-scroll-demo.netlify.app)**

## The Problem, Visually

Imagine a list of 1000 items. The user is looking at item #50. You prepend 200 items above.

**What you expect:** the user still sees item #50.
**What actually happens:** the scroll position stays at the same pixel offset. But item #50 is now at a different pixel offset (it shifted down by the height of 200 new items). The user now sees item #250. The content jumped.

```
BEFORE PREPEND          AFTER PREPEND (broken)

┌─────────────┐         ┌─────────────┐
│ item 48     │         │ item 248 ←── wait, what?
│ item 49     │         │ item 249    │
│ item 50  ◄──│── user  │ item 250    │
│ item 51     │  sees   │ item 251    │
│ item 52     │  this   │ item 252    │
└─────────────┘         └─────────────┘
scrollTop: 2200px       scrollTop: 2200px (same!)
                        but item 50 is now at 11000px
```

This is the core challenge. Everything else — virtualization, data loading — is standard. Fixing this jump is the hard part.

## The Stack

Nothing exotic:

- **React + TypeScript + Vite** — project scaffold
- **@tanstack/react-virtual** — renders only visible items (critical for 1000+ rows)
- **Tailwind CSS** — styling

I also added `react-chartjs-2` for a bar chart synced to the scroll position, but that's a bonus. The scroll logic stands on its own.

## Step 1: The Data Hook

We need a data source that can load data in both directions. In a real app this would be an API. For the demo, I generate mock log events:

```ts
export function useLogData() {
  const [days, setDays] = useState<DayData[]>(() => generateDays(startDate, 30));
  const prependCountRef = useRef(0);

  const loadEarlier = useCallback(() => {
    setDays(prev => {
      const newDays = generateDays(earlierDate, 15);
      // Remember how many items we're about to prepend
      prependCountRef.current = newDays.reduce(
        (sum, d) => sum + d.events.length, 0
      );
      return [...newDays, ...prev];
    });
  }, []);

  const loadLater = useCallback(() => {
    setDays(prev => [...prev, ...generateDays(laterDate, 15)]);
  }, []);

  return { days, allEvents, loadEarlier, loadLater, prependCountRef };
}
```

`prependCountRef` is the key. It stores how many items were just prepended. We'll need this number in a moment.

## Step 2: The Virtualized List

With `@tanstack/react-virtual`, we render only ~20 visible items out of thousands:

```tsx
const virtualizer = useVirtualizer({
  count: events.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 44,  // estimated row height in px
  overscan: 10,            // extra items rendered above/below
});
```

The scroll container holds a tall empty div (total height of all items), and inside it, only visible items are absolutely positioned with `transform: translateY()`. Standard virtualization.

## Step 3: Triggering Loads in Both Directions

On every scroll, we check if the user is near the edges:

```tsx
const handleScroll = useCallback(() => {
  const items = virtualizer.getVirtualItems();
  if (items.length === 0) return;

  const firstVisible = items[0];
  const lastVisible = items[items.length - 1];

  // Near the top? Load earlier data
  if (firstVisible.index <= 5) {
    loadEarlier();
  }
  // Near the bottom? Load later data
  if (lastVisible.index >= events.length - 5) {
    loadLater();
  }
}, [virtualizer]);
```

`loadLater` (appending) just works. The virtualizer sees more items, extends the container height, and the user keeps scrolling. No problems.

`loadEarlier` (prepending) breaks everything. This is where the jump happens.

## Step 4: Fixing the Jump — Scroll Anchoring

The fix is conceptually simple: after prepending, shift the scroll position down by exactly the height of the added items.

```tsx
useEffect(() => {
  const prepended = prependCountRef.current;
  if (prepended > 0 && events.length > prevCountRef.current) {
    const currentOffset = virtualizer.scrollOffset ?? 0;
    const addedHeight = prepended * 44; // items × estimateSize
    virtualizer.scrollToOffset(currentOffset + addedHeight, { align: 'start' });
    prependCountRef.current = 0;
  }
  prevCountRef.current = events.length;
}, [events.length]);
```

```
BEFORE PREPEND          AFTER PREPEND (fixed)

┌─────────────┐         ┌─────────────┐
│ item 48     │         │ item 48     │ ← same!
│ item 49     │         │ item 49     │
│ item 50  ◄──│── user  │ item 50  ◄──│── still here
│ item 51     │  sees   │ item 51     │
│ item 52     │  this   │ item 52     │
└─────────────┘         └─────────────┘
scrollTop: 2200px       scrollTop: 11000px (adjusted!)
```

The user sees no change. The 200 new items are above the viewport, silently loaded.

**Why a ref, not state?** Because `prependCountRef` needs to be set inside `setDays` (during the state update) and read in the `useEffect` (after the update). A ref bridges these two moments without triggering an extra render.

## Step 5: Dynamic Row Heights

There's a catch. If rows can expand (like clicking a log entry to see details), the virtualizer needs to know the actual height, not just the estimate.

```tsx
export const LogItem = memo(function LogItem({ event, virtualIndex, measureRef, start }) {
  const [expanded, setExpanded] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    measureRef(node); // tell virtualizer to measure this node
  }, [measureRef]);

  // Re-measure BEFORE paint when expand/collapse changes
  useLayoutEffect(() => {
    if (nodeRef.current) measureRef(nodeRef.current);
  }, [expanded]);

  return (
    <div ref={setRef} data-index={virtualIndex}
         style={{ transform: `translateY(${start}px)` }}>
      {/* row content */}
      {expanded && <pre>{JSON.stringify(event.details, null, 2)}</pre>}
    </div>
  );
});
```

Two details matter here:

1. **`data-index`** — `@tanstack/react-virtual` uses this attribute to identify which virtual item the DOM node belongs to. Without it, `measureElement` doesn't know which row it's measuring.

2. **`useLayoutEffect`, not `useEffect`** — `useEffect` runs *after* the browser paints. The user would see one frame where the expanded content overlaps the next row, then a correction. `useLayoutEffect` runs *before* paint, so the measurement and position update happen invisibly.

## The Result

Scroll down — new days load. Scroll up — older days load, no jump. Click a chart bar — the list scrolls to that day. Expand a log entry — rows below shift correctly.

All with ~2000 items initially, growing infinitely in both directions. The virtualizer keeps DOM nodes at ~20-30 regardless of total count.

**[Try the demo](https://log-viewer-infinite-scroll-demo.netlify.app)**

## TL;DR

The entire bidirectional scroll technique boils down to three lines:

```tsx
const addedHeight = prependedCount * estimatedRowHeight;
virtualizer.scrollToOffset(currentOffset + addedHeight, { align: 'start' });
```

Track how many items you prepend. After prepending, add their height to the scroll offset. That's it. The rest is standard virtualization.

The hard part was figuring out *that* this is needed. Now you don't have to.
