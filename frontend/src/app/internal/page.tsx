import { redirect } from "next/navigation";

/**
 * The /internal tree is a compatibility surface. The active authenticated
 * dashboard lives under /dashboard, so a bare /internal visit redirects
 * there instead of rendering a second dashboard.
 */
export default function InternalIndex() {
  redirect("/dashboard");
}
