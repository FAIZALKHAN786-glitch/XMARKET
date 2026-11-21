"use strict";

export function CompareTable({
  ranked,
  requirement,
}: {
  ranked: any[];
  requirement: any;
}) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="pb-2 text-left font-bold text-black">Provider</th>
            <th className="pb-2 text-right font-bold text-black">Price</th>
            <th className="pb-2 text-right font-bold text-black">Days</th>
            <th className="pb-2 text-right font-bold text-black">Score</th>
            <th className="pb-2 text-left font-bold text-black">Fit</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => (
            <tr key={row.bid.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3">{row.provider?.name || row.bid.providerId}</td>
              <td className="py-3 text-right font-bold">${row.bid.price.toLocaleString()}</td>
              <td className="py-3 text-right">{row.bid.deliveryDays}</td>
              <td className="py-3 text-right font-bold">{row.score.total}</td>
              <td className="py-3 text-sm text-gray-600">{row.score.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
