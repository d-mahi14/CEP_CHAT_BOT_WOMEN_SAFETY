// scripts/translate.js
// Run once: node scripts/translate.js
// Uses Groq (which you already have) to fill in missing translation keys

const axios = require('axios');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const LANGUAGES = {
  hi: 'Hindi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
};

// Keys that need translation (new additions)
const NEW_KEYS = {
  sos_hold: 'Hold 3 seconds to trigger emergency SOS',
  ec_add: 'Add Contact',
  nav_legal: 'Legal Help',
  nav_legal_desc: 'Rights & FIR',
  nav_analytics: 'Analytics',
  nav_analytics_desc: 'Reports',

  // Legal Tab
  legal_tab_rights: 'Know Your Rights',
  legal_tab_qa: 'Ask AI Legal Help',
  legal_tab_fir: 'Draft FIR',
  
  // Legal Subtitles
  legal_subtitle_rights: 'Select a topic to learn your legal rights and steps to take',
  legal_subtitle_qa: 'Ask any question about your legal rights in India',
  legal_subtitle_fir: 'Fill in the details below and we\'ll draft an FIR complaint for you',
  
  // Legal UI Elements
  legal_ask_btn: 'Ask',
  legal_ask_ph: 'e.g. What is IPC 354A? How do I file an FIR?',
  legal_answer_sections: 'Relevant Sections',
  legal_answer_steps: 'Next Steps',
  legal_answer_helplines: 'Helplines',
  legal_loading: 'Loading legal information...',
  legal_error: 'Could not reach the legal AI. Please try again.',
  
  // FIR Form Labels
  legal_fir_offense: 'Type of Offense',
  legal_fir_name: 'Your Full Name',
  legal_fir_phone: 'Your Phone Number',
  legal_fir_date: 'Date of Incident',
  legal_fir_time: 'Time of Incident',
  legal_fir_location: 'Location of Incident',
  legal_fir_address: 'Your Full Address',
  legal_fir_accused: 'Description of Accused',
  legal_fir_desc: 'Incident Description',
  legal_fir_witnesses: 'Witnesses (if any)',
  legal_fir_notice: 'This is a draft template. Review carefully before submitting to the police.',
  legal_fir_generate: 'Generate FIR Draft',
  legal_fir_generating: 'Generating...',
  legal_fir_copy: 'Copy',
  legal_fir_copied: 'Copied',

  // Example AI Questions
  legal_example_1: "Can I file an FIR if my husband is abusive?",
  legal_example_2: "What is the punishment for stalking under IPC?",
  legal_example_3: "How do I register a complaint at the workplace?",
  legal_example_4: "What are my rights if I am harassed in public?"
  // ... paste all new English keys here
};

async function translateKeys(langCode, langName, keys) {
  const prompt = `Translate these UI strings for an Indian women's safety app into ${langName}.
Return ONLY a raw JSON object. No backticks. No markdown.
Keys: ${JSON.stringify(keys)}`;

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator that outputs ONLY raw JSON without markdown formatting.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000, // Increased for safety with complex scripts
        response_format: { type: 'json_object' },
      },
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } }
    );
    return JSON.parse(res.data.choices[0].message.content);
  } catch (error) {
    if (error.response && error.response.data) {
      console.error(`Error for ${langName}:`, error.response.data.error.message);
    } else {
      console.error(`Error for ${langName}:`, error.message);
    }
    return null; // Skip this language and move to next
  }
}

async function main() {
  const results = {};
  for (const [code, name] of Object.entries(LANGUAGES)) {
    console.log(`Translating ${name}...`);
    results[code] = await translateKeys(code, name, NEW_KEYS); // Ensure this is one line
  }
  fs.writeFileSync('new_translations.json', JSON.stringify(results, null, 2));
  console.log('Done! Check new_translations.json');
}

main();