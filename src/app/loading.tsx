import { TripsSkeleton } from "@/components/page-skeletons";

/** Shown while a page loads; the routes with another layout have their own `loading.tsx`. */
export default function Loading() {
  return <TripsSkeleton />;
}
