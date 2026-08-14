# Verification Engine Technical Manual

## Core Responsibilities
The **Verification Engine** checks whether search engine crawlers have indexed customer URLs and backlinks.

## Verification States
- **Unknown**: Initial unverified state.
- **Pending**: Job scheduled and awaiting crawler execution.
- **Discovered**: Found in sitemap or feed.
- **Crawled**: Rendered by crawler bot.
- **Indexed**: Successfully stored in search index.
- **Not Indexed**: Failed indexation or blocked by directive.
- **Removed**: Expressly requested removal or deleted.
- **Blocked**: Prevented by robots.txt or meta noindex.
- **Expired**: Cache or page expired.

## Backlink State Tracking
- Backlink Present / Missing
- Anchor Changed / Target Changed
- Follow / Nofollow / Sponsored / UGC
- Redirected / Broken
