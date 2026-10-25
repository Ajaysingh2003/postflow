import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirect } from "@/lib/seo/redirects";
import { isPrivatePath } from "@/lib/seo/config";

export function proxy(request: NextRequest) {
  const destination = canonicalRedirect(
    request.url,
    request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );
  const response = destination
    ? NextResponse.redirect(destination, 308)
    : NextResponse.next();
  if (isPrivatePath(request.nextUrl.pathname))
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico).*)"],
};
