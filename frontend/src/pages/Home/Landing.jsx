import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car, ShieldCheck, Leaf, MapPinned, Users, PackageSearch, Search, ArrowRight,
  Sparkles, CheckCircle2, ChevronRight, Fuel, TreePine, Zap, Navigation, Award,
  Clock, HeartHandshake, PhoneCall, ExternalLink, Calendar, MapPin
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const POPULAR_ROUTES = [
  { origin: 'Kovilpatti Bus Stand', destination: 'National Engineering College', time: '15 mins', tag: 'High Frequency' },
  { origin: 'Sattur Railway Station', destination: 'NEC Main Gate', time: '25 mins', tag: 'Student Commute' },
  { origin: 'Madurai Bypass Road', destination: 'NEC Tech Campus', time: '40 mins', tag: 'Express Carpool' },
  { origin: 'Tirunelveli New Bus Stand', destination: 'College Campus', time: '45 mins', tag: 'Daily Route' }
];

const FEATURES = [
  {
    icon: MapPinned,
    title: 'Smart Route Matching',
    desc: 'Intelligent multi-point waypoint detection finds exact routes and convenient alternatives along your path.',
    badge: 'Real-Time',
    gradient: 'from-blue-500 to-indigo-600'
  },
  {
    icon: ShieldCheck,
    title: 'Women-Only Verified Rides',
    desc: 'Dedicated female-driver and passenger verified carpools with optional gender-restricted booking policies.',
    badge: 'Safety First',
    gradient: 'from-purple-500 to-pink-600'
  },
  {
    icon: Users,
    title: 'Automated Waiting Lists',
    desc: 'Never miss a ride. Join the smart waitlist and get auto-promoted the instant a seat becomes available.',
    badge: 'Zero Effort',
    gradient: 'from-amber-500 to-orange-600'
  },
  {
    icon: Leaf,
    title: 'Eco & Carbon Analytics',
    desc: 'Track exact distance shared, fuel conserved, and carbon offsets with personalized eco credentials.',
    badge: 'Green Campus',
    gradient: 'from-emerald-500 to-teal-600'
  },
  {
    icon: Car,
    title: 'Live GPS Turn-by-Turn',
    desc: 'High-precision live vehicle location tracking with geofenced arrival notifications and safety checkpoints.',
    badge: 'Live Map',
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    icon: PackageSearch,
    title: 'Ride-Scoped Lost & Found',
    desc: 'Forgot an item? Privately alert only the participants of that specific ride without public broadcasting.',
    badge: 'Private',
    gradient: 'from-rose-500 to-purple-600'
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  
  // Search widget state
  const [searchOrigin, setSearchOrigin] = useState('Kovilpatti Bus Stand');
  const [searchDest, setSearchDest] = useState('National Engineering College');
  const [searchDate, setSearchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isWomenOnly, setIsWomenOnly] = useState(false);

  // Role preview tab state
  const [activeTab, setActiveTab] = useState('passenger');

  // Eco calculator interactive slider state
  const [dailyKm, setDailyKm] = useState(25);

  // Quick login loading state
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (isAuthenticated) {
      navigate('/passenger/find-ride');
    } else {
      navigate('/login', { state: { searchPref: { origin: searchOrigin, destination: searchDest, date: searchDate, womenOnly: isWomenOnly } } });
    }
  };

  const handleApplyPreset = (route) => {
    setSearchOrigin(route.origin);
    setSearchDest(route.destination);
  };

  const handleQuickDemo = async (email) => {
    setDemoLoading(true);
    try {
      const loggedUser = await login({ email, password: 'Carpool@123' });
      const dest = loggedUser.role === 'admin' ? '/admin' : loggedUser.role === 'driver' ? '/driver' : '/passenger';
      navigate(dest);
    } catch (_) {
      navigate('/login');
    } finally {
      setDemoLoading(false);
    }
  };

  // Eco calculations based on 22 campus days/month
  const monthlyKm = dailyKm * 22;
  const moneySaved = Math.round(monthlyKm * 4.2); // ~₹4.2 per km saved vs solo commute
  const co2AvoidedKg = Math.round(monthlyKm * 0.16); // ~160g CO2 per km
  const treesEquivalent = (co2AvoidedKg / 21).toFixed(1); // 1 tree ~21kg CO2/yr

  return (
    <div className="relative overflow-hidden">
      {/* Dynamic Background Glow Orbs */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-brand-600/20 via-accent-cyan/15 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[600px] right-0 w-[450px] h-[450px] bg-gradient-to-br from-indigo-500/10 to-brand-500/10 blur-[100px] pointer-events-none -z-10" />

      {/* -------------------- 1. HERO SECTION -------------------- */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-20 sm:pt-16 sm:pb-24 text-center">
        {/* Animated Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 shadow-sm backdrop-blur-md mb-6"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent-cyan animate-pulse" />
          <span>Smart, Safe & Sustainable Campus Commutes</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-4xl text-4xl sm:text-6xl font-extrabold tracking-tight font-heading leading-[1.12]"
        >
          Ride together.{' '}
          <span className="bg-gradient-to-r from-brand-600 via-indigo-500 to-accent-cyan bg-clip-text text-transparent">
            Cut costs, emissions,
          </span>{' '}
          and commute stress.
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed"
        >
          CarPool Connect pairs university students, faculty, and daily commuters on identical routes with
          verified identity matching, fair automatic fares, and real-time GPS tracking.
        </motion.p>

        {/* ----------------- INTERACTIVE INSTANT RIDE FINDER CARD ----------------- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-10 max-w-4xl rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80 p-4 sm:p-6 shadow-2xl backdrop-blur-xl relative"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/70 dark:border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Campus Route Matcher
              </span>
            </div>
            <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Instant Seat Discovery
            </span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end text-left">
            {/* Origin */}
            <div className="sm:col-span-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pickup Spot
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-brand-600 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                  placeholder="Where from?"
                  className="input pl-10 text-sm font-medium"
                />
              </div>
            </div>

            {/* Destination */}
            <div className="sm:col-span-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Destination
              </label>
              <div className="relative">
                <Navigation className="absolute left-3.5 top-3 h-4 w-4 text-accent-cyan pointer-events-none" />
                <input
                  type="text"
                  required
                  value={searchDest}
                  onChange={(e) => setSearchDest(e.target.value)}
                  placeholder="Where to?"
                  className="input pl-10 text-sm font-medium"
                />
              </div>
            </div>

            {/* Date */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="input text-xs font-medium px-3"
                />
              </div>
            </div>

            {/* Search Button */}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="btn-primary w-full !py-2.5 !px-3 text-sm flex items-center justify-center gap-1.5 shadow-md"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Quick-fill popular routes pills */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center gap-2 text-left">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Popular:</span>
            {POPULAR_ROUTES.map((route, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleApplyPreset(route)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-800/60 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition"
              >
                <span>{route.origin.split(' ')[0]} → {route.destination.split(' ')[0]}</span>
                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">• {route.time}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ----------------- LIVE TRUST METRICS STRIP ----------------- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mt-14 max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { value: '5,000+', label: 'Verified Campus Commuters', icon: Users, color: 'text-indigo-600' },
            { value: '42,500 kg', label: 'CO₂ Emissions Prevented', icon: Leaf, color: 'text-emerald-500' },
            { value: '100%', label: 'University ID Verification', icon: ShieldCheck, color: 'text-brand-600' },
            { value: '65% Avg', label: 'Commute Cost Savings', icon: Fuel, color: 'text-cyan-500' }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/60 p-4 text-center backdrop-blur-md shadow-sm card-hover"
              >
                <Icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </motion.div>
      </section>

      {/* -------------------- 2. INTERACTIVE ROLE EXPERIENCE TABS -------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="badge bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-2">Designed for Both Sides</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading">
            Tailored for Passengers & Drivers Alike
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Switch between modes to see how CarPool Connect simplifies your daily routine.
          </p>

          {/* Interactive Segmented Switcher */}
          <div className="inline-flex rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 p-1.5 mt-6 shadow-inner">
            <button
              onClick={() => setActiveTab('passenger')}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                activeTab === 'passenger'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-md scale-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>For Passengers</span>
            </button>
            <button
              onClick={() => setActiveTab('driver')}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                activeTab === 'driver'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-md scale-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Car className="h-4 w-4" />
              <span>For Drivers</span>
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <AnimatePresence mode="wait">
          {activeTab === 'passenger' ? (
            <motion.div
              key="passenger"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto"
            >
              {[
                {
                  title: 'Exact & Alternate Matching',
                  desc: 'Search direct routes or find cars passing within walking distance of your pickup point.',
                  icon: Navigation,
                  actionText: 'Find a Ride',
                  link: '/passenger/find-ride'
                },
                {
                  title: 'Women-Only Certified Carpools',
                  desc: 'Filter for rides verified by female drivers and passengers for total peace of mind.',
                  icon: ShieldCheck,
                  actionText: 'View Safe Rides',
                  link: '/passenger/women-only'
                },
                {
                  title: 'Live Tracking & SOS Protection',
                  desc: 'Follow the car in real time on the live Leaflet map with instant campus emergency buttons.',
                  icon: MapPinned,
                  actionText: 'Explore Safety',
                  link: '/safety'
                }
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="card card-hover border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
                    <div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-cyan text-white mb-4 shadow-md">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="text-lg font-bold font-heading mb-2">{card.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{card.desc}</p>
                    </div>
                    <Link to={card.link} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 dark:text-brand-400 hover:gap-2.5 transition-all">
                      <span>{card.actionText}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="driver"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto"
            >
              {[
                {
                  title: 'Automated Fuel Cost Split',
                  desc: 'Our intelligent fair-rate engine calculates per-km fuel share so you offset your costs transparently.',
                  icon: Fuel,
                  actionText: 'Offer a Ride',
                  link: '/driver/offer-ride'
                },
                {
                  title: 'Verified Peer Requests',
                  desc: 'Review passenger profiles, mutual ratings, and campus credentials before accepting bookings.',
                  icon: Users,
                  actionText: 'Driver Dashboard',
                  link: '/driver'
                },
                {
                  title: 'Smart Turn-by-Turn GPS',
                  desc: 'Broadcast your location to booked passengers with automated status transitions from start to arrival.',
                  icon: Car,
                  actionText: 'See GPS Features',
                  link: '/driver/my-rides'
                }
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="card card-hover border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
                    <div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white mb-4 shadow-md">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="text-lg font-bold font-heading mb-2">{card.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{card.desc}</p>
                    </div>
                    <Link to={card.link} className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:gap-2.5 transition-all">
                      <span>{card.actionText}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* -------------------- 3. INTERACTIVE ECO SAVINGS CALCULATOR -------------------- */}
      <section id="eco-calculator" className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-500/5 via-accent-cyan/5 to-transparent p-6 sm:p-12 backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Interactive Controls */}
            <div className="lg:col-span-6">
              <span className="badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                Interactive Green Calculator
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold font-heading mb-3">
                Calculate Your Personal Monthly Impact
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Drag the slider to see how much money and carbon you prevent each month by sharing your campus ride.
              </p>

              {/* Slider Control */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Roundtrip Daily Commute
                  </span>
                  <span className="text-xl font-extrabold font-heading text-brand-600 dark:text-brand-400">
                    {dailyKm} km / day
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={dailyKm}
                  onChange={(e) => setDailyKm(Number(e.target.value))}
                  className="slider w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                  <span>5 km (Local)</span>
                  <span>40 km (Intercity)</span>
                  <span>80 km (Regional)</span>
                </div>
              </div>
            </div>

            {/* Right: Dynamic Computed Results */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 text-center">
                <Leaf className="h-7 w-7 mx-auto mb-2 text-emerald-600" />
                <div className="text-3xl font-extrabold font-heading text-emerald-600 dark:text-emerald-400">
                  {co2AvoidedKg} kg
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Monthly CO₂ Saved
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-5 text-center">
                <Fuel className="h-7 w-7 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-extrabold font-heading text-blue-600 dark:text-blue-400">
                  ₹{moneySaved.toLocaleString()}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Est. Fuel Cost Saved
                </div>
              </div>

              <div className="rounded-2xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20 p-5 text-center">
                <TreePine className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                <div className="text-3xl font-extrabold font-heading text-purple-600 dark:text-purple-400">
                  {treesEquivalent}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Trees Equivalent Offset
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-5 text-center">
                <Car className="h-7 w-7 mx-auto mb-2 text-amber-600" />
                <div className="text-3xl font-extrabold font-heading text-amber-600 dark:text-amber-400">
                  {monthlyKm} km
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Monthly Shared Kilometres
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 4. ALL FEATURES GRID -------------------- */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="badge bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-2">Core Technology</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading">
            Built for Modern Universities & Communities
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">
            Everything you need for safe, transparent, and seamless shared travel every single day.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="card card-hover relative group overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${feat.gradient} text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                    {feat.badge}
                  </span>
                </div>
                <h3 className="font-bold font-heading text-lg mb-1.5 text-slate-900 dark:text-white">
                  {feat.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* -------------------- 5. 1-CLICK INSTANT DEMO LAUNCHER -------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-b from-brand-500/10 via-slate-50/50 to-transparent dark:from-brand-500/15 dark:via-slate-900/50 dark:to-transparent p-6 sm:p-10 text-center backdrop-blur-xl">
          <span className="badge bg-brand-500 text-white shadow-sm mb-3">⚡ Live Demo Hub</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-heading mb-3">
            Test Drive CarPool Connect Right Now
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mb-8">
            Click any seeded role below to sign in instantly with full privileges — no registration required!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                role: 'Passenger Account',
                name: 'Meera (Passenger)',
                desc: 'Has an accepted booking & can track live ride',
                email: 'meera.passenger@carpoolconnect.app',
                icon: '🎒',
                btnColor: 'from-sky-500 to-blue-600'
              },
              {
                role: 'Verified Driver',
                name: 'Asha (Driver)',
                desc: 'Verified driver offering Women-Only campus rides',
                email: 'asha.driver@carpoolconnect.app',
                icon: '🚗',
                btnColor: 'from-purple-600 to-indigo-600'
              },
              {
                role: 'Campus Administrator',
                name: 'Deepa (Admin)',
                desc: 'Controls verification, ride metrics & safety reports',
                email: 'admin@carpoolconnect.app',
                icon: '👑',
                btnColor: 'from-amber-500 to-rose-600'
              }
            ].map((account) => (
              <div
                key={account.email}
                className="card card-hover flex flex-col justify-between p-5 text-center border-slate-200 dark:border-slate-800"
              >
                <div>
                  <span className="text-3xl mb-2 block">{account.icon}</span>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{account.name}</h4>
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider block mb-2">
                    {account.role}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{account.desc}</p>
                </div>
                <button
                  type="button"
                  disabled={demoLoading}
                  onClick={() => handleQuickDemo(account.email)}
                  className={`btn-primary w-full !py-2 text-xs bg-gradient-to-r ${account.btnColor}`}
                >
                  {demoLoading ? 'Signing in...' : 'Sign In as ' + account.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------- 6. MODERN FOOTER -------------------- */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md mt-12 py-12">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-cyan text-white shadow-sm">
              <Car className="h-4 w-4" />
            </span>
            <span className="font-heading font-bold text-lg bg-gradient-to-r from-brand-600 to-accent-cyan bg-clip-text text-transparent">
              CarPool Connect
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Link to="/safety" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Safety & Verification</Link>
            <Link to="/#features" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Features</Link>
            <Link to="/#eco-calculator" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Carbon Savings</Link>
            <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Sign In</Link>
            <Link to="/register" className="hover:text-brand-600 dark:hover:text-brand-400 transition">Register</Link>
          </div>

          <div className="text-xs text-slate-400 text-center md:text-right">
            © {new Date().getFullYear()} CarPool Connect. Campus Mobility Initiative.
          </div>
        </div>
      </footer>
    </div>
  );
}
