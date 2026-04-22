# 🛡️ SafeGuard — Women's Safety App

> A full-stack emergency safety platform built for Indian women, featuring multilingual AI assistance, SOS triggering, real-time location sharing, legal rights guidance, and nearby resource discovery — all in one app.

---

## ✨ Features

### 🆘 SOS & Emergency
- **Hold-to-trigger SOS** — 3-second hold with visual progress ring
- **Instant Panic Mode** — one-tap for critical emergencies
- **Live GPS tracking** — location pushed to backend every ~10 seconds during active SOS
- **Auto SOS** — AI chat detects risk score ≥ 9 and triggers SOS automatically
- **Emergency contact notifications** — SMS/WhatsApp alerts queued via Twilio-ready pipeline
- **Live map** — Google Maps iframe embedded in SOS active screen

### 🤖 AI Safety Assistant (Groq-powered)
- **Multilingual understanding** — detects and responds in 10 Indian languages (Hindi, Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi, English)
- **Intent detection** — classifies emergency, harassment, mental health, legal help, and more
- **Emotion analysis** — detects fear, panic, distress, anger with intensity scoring
- **Risk scoring** — 1–10 scale; score ≥ 7 triggers audit log, ≥ 9 triggers auto SOS
- **Abuse detection** — flags harassment and domestic violence language
- **Conversation context** — maintains session history for multi-turn conversations
- **Voice input** — Web Speech API with SOS keyword detection in all supported languages

### ⚖️ Legal Assistant
- **Know Your Rights** — covers sexual harassment (POSH), domestic violence (PWDVA), rape & assault, stalking, eve-teasing, child marriage
- **AI Legal Q&A** — ask any question, get answers with IPC sections and next steps **in your selected language**
- **FIR Draft Generator** — fills a complete FIR complaint template from form inputs
- **Relevant helplines** — NCW (1800-111-900), Women Helpline (181), Police (100), Cyber Crime portal

### 🗺️ Nearby Safety Resources
- **GPS-based search** — finds hospitals, police stations, fire stations, shelters, and safe zones
- **Adjustable radius** — 1km, 2km, 5km, 10km, 20km
- **AI enrichment** — when database results are thin (< 3), Groq AI generates realistic local resources
- **Google Maps integration** — directions and map links for every result
- **Phone call buttons** — tap to call any resource instantly
- **Fully localised UI** — labels, buttons, and status messages in selected language

### 📞 Helplines Directory
- Categorised: Police, Medical, Fire, Women, Child, Mental Health, Legal
- 24×7 badge, working hours, state-specific filtering
- Translated category names in all 10 languages

### 📊 Analytics Dashboard
- SOS incident statistics (total, resolved, false alarms, panic mode)
- Monthly trend chart (SVG line graph)
- Emergency type breakdown, trigger type breakdown
- AI chat intent and emotion distribution
- Languages used across AI conversations

### 👤 Profile & Settings
- Avatar upload to Supabase Storage
- Encrypted phone number (AES-256-GCM)
- Blood group, gender, date of birth, medical conditions
- Language preference (persisted to DB and localStorage)
- Privacy & consent management (DPDP 2023 compliant)
- Emergency contact priority reordering (drag-and-drop + ▲▼ buttons)

---

## 🏗️ Architecture

```
SafeGuard/
├── frontend/          # React 18 SPA
│   └── src/
│       ├── components/
│       │   ├── AI/            # AIChat with Groq analysis display
│       │   ├── Analytics/     # Usage reports & trend charts
│       │   ├── Auth/          # Register (2-step), Login, PrivateRoute
│       │   ├── Legal/         # LegalAssistant (Rights / Q&A / FIR)
│       │   ├── Privacy/       # ConsentManager
│       │   ├── Profile/       # ProfileDashboard, EmergencyContacts, LanguageSelector
│       │   └── SOS/           # SOSButton, SOSLiveMap, Helplines, HelpHistory, NearbyResources
│       ├── context/           # LanguageContext (i18n)
│       ├── hooks/             # useVoiceInput (Web Speech API)
│       ├── services/          # API clients (Supabase, Node backend, SOS, AI)
│       └── utils/             # translations.js (10 languages), languages.js
│
└── backend/
    └── node/          # Express.js API server
        └── src/
            ├── ai/            # groqService.js — analyzeMessage + generateResponse
            ├── config/        # supabase.js
            ├── middleware/    # auth.js, encryption.js (AES-256-GCM)
            └── routes/
                ├── ai.js      # /api/ai — chat, analyze, history, context
                ├── auth.js    # /api/auth — register, login, logout, me, refresh
                ├── emergency.js  # /api/emergency-contacts — CRUD
                ├── legal.js   # /api/legal — topics, rights, FIR draft, AI Q&A, analytics
                ├── profile.js # /api/profile — get/update profile, preferences, languages
                └── sos.js     # /api/sos — trigger, location, resolve, history, helplines, nearby
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Styling | Pure CSS (no framework), Google Fonts (Syne + DM Sans) |
| Backend | Node.js 18+, Express 4 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | Groq API — `llama-3.3-70b-versatile` |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Voice Input | Web Speech API (browser-native) |
| Maps | Google Maps iframe embed (no API key required) |
| Auth | Supabase Auth (JWT) |
| Rate Limiting | express-rate-limit |
| Security | helmet, cors |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A Supabase project
- A Groq API key (free tier available at [console.groq.com](https://console.groq.com))

---

### 1. Clone the repository

```bash
git clone https://github.com/your-org/safeguard.git
cd safeguard
```

---

### 2. Backend setup

```bash
cd backend/node
npm install
```

Create `.env` in `backend/node/`:

```env
# Server
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-hex-character-key

# Groq AI
GROQ_API_KEY=gsk_your_groq_api_key

# Frontend URL (for CORS in production)
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev      # development (nodemon)
npm start        # production
```

The server runs at `http://localhost:5000`. Visit `/health` to confirm.

---

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create `.env` in `frontend/`:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_NODE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm start
```

The app runs at `http://localhost:3000`.

---

### 4. Database setup

Run the following in your Supabase SQL editor to create required tables:

```sql
-- Core tables required
-- users, user_profiles, user_preferences, emergency_contacts,
-- sos_incidents, sos_locations, chat_messages, helplines,
-- safety_resources, help_history, notifications, audit_logs,
-- privacy_consents, supported_languages

-- Minimum: ensure emergency_contacts and users have auth tag columns
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS contact_name_auth_tag TEXT;
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS phone_number_auth_tag TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number_auth_tag TEXT;
```

Seed helplines data into the `helplines` table with columns: `name`, `phone_number`, `category`, `description`, `available_24x7`, `working_hours`, `state`, `priority_order`, `is_active`.

---

## 🌐 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh JWT token |

### SOS
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sos/trigger` | Trigger SOS incident |
| POST | `/api/sos/:id/location` | Update live location |
| PATCH | `/api/sos/:id/resolve` | Resolve / cancel SOS |
| GET | `/api/sos/active` | Get active incident |
| GET | `/api/sos/history` | Paginated incident history |
| GET | `/api/sos/helplines` | Get helplines (filterable) |
| GET | `/api/sos/nearby` | Nearby safety resources (GPS) |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/chat` | Full multilingual AI conversation |
| POST | `/api/ai/analyze` | Analyze text only (no response) |
| GET | `/api/ai/history` | Fetch chat history |
| DELETE | `/api/ai/context` | Clear conversation context |

### Legal
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/legal/topics` | List all legal topics |
| GET | `/api/legal/know-your-rights/:topic` | Get rights info for topic |
| POST | `/api/legal/fir-draft` | Generate FIR draft |
| POST | `/api/legal/ai-legal-help` | AI legal Q&A |
| GET | `/api/legal/analytics` | Usage analytics |

### Profile & Contacts
| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/api/profile` | Get / update profile |
| GET/PUT | `/api/profile/preferences` | Language, notifications, consents |
| GET | `/api/profile/languages` | Supported languages list |
| GET/POST | `/api/emergency-contacts` | List / add contacts |
| PUT/DELETE | `/api/emergency-contacts/:id` | Update / remove contact |

---

## 🔐 Security

- **AES-256-GCM encryption** on all phone numbers and contact names at rest
- **JWT authentication** via Supabase Auth on every protected route
- **Rate limiting** — 100 req/15min globally, 10 req/15min on auth routes
- **Helmet.js** HTTP security headers
- **CORS** restricted to configured frontend URL in production
- **Audit logging** — every sensitive action logged to `audit_logs` table
- **DPDP 2023 compliant** — consent management with per-user granular controls

---

## 🌍 Supported Languages

| Code | Language | Native Name |
|---|---|---|
| `en` | English | English |
| `hi` | Hindi | हिंदी |
| `ta` | Tamil | தமிழ் |
| `te` | Telugu | తెలుగు |
| `mr` | Marathi | मराठी |
| `bn` | Bengali | বাংলা |
| `gu` | Gujarati | ગુજરાતી |
| `kn` | Kannada | ಕನ್ನಡ |
| `ml` | Malayalam | മലയാളം |
| `pa` | Punjabi | ਪੰਜਾਬੀ |

Language selection persists to `user_preferences` in the database and is restored on login.

---

## 📱 Voice Input — SOS Keywords

The voice engine listens for emergency keywords in all 10 languages and automatically sends the message when detected:

**English:** help, sos, emergency, danger, save me, call police  
**Hindi:** bachao, madad, khatra, police bulao, mujhe bachao  
**Tamil:** udhavi, aapaththu, kaapaadunga  
**Telugu:** sahaayam, praanam, kapaadu  
**Marathi:** mala vachva, madad kara  

---

## 🧩 Module Map

| Module # | Feature | Files |
|---|---|---|
| 3 | Emergency Contact Management + Priority Reordering | `EmergencyContacts.jsx`, `emergency.js` |
| 4 | SOS Button (Hold-to-trigger) | `SOSButton.jsx`, `sos.js` |
| 5 | Real-time Location + Live Map | `SOSLiveMap.jsx`, `sosService.js` |
| 6 | Voice Input | `useVoiceInput.js` |
| 7 | Text Chat | `AIChat.jsx` |
| 8 | Emotion Detection | `groqService.js` |
| 9 | Help History | `HelpHistory.jsx` |
| 11 | Intent Detection | `sos.js` (classifyEmergency) |
| 12 | Panic Mode | `SOSButton.jsx`, `sos.js` |
| 13 | Helplines Directory | `Helplines.jsx`, `sos.js` |
| 14 | Auto Alert Message | `sos.js` (buildAutoMessage) |
| 15 | Nearby Safety Resources | `NearbyResources.jsx`, `sos.js` |
| 16 | AI Intent Classification | `groqService.js` |
| 17 | Conversation Context | `groqService.js` (ConversationContext) |
| 18 | Abuse Detection | `groqService.js` |
| 19 | Risk Scoring | `groqService.js` |
| 20 | Multilingual NLP | `groqService.js` (generateResponse) |
| 23 | Legal Content Management | `LegalAssistant.jsx`, `legal.js` |
| 26 | Notification Pipeline | `sos.js` (notifyEmergencyContacts) |
| 28 | Privacy & Consent | `ConsentManager.jsx`, `profile.js` |
| 30 | Analytics & Reports | `Analytics.jsx`, `legal.js` |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

SafeGuard is a supplementary safety tool. In any life-threatening emergency, always contact official emergency services first:

- **112** — National Emergency Number (India)
- **100** — Police
- **108** — Ambulance
- **1091** — Women in Distress
- **181** — Women Helpline
