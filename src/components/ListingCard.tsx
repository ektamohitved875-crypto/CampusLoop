import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { formatINR } from '../lib/firestoreService';
import type { Listing } from '../types/campusloop';

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const [imgError, setImgError] = useState(false);

  const typeLabel =
    listing.listingType === 'sell'
      ? 'Buy'
      : listing.listingType === 'rent'
        ? 'Rent'
        : 'Exchange';

  const priceDisplay =
    listing.listingType === 'rent' && listing.rentalPrice
      ? `${formatINR(listing.rentalPrice)} ${listing.rentalDuration || '/ week'}`
      : listing.listingType === 'exchange' && listing.price === 0
        ? 'Swap / Exchange'
        : formatINR(listing.price);

  const availabilityText =
    listing.availability === 'available'
      ? 'Available'
      : listing.availability.charAt(0).toUpperCase() + listing.availability.slice(1);

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300">
      <Link to={`/listing/${listing.listingId}`} className="block relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {listing.images?.[0] && !imgError ? (
          <img
            src={listing.images[0]}
            alt={listing.productName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center">
            <Package className="w-8 h-8 mb-2" />
            <span className="text-xs font-medium text-slate-500 line-clamp-2">{listing.productName}</span>
          </div>
        )}
        {listing.isDemo && (
          <span className="absolute top-3 left-3 bg-slate-900/90 text-white text-[11px] font-mono font-medium px-2 py-0.5 rounded">
            DEMO DATA
          </span>
        )}
      </Link>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5 truncate">
            <span className="font-medium text-teal-700">{typeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{listing.category}</span>
            <span aria-hidden="true">·</span>
            <span>{listing.condition}</span>
          </div>

          <Link to={`/listing/${listing.listingId}`}>
            <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-teal-700 transition-colors">
              {listing.productName}
            </h3>
          </Link>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-slate-900 tabular-nums">{priceDisplay}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {listing.sellerName} · {listing.campus}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{availabilityText}</p>
          </div>

          <Link
            to={`/listing/${listing.listingId}`}
            className="px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
          >
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}
