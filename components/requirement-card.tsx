"use strict";

import Link from "next/link";
import { Badge } from "./ui";

export function RequirementCard({
  requirement,
  offerCount = 0,
  onClick,
}: {
  requirement: any;
  offerCount?: number;
  onClick?: () => void;
}) {
  const daysLeft = Math.round(
    (new Date(requirement.closesAt).getTime() - Date.now()) / 86_400_000
  );
  return (
    <Link href={`/requirements/${requirement.id}`} className="block">
      <div className="border border-black rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-black">{requirement.title}</h3>
          <Badge tone="neutral">{requirement.category}</Badge>
        </div>
        <p className="text-sm text-gray-600 mb-3">{requirement.summary}</p>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>${requirement.budgetMax.toLocaleString()} ceiling</span>
          <span>${requirement.location}</span>
          <span>{daysLeft} days left</span>
          <span>{offerCount} offers</span>
        </div>
      </div>
    </Link>
  );
}
