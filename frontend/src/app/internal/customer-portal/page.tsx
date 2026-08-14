import CustomerPortalClient from "./CustomerPortalClient";

export const metadata = {
  title: "Enterprise Customer Portal & Self-Service Billing | FreeIndexer",
  description: "Manage subscription plans, payment methods, tax profiles, and team members.",
};

export default function CustomerPortalPage() {
  return <CustomerPortalClient />;
}
