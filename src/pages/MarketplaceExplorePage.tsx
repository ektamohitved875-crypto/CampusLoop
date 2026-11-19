import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../lib/authContext';
import { subscribeApprovedListings, subscribeCategories } from '../lib/firestoreService';
import {
  DEHRADUN_CAMPUSES,
  type Category,
  type Listing,
  type ListingAvailability,
  type ListingCondition,
  type ListingType,
} from '../types/campusloop';

interface MarketplaceExplorePageProps {
  mode?: 'landing' | 'explore';
}

export function MarketplaceExplorePage({ mode = 'explore' }: MarketplaceExplorePageProps) {
  const { firebaseUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [selectedType, setSelectedType] = useState<'all' | ListingType>(
    (searchParams.get('type') as 'all' | ListingType) || 'all',
  );
  const [selectedCampus, setSelectedCampus] = useState(searchParams.get('campus') || 'all');
  const [selectedCondition, setSelectedCondition] = useState<'all' | ListingCondition>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<'all' | ListingAvailability>('available');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(mode === 'explore');

  useEffect(() => {
    const unsubListings = subscribeApprovedListings((items) => {
      setListings(items);
      setLoading(false);
    });
    const unsubCats = subscribeCategories(false, setCategories);
    return () => {
      unsubListings();
      unsubCats();
    };
  }, []);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const min = minPrice !== '' ? Number(minPrice) : null;
    const max = maxPrice !== '' ? Number(maxPrice) : null;

    return listings.filter((item) => {
      if (q) {
        const hay = `${item.productName} ${item.description} ${item.category} ${item.campus} ${item.sellerName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedType !== 'all' && item.listingType !== selectedType) return false;
      if (selectedCampus !== 'all' && item.campus !== selectedCampus) return false;
      if (selectedCondition !== 'all' && item.condition !== selectedCondition) return false;
      if (selectedAvailability !== 'all' && item.availability !== selectedAvailability) return false;

      const effectivePrice =
        item.listingType === 'rent' && item.rentalPrice ? item.rentalPrice : item.price;
      if (min !== null && Number.isFinite(min) && effectivePrice < min) return false;
      if (max !== null && Number.isFinite(max) && effectivePrice > max) return false;

      return true;
    });
  }, [
    listings,
    searchQuery,
    selectedCategory,
    selectedType,
    selectedCampus,
    selectedCondition,
    selectedAvailability,
    minPrice,
    maxPrice,
  ]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedCampus('all');
    setSelectedCondition('all');
    setSelectedAvailability('available');
    setMinPrice('');
    setMaxPrice('');
    setSearchParams({});
  };

  return (
    <CustomerLayout>
      {mode === 'landing' && (
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold text-teal-700 tracking-wide">
                DGU / Doon Business School &amp; Dehradun Campuses
              </p>
              <h1 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-tight text-slate-900 leading-[1.12] text-balance">
                Buy, sell, rent, and exchange right on campus.
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                CampusLoop helps students save money on textbooks, interview formalwear, hostel appliances, electronics, and cycles—while seniors recover value before graduation.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={firebaseUser ? '/customer/sell' : '/login'}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Sell or Rent an Item
                </Link>
                <Link
                  to="/explore"
                  className="px-5 py-3 bg-slate-100 text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Explore Approved Listings
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-64 sm:h-80 lg:h-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src="/src/assets/images/hero_campus_marketplace_1795073411587.jpg"
                  alt="Student desk with textbooks, laptop, and campus essentials"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              {mode === 'landing' ? 'Approved Campus Marketplace' : 'Explore Marketplace'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Every listing is reviewed by CampusLoop moderators before going live.
            </p>
          </div>
          <Link
            to={firebaseUser ? '/customer/sell' : '/login'}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Sell or Rent an Item
          </Link>
        </div>

        {/* Search & Segmented Type Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search books, electronics, formalwear, hostel essentials..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'sell', 'rent', 'exchange'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      selectedType === type
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === 'all'
                      ? 'All Types'
                      : type === 'sell'
                        ? 'Buy'
                        : type === 'rent'
                          ? 'Rent'
                          : 'Exchange'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowFilters((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showFilters ? 'Hide Filters' : 'Filters'}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.categoryId} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  College / Campus
                </label>
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Campuses</option>
                  {DEHRADUN_CAMPUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Condition</label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value as 'all' | ListingCondition)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="all">Any Condition</option>
                  <option value="New">New</option>
                  <option value="Like New">Like New</option>
                  <option value="Good">Good</option>
                  <option value="Used">Used</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Availability
                </label>
                <select
                  value={selectedAvailability}
                  onChange={(e) =>
                    setSelectedAvailability(e.target.value as 'all' | ListingAvailability)
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available Now</option>
                  <option value="reserved">Reserved</option>
                  <option value="rented">Rented</option>
                  <option value="sold">Sold</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Min Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Max Price (₹)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Any"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              No matching approved listings yet
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              {listings.length === 0
                ? 'Be the first student to list textbooks, formalwear, or hostel essentials—or sign in as an administrator to load sample demo listings.'
                : 'Try clearing your search or broadening your category, campus, or price filters.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {listings.length > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
              <Link
                to={firebaseUser ? '/customer/sell' : '/login'}
                className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800"
              >
                Sell or Rent an Item
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <ListingCard key={listing.listingId} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </CustomerLayout>
  );
}
