import type { Language } from "@prisma/client";

/** Fixed, pre-approved buyer-facing lines. Used when the model is not allowed or not able to answer. */
export const COPY = {
  ack: {
    EN: "Hello, and thank you for your interest. I'm the virtual assistant for our homes in Ahmedabad. I can answer questions from our project fact sheet and book a site visit for you. How can I help?",
    HI: "नमस्ते, आपकी रुचि के लिए धन्यवाद। मैं अहमदाबाद में हमारे घरों की वर्चुअल सहायक हूँ। मैं प्रोजेक्ट की जानकारी दे सकती हूँ और आपकी साइट विज़िट बुक कर सकती हूँ। मैं आपकी कैसे मदद करूँ?",
    GU: "નમસ્તે, આપના રસ બદલ આભાર. હું અમદાવાદમાં અમારા ઘરો માટેની વર્ચ્યુઅલ સહાયક છું. હું પ્રોજેક્ટની માહિતી આપી શકું છું અને આપની સાઇટ વિઝિટ બુક કરી શકું છું. હું આપની કેવી રીતે મદદ કરું?",
  },
  safeFallback: {
    EN: "A member of our team will confirm that for you.",
    HI: "हमारी टीम का एक सदस्य आपको इसकी पुष्टि करेगा।",
    GU: "અમારી ટીમના સભ્ય આપને તેની પુષ્ટિ કરશે.",
  },
  missingFact: {
    EN: "I don't have that detail in our project fact sheet, so I won't guess. A member of our team will confirm it for you.",
    HI: "यह जानकारी हमारी प्रोजेक्ट फ़ैक्ट शीट में नहीं है, इसलिए मैं अनुमान नहीं लगाऊँगी। हमारी टीम का एक सदस्य आपको इसकी पुष्टि करेगा।",
    GU: "આ માહિતી અમારી પ્રોજેક્ટ ફેક્ટ શીટમાં નથી, તેથી હું અનુમાન નહીં લગાવું. અમારી ટીમના સભ્ય આપને તેની પુષ્ટિ કરશે.",
  },
  discount: {
    EN: "I'm not able to discuss discounts or a final price. Those are confirmed only by our sales team, and I've asked them to get in touch with you.",
    HI: "मैं छूट या अंतिम कीमत पर बात नहीं कर सकती। इसकी पुष्टि केवल हमारी सेल्स टीम करती है, और मैंने उनसे आपसे संपर्क करने को कहा है।",
    GU: "હું ડિસ્કાઉન્ટ અથવા અંતિમ કિંમત વિશે વાત કરી શકતી નથી. તેની પુષ્ટિ ફક્ત અમારી સેલ્સ ટીમ કરે છે, અને મેં તેમને આપનો સંપર્ક કરવા કહ્યું છે.",
  },
  outage: {
    EN: "Sorry, I'm having trouble answering right now. A person from our team will reply to you shortly. Your message has been saved.",
    HI: "क्षमा करें, अभी जवाब देने में दिक्कत हो रही है। हमारी टीम का कोई सदस्य जल्द ही आपको जवाब देगा। आपका संदेश सहेज लिया गया है।",
    GU: "માફ કરશો, અત્યારે જવાબ આપવામાં મુશ્કેલી છે. અમારી ટીમના સભ્ય ટૂંક સમયમાં આપને જવાબ આપશે. આપનો સંદેશ સાચવી લેવાયો છે.",
  },
  optedOut: {
    EN: "Done. We won't contact you by call, WhatsApp or SMS any more, and any visit reminders are cancelled. You can still chat here whenever you like.",
    HI: "हो गया। अब हम आपसे कॉल, व्हाट्सऐप या SMS से संपर्क नहीं करेंगे, और विज़िट रिमाइंडर रद्द कर दिए गए हैं। आप जब चाहें यहाँ चैट कर सकते हैं।",
    GU: "થઈ ગયું. હવે અમે આપનો કૉલ, વૉટ્સએપ કે SMS દ્વારા સંપર્ક નહીં કરીએ, અને વિઝિટ રિમાઇન્ડર રદ કરાયા છે. આપ ઇચ્છો ત્યારે અહીં ચૅટ કરી શકો છો.",
  },
  handoff: {
    EN: (exec: string) => `I've passed our conversation to ${exec} from our sales team, who will contact you shortly.`,
    HI: (exec: string) => `मैंने हमारी बातचीत सेल्स टीम के ${exec} को भेज दी है, वे जल्द ही आपसे संपर्क करेंगे।`,
    GU: (exec: string) => `મેં આપણી વાતચીત સેલ્સ ટીમના ${exec}ને મોકલી છે, તેઓ ટૂંક સમયમાં આપનો સંપર્ક કરશે.`,
  },
  handoffNoContact: {
    EN: (exec: string) =>
      `I've passed our conversation to ${exec} from our sales team. To be contacted, please share your number using the form below; otherwise ${exec} will reply here.`,
    HI: (exec: string) =>
      `मैंने हमारी बातचीत सेल्स टीम के ${exec} को भेज दी है। संपर्क के लिए कृपया नीचे फ़ॉर्म में अपना नंबर दें; वरना ${exec} यहीं जवाब देंगे।`,
    GU: (exec: string) =>
      `મેં આપણી વાતચીત સેલ્સ ટીમના ${exec}ને મોકલી છે. સંપર્ક માટે કૃપા કરીને નીચેના ફોર્મમાં આપનો નંબર આપો; નહીં તો ${exec} અહીં જ જવાબ આપશે.`,
  },
  booked: {
    EN: (project: string, time: string) => `Your site visit to ${project} is booked for ${time}. The details are below.`,
    HI: (project: string, time: string) => `${project} पर आपकी साइट विज़िट ${time} के लिए बुक हो गई है। विवरण नीचे है।`,
    GU: (project: string, time: string) => `${project} ખાતે આપની સાઇટ વિઝિટ ${time} માટે બુક થઈ ગઈ છે. વિગતો નીચે છે.`,
  },
  indicative: {
    EN: "Prices shown are indicative starting prices from our fact sheet; the final price is confirmed only by our sales team.",
    HI: "दिखाई गई कीमतें हमारी फ़ैक्ट शीट से शुरुआती संकेतात्मक कीमतें हैं; अंतिम कीमत की पुष्टि केवल हमारी सेल्स टीम करती है।",
    GU: "દર્શાવેલ કિંમતો અમારી ફેક્ટ શીટ મુજબ શરૂઆતની સૂચક કિંમતો છે; અંતિમ કિંમતની પુષ્ટિ ફક્ત અમારી સેલ્સ ટીમ કરે છે.",
  },
} as const;

export function line(key: Exclude<keyof typeof COPY, "handoff" | "handoffNoContact" | "booked">, lang: Language): string {
  return COPY[key][lang];
}
