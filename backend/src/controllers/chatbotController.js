const asyncHandler = require('../utils/asyncHandler');

/**
 * Lightweight, dependency-free support assistant.
 *
 * Deliberately rule-based rather than calling a paid LLM API: it needs no
 * API key, has zero per-message cost, and answers with facts this app can
 * actually stand behind (real routes, real policies) instead of a model
 * guessing about a product it has never seen. Each intent is matched by
 * keyword overlap and the highest-scoring intent above a small threshold
 * wins; ties fall back to a helpful default with quick-reply suggestions.
 */
const INTENTS = [
  {
    id: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'namaste', 'vanakkam'],
    reply: "Hi! I'm the CarPool Connect assistant. I can help with finding rides, bookings, safety (SOS), Women-Only rides, Eco Impact, or Lost & Found. What do you need?",
    suggestions: ['How do I book a ride?', 'What is the SOS button?', 'How does Eco Impact work?']
  },
  {
    id: 'book_ride',
    keywords: ['book', 'booking', 'find ride', 'find a ride', 'passenger', 'seat', 'request seat', 'how to travel'],
    reply: 'Go to "Find a Ride" from your passenger dashboard, search by origin, destination and date, then open a ride and tap "Request a seat". The driver will accept or reject your request and you\'ll get a notification either way.',
    suggestions: ['What if the ride is full?', 'What is the waiting list?']
  },
  {
    id: 'waitlist',
    keywords: ['full', 'waiting list', 'waitlist', 'no seats'],
    reply: 'If a ride is full you can join its waiting list from the ride details page. If a seat opens up (someone cancels), you\'ll be notified automatically and can claim it.',
    suggestions: ['How do I offer a ride instead?']
  },
  {
    id: 'offer_ride',
    keywords: ['offer ride', 'become driver', 'driver', 'publish ride', 'create ride', 'post a ride'],
    reply: 'Driver accounts can offer a ride from "Offer a Ride": set your origin, destination, departure time, pickup points, seats and any preferences (music, pets, smoking, luggage). Passenger requests then appear under "Passenger Requests".',
    suggestions: ['Can I offer a Women-Only ride?']
  },
  {
    id: 'women_only',
    keywords: ['women only', 'women-only', 'ladies', 'female driver', 'safe for women'],
    reply: 'Women-Only rides can only be created by drivers who identify as female, and this is enforced on the server, not just the UI. Passengers can filter for them under "Women-Only Rides" in the sidebar.',
    suggestions: ['What is the SOS button?']
  },
  {
    id: 'sos_safety',
    keywords: ['sos', 'emergency', 'panic', 'unsafe', 'help me', 'danger', 'safety'],
    reply: 'The red SOS button (bottom-right once you\'re logged in) instantly alerts every online admin in real time with your name, ride and location, and is also logged so it\'s never lost even if no admin is online at that second. Only use it for genuine emergencies.',
    suggestions: ['How do I report a driver instead?']
  },
  {
    id: 'report_safety',
    keywords: ['report', 'complain', 'misbehav', 'harass', 'rude driver'],
    reply: 'On any ride details page there\'s a report icon next to the booking button — use it to send a safety report straight to our moderation team, who review it from the Admin > Reports queue.',
    suggestions: ['What is the SOS button?']
  },
  {
    id: 'eco_impact',
    keywords: ['eco', 'carbon', 'co2', 'environment', 'green', 'sustainab'],
    reply: 'Every completed shared ride reduces solo-car trips, and we estimate the CO2 you\'ve saved on your "Eco Impact" page based on distance and seats shared. It\'s a running total, not a one-off number.',
    suggestions: ['How do I book a ride?']
  },
  {
    id: 'lost_found',
    keywords: ['lost', 'found', 'left behind', 'forgot', 'item'],
    reply: 'Lost something in a ride, or found something? Post it under "Lost & Found" with a description and the ride it relates to — the other party can then message you back.',
    suggestions: ['How do I book a ride?']
  },
  {
    id: 'account',
    keywords: ['password', 'login', 'log in', 'sign in', 'google', 'oauth', 'account'],
    reply: 'You can sign in with your email and password, or with "Continue with Google" on the login page. Forgot your password? For this demo, ask an admin to reset your account from the Admin > Users screen.',
    suggestions: ['How do I book a ride?']
  },
  {
    id: 'language',
    keywords: ['language', 'tamil', 'hindi', 'translate', 'மொழி'],
    reply: 'You can switch the interface language from the globe icon in the top navigation bar. English and Tamil are supported today.',
    suggestions: ['How do I book a ride?']
  },
  {
    id: 'thanks',
    keywords: ['thank', 'thanks', 'thank you', 'nandri'],
    reply: "You're welcome! Anything else I can help with?",
    suggestions: ['How do I book a ride?', 'What is the SOS button?']
  }
];

const FALLBACK = {
  reply: "I didn't quite catch that. I can help with booking rides, offering rides, Women-Only rides, the SOS safety button, Eco Impact, or Lost & Found — try asking about one of those, or contact an admin from the Reports page for anything else.",
  suggestions: ['How do I book a ride?', 'What is the SOS button?', 'How does Eco Impact work?']
};

function scoreIntent(text, intent) {
  const lower = text.toLowerCase();
  return intent.keywords.reduce((score, kw) => (lower.includes(kw) ? score + kw.split(' ').length : score), 0);
}

function matchIntent(message) {
  let best = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const score = scoreIntent(message, intent);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

// POST /api/chatbot/message  { message }  - public endpoint, no auth required
const sendMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.json({ success: true, reply: FALLBACK.reply, suggestions: FALLBACK.suggestions });
  }

  const intent = matchIntent(message.trim());
  if (!intent) {
    return res.json({ success: true, reply: FALLBACK.reply, suggestions: FALLBACK.suggestions });
  }

  res.json({ success: true, intent: intent.id, reply: intent.reply, suggestions: intent.suggestions || [] });
});

module.exports = { sendMessage };
