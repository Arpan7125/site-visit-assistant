export type Lang = "EN" | "HI" | "GU";
export const LANGS: { code: Lang; label: string; htmlLang: string; name: string }[] = [
  { code: "EN", label: "EN", htmlLang: "en", name: "English" },
  { code: "HI", label: "हिं", htmlLang: "hi", name: "हिन्दी" },
  { code: "GU", label: "ગુજ", htmlLang: "gu", name: "ગુજરાતી" },
];
export const htmlLang = (l: Lang) => LANGS.find((x) => x.code === l)!.htmlLang;

/** Buyer-facing interface strings. Assistant replies are generated in the same language. */
export const T = {
  talkToPerson: { EN: "Talk to a person", HI: "किसी व्यक्ति से बात करें", GU: "વ્યક્તિ સાથે વાત કરો" },
  placeholder: { EN: "Ask about the homes or a visit", HI: "घरों या विज़िट के बारे में पूछें", GU: "ઘરો અથવા વિઝિટ વિશે પૂછો" },
  send: { EN: "Send", HI: "भेजें", GU: "મોકલો" },
  typing: { EN: "Writing a reply", HI: "जवाब लिखा जा रहा है", GU: "જવાબ લખાઈ રહ્યો છે" },
  chipVisit: { EN: "Book a site visit", HI: "साइट विज़िट बुक करें", GU: "સાઇટ વિઝિટ બુક કરો" },
  chipLocation: { EN: "Where is it?", HI: "यह कहाँ है?", GU: "આ ક્યાં છે?" },
  chipPrice: { EN: "Starting prices", HI: "शुरुआती कीमतें", GU: "શરૂઆતની કિંમતો" },
  chooseTime: { EN: "Choose a time", HI: "समय चुनें", GU: "સમય પસંદ કરો" },
  noSlots: { EN: "No free times in the next week. A person will suggest one.", HI: "अगले हफ़्ते कोई खाली समय नहीं है। कोई व्यक्ति समय सुझाएगा।", GU: "આવતા અઠવાડિયે કોઈ ખાલી સમય નથી. કોઈ વ્યક્તિ સમય સૂચવશે." },
  slotTaken: { EN: "Someone just booked that time. Here are the nearest free times.", HI: "यह समय अभी किसी ने बुक कर लिया। ये नज़दीकी खाली समय हैं।", GU: "આ સમય હમણાં જ કોઈએ બુક કર્યો. આ નજીકના ખાલી સમય છે." },
  visitBooked: { EN: "Site visit booked", HI: "साइट विज़िट बुक हो गई", GU: "સાઇટ વિઝિટ બુક થઈ ગઈ" },
  openMap: { EN: "Open map", HI: "नक्शा खोलें", GU: "નકશો ખોલો" },
  addCalendar: { EN: "Add to calendar", HI: "कैलेंडर में जोड़ें", GU: "કેલેન્ડરમાં ઉમેરો" },
  manageVisit: { EN: "Change or cancel", HI: "बदलें या रद्द करें", GU: "બદલો અથવા રદ કરો" },
  remindersOn: { EN: "We'll send a WhatsApp reminder a day before and 2 hours before.", HI: "हम एक दिन पहले और 2 घंटे पहले व्हाट्सऐप रिमाइंडर भेजेंगे।", GU: "અમે એક દિવસ પહેલાં અને 2 કલાક પહેલાં વૉટ્સએપ રિમાઇન્ડર મોકલીશું." },
  remindersOff: { EN: "No reminders will be sent, as we don't have your consent to contact you.", HI: "कोई रिमाइंडर नहीं भेजा जाएगा, क्योंकि संपर्क की सहमति नहीं है।", GU: "કોઈ રિમાઇન્ડર મોકલાશે નહીં, કારણ કે સંપર્કની સંમતિ નથી." },
  rera: { EN: "RERA No.", HI: "RERA नं.", GU: "RERA નં." },
  contactTitle: { EN: "Your details", HI: "आपकी जानकारी", GU: "આપની વિગતો" },
  contactWhyBooking: { EN: "So the site office knows who is coming.", HI: "ताकि साइट ऑफिस को पता हो कि कौन आ रहा है।", GU: "જેથી સાઇટ ઓફિસને ખબર પડે કે કોણ આવી રહ્યું છે." },
  contactWhyHandoff: { EN: "So our team can reach you.", HI: "ताकि हमारी टीम आपसे संपर्क कर सके।", GU: "જેથી અમારી ટીમ આપનો સંપર્ક કરી શકે." },
  name: { EN: "Name", HI: "नाम", GU: "નામ" },
  phone: { EN: "Mobile number", HI: "मोबाइल नंबर", GU: "મોબાઇલ નંબર" },
  consent: {
    EN: "I agree that the sales team may contact me about this enquiry by call or WhatsApp, including visit reminders. I can stop this any time by typing STOP.",
    HI: "मैं सहमत हूँ कि सेल्स टीम इस पूछताछ के बारे में मुझसे कॉल या व्हाट्सऐप पर संपर्क कर सकती है, जिसमें विज़िट रिमाइंडर शामिल हैं। मैं कभी भी STOP लिखकर इसे बंद कर सकता/सकती हूँ।",
    GU: "હું સંમત છું કે સેલ્સ ટીમ આ પૂછપરછ અંગે મારો કૉલ અથવા વૉટ્સએપ દ્વારા સંપર્ક કરી શકે છે, જેમાં વિઝિટ રિમાઇન્ડર સામેલ છે. હું ક્યારેય પણ STOP લખીને આ બંધ કરી શકું છું.",
  },
  noConsentNote: { EN: "Without consent we keep only your name and won't call or message you.", HI: "सहमति के बिना हम केवल आपका नाम रखेंगे और कॉल या संदेश नहीं करेंगे।", GU: "સંમતિ વિના અમે ફક્ત આપનું નામ રાખીશું અને કૉલ કે સંદેશ નહીં કરીએ." },
  save: { EN: "Save details", HI: "जानकारी सहेजें", GU: "વિગતો સાચવો" },
  saved: { EN: "Details saved.", HI: "जानकारी सहेज ली गई।", GU: "વિગતો સાચવી લેવાઈ." },
  passedTo: { EN: "Passed to", HI: "सौंपा गया", GU: "સોંપાયું" },
  rateLimited: { EN: "You're sending messages quickly. Please wait a few seconds and try again.", HI: "आप बहुत जल्दी संदेश भेज रहे हैं। कुछ सेकंड रुककर फिर कोशिश करें।", GU: "આપ ઝડપથી સંદેશા મોકલી રહ્યા છો. થોડી સેકંડ રાહ જોઈ ફરી પ્રયાસ કરો." },
  sendFailed: { EN: "Your message didn't send. Check your connection and try again.", HI: "आपका संदेश नहीं गया। कनेक्शन जाँचें और फिर कोशिश करें।", GU: "આપનો સંદેશ ન ગયો. કનેક્શન તપાસી ફરી પ્રયાસ કરો." },
  retry: { EN: "Try again", HI: "फिर कोशिश करें", GU: "ફરી પ્રયાસ કરો" },
  aiNote: {
    EN: "You're chatting with a virtual assistant. It answers only from our approved project information.",
    HI: "आप एक वर्चुअल सहायक से चैट कर रहे हैं। यह केवल हमारी स्वीकृत प्रोजेक्ट जानकारी से जवाब देती है।",
    GU: "આપ વર્ચ્યુઅલ સહાયક સાથે ચૅટ કરી રહ્યા છો. તે ફક્ત અમારી મંજૂર પ્રોજેક્ટ માહિતી પરથી જવાબ આપે છે.",
  },
} satisfies Record<string, Record<Lang, string>>;

export function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang];
}
