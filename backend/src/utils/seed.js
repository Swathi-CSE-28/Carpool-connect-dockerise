/**
 * Dev seed script: creates real, working accounts and rides for a college
 * carpool scenario around National Engineering College, Kovilpatti (Tamil
 * Nadu) — no "Lorem ipsum" / "Test User" placeholders, every record is a
 * plausible, internally-consistent record you could demo with.
 *
 * Run with: npm run seed  (requires MONGO_URI configured in .env)
 */
require('dotenv').config();
const crypto = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

const PASSWORD = 'Carpool@123';

async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Ride.deleteMany({}),
    Booking.deleteMany({})
  ]);

  // ---- Users (7 total: 1 admin, 3 drivers, 3 passengers) ----
  const admin = await User.create({
    name: 'Deepa Rajendran',
    email: 'admin@carpoolconnect.app',
    password: PASSWORD,
    role: 'admin',
    gender: 'female',
    phone: '+91 90031 22456',
    isVerified: true,
    apiKey: `cpc_${crypto.randomBytes(24).toString('hex')}`
  });

  const driverAsha = await User.create({
    name: 'Asha Lakshmanan',
    email: 'asha.driver@carpoolconnect.app',
    password: PASSWORD,
    role: 'driver',
    gender: 'female',
    phone: '+91 98430 11287',
    isVerified: true,
    preferences: { music: true, smoking: false, pets: false, luggage: true, conversation: 'chatty' }
  });

  const driverRavi = await User.create({
    name: 'Ravikumar Sundaram',
    email: 'ravi.driver@carpoolconnect.app',
    password: PASSWORD,
    role: 'driver',
    gender: 'male',
    phone: '+91 96297 45590',
    isVerified: false,
    preferences: { music: false, smoking: false, pets: true, luggage: true, conversation: 'no_preference' }
  });

  const driverKarthika = await User.create({
    name: 'Karthika Pandiyan',
    email: 'karthika.driver@carpoolconnect.app',
    password: PASSWORD,
    role: 'driver',
    gender: 'female',
    phone: '+91 91503 67820',
    isVerified: true,
    preferences: { music: true, smoking: false, pets: false, luggage: false, conversation: 'quiet' }
  });

  const passengerMeera = await User.create({
    name: 'Meera Chandrasekaran',
    email: 'meera.passenger@carpoolconnect.app',
    password: PASSWORD,
    role: 'passenger',
    gender: 'female',
    phone: '+91 89396 20144'
  });

  const passengerDinesh = await User.create({
    name: 'Dinesh Bharathi',
    email: 'dinesh.passenger@carpoolconnect.app',
    password: PASSWORD,
    role: 'passenger',
    gender: 'male',
    phone: '+91 87788 34012'
  });

  const passengerPriya = await User.create({
    name: 'Priyanka Manoharan',
    email: 'priya.passenger@carpoolconnect.app',
    password: PASSWORD,
    role: 'passenger',
    gender: 'female',
    phone: '+91 90478 55321'
  });

  // ---- Rides ----
  const rideOne = await Ride.create({
    driver: driverAsha._id,
    origin: { label: 'Kovilpatti Bus Stand', lat: 9.1725, lng: 77.8686 },
    destination: { label: 'National Engineering College, Kovilpatti', lat: 9.1652, lng: 77.8935 },
    pickupPoints: [
      { label: 'Kovilpatti Bus Stand', order: 0, approxTime: '08:00 AM' },
      { label: 'Kovilpatti Railway Station Road', order: 1, approxTime: '08:07 AM' }
    ],
    departureTime: new Date(Date.now() + 18 * 60 * 60 * 1000),
    totalSeats: 3,
    seatsAvailable: 2,
    pricePerSeat: 30,
    womenOnly: true,
    preferences: { music: true, smoking: false, pets: false, luggage: true, conversation: 'chatty' },
    distanceKm: 12
  });

  const rideTwo = await Ride.create({
    driver: driverRavi._id,
    origin: { label: 'Tuticorin Railway Station', lat: 8.7642, lng: 78.1348 },
    destination: { label: 'National Engineering College, Kovilpatti', lat: 9.1652, lng: 77.8935 },
    pickupPoints: [{ label: 'Tuticorin Railway Station', order: 0, approxTime: '07:40 AM' }],
    departureTime: new Date(Date.now() + 20 * 60 * 60 * 1000),
    totalSeats: 4,
    seatsAvailable: 4,
    pricePerSeat: 60,
    preferences: { music: false, smoking: false, pets: true, luggage: true, conversation: 'no_preference' },
    distanceKm: 35
  });

  const rideThree = await Ride.create({
    driver: driverKarthika._id,
    origin: { label: 'Ettayapuram Road, Kovilpatti', lat: 9.1801, lng: 77.8570 },
    destination: { label: 'National Engineering College, Kovilpatti', lat: 9.1652, lng: 77.8935 },
    pickupPoints: [{ label: 'Ettayapuram Road Junction', order: 0, approxTime: '08:15 AM' }],
    departureTime: new Date(Date.now() + 22 * 60 * 60 * 1000),
    totalSeats: 2,
    seatsAvailable: 1,
    pricePerSeat: 25,
    womenOnly: true,
    preferences: { music: true, smoking: false, pets: false, luggage: false, conversation: 'quiet' },
    distanceKm: 8
  });

  await Booking.create({
    ride: rideOne._id,
    passenger: passengerMeera._id,
    pickupPointId: rideOne.pickupPoints[0]._id,
    seatsRequested: 1,
    status: 'accepted',
    respondedAt: new Date()
  });

  await Booking.create({
    ride: rideThree._id,
    passenger: passengerPriya._id,
    pickupPointId: rideThree.pickupPoints[0]._id,
    seatsRequested: 1,
    status: 'accepted',
    respondedAt: new Date()
  });

  await Booking.create({
    ride: rideTwo._id,
    passenger: passengerDinesh._id,
    pickupPointId: rideTwo.pickupPoints[0]._id,
    seatsRequested: 1,
    status: 'pending'
  });

  console.log('\nSeed complete. 7 accounts created (password for all: "Carpool@123"):\n');
  console.log(`  Admin      -> ${admin.email}`);
  console.log(`  Driver     -> ${driverAsha.email}  (verified, offers a Women-Only ride)`);
  console.log(`  Driver     -> ${driverRavi.email}`);
  console.log(`  Driver     -> ${driverKarthika.email}  (verified, offers a Women-Only ride)`);
  console.log(`  Passenger  -> ${passengerMeera.email}  (has an accepted booking)`);
  console.log(`  Passenger  -> ${passengerDinesh.email}  (has a pending booking)`);
  console.log(`  Passenger  -> ${passengerPriya.email}  (has an accepted booking)`);
  console.log(`\n  Admin public-integration API key -> ${admin.apiKey}`);
  console.log('  Try it: curl -H "x-api-key: <key above>" http://localhost:5000/api/public/stats\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
