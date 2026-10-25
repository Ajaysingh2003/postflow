import Link from "next/link";
import type { BillingConfigResponse } from "@/modules/types";
import type { MarketingPath } from "./config";
import {
  breadcrumbItems,
  pageStructuredData,
  serializeJsonLd,
} from "./structured-data";

/** Non-visual SEO and accessible breadcrumb navigation preserve the existing layout. */
export function PageSeo({
  path,
  plans,
}: {
  path: MarketingPath;
  plans?: BillingConfigResponse;
}) {
  const breadcrumbs = breadcrumbItems(path);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(pageStructuredData(path, plans)),
        }}
      />
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="sr-only">
          <ol>
            {breadcrumbs.map((item, index) => (
              <li key={item.path}>
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page">{item.name}</span>
                ) : (
                  <Link href={item.path}>{item.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}
