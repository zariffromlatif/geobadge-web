import React from "react";
import { Trash2 } from "lucide-react";

export interface Site {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface SiteListProps {
  sites: Site[];
  onSelect: (site: Site) => void;
  onDelete: (site: Site) => void;
  activeSiteId?: string;
}

export const SiteList: React.FC<SiteListProps> = ({
  sites,
  onSelect,
  onDelete,
  activeSiteId,
}) => {
  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800">Site Management</h3>
        <p className="text-sm text-gray-500">
          Select a site to update the entrance QR code.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">Site Name</th>
              <th className="px-6 py-3 font-medium">Coordinates</th>
              <th className="px-6 py-3 font-medium">Radius</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sites.map((site) => (
              <tr
                key={site.id}
                className={`hover:bg-blue-50 transition-colors ${activeSiteId === site.id ? "bg-blue-50" : ""}`}
              >
                <td className="px-6 py-4 font-medium text-gray-900">
                  {site.name}
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm font-mono">
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {site.radius_meters}m
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(site)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeSiteId === site.id
                          ? "bg-green-600 text-white"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {activeSiteId === site.id ? "Currently Active" : "Show QR"}
                    </button>
                    <button
                      type="button"
                      title="Delete site"
                      aria-label={`Delete site ${site.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(site);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
