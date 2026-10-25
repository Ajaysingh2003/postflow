# Before / after SEO summary

Counts cover the 15 intended canonical marketing URLs, not private screens or the four retired legal aliases. The initial five product-route failures made their headings unobservable in the baseline HTTP crawl. Source inspection separately confirmed they inherited the shared root metadata.

| Check | Before | After |
|---|---:|---:|
| HTTP 200 marketing pages | 10 | 15 |
| Canonical URLs | 0 | 15 |
| Exactly one rendered H1 | 9 | 15 |
| Pages with JSON-LD | 0 | 15 |
| Skipped heading levels | 6 | 0 |
| Duplicate legal URLs returning 200 | 4 | 0; direct 308 redirects |
| Sitemap / robots routes | absent | both return 200; 15 sitemap entries |
| Public product routes accepting arbitrary slugs | yes | no; invalid URLs return 404 |
| Internal links / image paths | broken destinations and fragments | rendered verification passes |
| Social metadata | missing | all 15 canonical pages have OG and Twitter cards |

See [baseline routes](audit-before.md), [final routes](audit-after.md), [verification results](verification.json) and [image checklist](images.md).

Auth/app screens deliberately remain noindex, with no marketing canonical. The raw audit still flags their duplicate titles, missing H1s and missing canonicals for completeness; those private-screen observations are not unresolved marketing SEO defects. No authentication forms or account-management flows were redesigned.
