/**
 * Fictional fact sheet (Assumption A3). Every value here is invented for the demo.
 * Deliberately NOT covered, so the "a person will confirm" path is demonstrable:
 * pet policy, maintenance charges, floor-rise charges, exact GST amount, club membership fee, resale.
 */
type Fact = {
  projectId: string | null;
  key: string;
  category: string;
  valueEn: string;
  valueHi: string;
  valueGu: string;
  quotable?: boolean;
};

const P1 = "aranya";
const P2 = "vasant";

export const FACTS: Fact[] = [
  // ---- General (both projects) ----
  {
    projectId: null,
    key: "developer_overview",
    category: "developer",
    valueEn: "Company A is an Ahmedabad-based residential developer with two projects under construction: Aranya Heights (Shela) and Vasant Residency (Gota).",
    valueHi: "Company A अहमदाबाद की आवासीय डेवलपर है, जिसके दो प्रोजेक्ट निर्माणाधीन हैं: अरण्य हाइट्स (शेला) और वसंत रेज़िडेंसी (गोता)।",
    valueGu: "Company A અમદાવાદની રહેણાંક ડેવલપર છે, જેના બે પ્રોજેક્ટ બાંધકામ હેઠળ છે: અરણ્ય હાઇટ્સ (શેલા) અને વસંત રેસિડેન્સી (ગોતા).",
  },
  {
    projectId: null,
    key: "site_visit_timings",
    category: "visit",
    valueEn: "Site visits are held Tuesday to Sunday, 10 am to 5 pm, in one-hour slots. The sample flat and site office are closed on Mondays.",
    valueHi: "साइट विज़िट मंगलवार से रविवार, सुबह 10 से शाम 5 बजे तक, एक घंटे के स्लॉट में होती हैं। सोमवार को सैंपल फ्लैट और साइट ऑफिस बंद रहते हैं।",
    valueGu: "સાઇટ વિઝિટ મંગળવારથી રવિવાર, સવારે 10 થી સાંજે 5 વાગ્યા સુધી, એક કલાકના સ્લોટમાં થાય છે. સોમવારે સેમ્પલ ફ્લેટ અને સાઇટ ઓફિસ બંધ રહે છે.",
  },
  {
    projectId: null,
    key: "home_loan_banks",
    category: "payment",
    valueEn: "Both projects are approved for home loans by several major banks; the sales team shares the current list and helps with the paperwork.",
    valueHi: "दोनों प्रोजेक्ट कई प्रमुख बैंकों से होम लोन के लिए स्वीकृत हैं; सेल्स टीम मौजूदा सूची देती है और कागज़ी कार्रवाई में मदद करती है।",
    valueGu: "બંને પ્રોજેક્ટ ઘણી મોટી બેંકો દ્વારા હોમ લોન માટે મંજૂર છે; સેલ્સ ટીમ હાલની યાદી આપે છે અને કાગળકામમાં મદદ કરે છે.",
  },
  {
    projectId: null,
    key: "payment_plan_overview",
    category: "payment",
    valueEn: "Both projects follow a construction-linked payment plan. The schedule and amounts are explained by the sales team.",
    valueHi: "दोनों प्रोजेक्ट में निर्माण से जुड़ा भुगतान प्लान है। शेड्यूल और राशि सेल्स टीम समझाती है।",
    valueGu: "બંને પ્રોજેક્ટમાં બાંધકામ સાથે જોડાયેલ ચુકવણી પ્લાન છે. શેડ્યૂલ અને રકમ સેલ્સ ટીમ સમજાવે છે.",
    quotable: false,
  },
  {
    projectId: null,
    key: "price_policy",
    category: "price",
    valueEn: "Prices on the fact sheet are indicative starting prices that exclude stamp duty, registration, GST and other charges. The final price for a specific unit is confirmed only by the sales team.",
    valueHi: "फ़ैक्ट शीट की कीमतें शुरुआती संकेतात्मक कीमतें हैं, जिनमें स्टाम्प ड्यूटी, रजिस्ट्रेशन, GST और अन्य शुल्क शामिल नहीं हैं। किसी यूनिट की अंतिम कीमत केवल सेल्स टीम बताती है।",
    valueGu: "ફેક્ટ શીટની કિંમતો શરૂઆતની સૂચક કિંમતો છે, જેમાં સ્ટેમ્પ ડ્યુટી, રજિસ્ટ્રેશન, GST અને અન્ય ચાર્જ સામેલ નથી. કોઈ યુનિટની અંતિમ કિંમત ફક્ત સેલ્સ ટીમ જણાવે છે.",
  },
  {
    projectId: null,
    key: "booking_process",
    category: "payment",
    valueEn: "Unit selection and booking are done with a sales executive at the site office after the site visit.",
    valueHi: "यूनिट चुनना और बुकिंग साइट विज़िट के बाद साइट ऑफिस में सेल्स एग्ज़िक्यूटिव के साथ होती है।",
    valueGu: "યુનિટ પસંદગી અને બુકિંગ સાઇટ વિઝિટ પછી સાઇટ ઓફિસમાં સેલ્સ એક્ઝિક્યુટિવ સાથે થાય છે.",
  },
  {
    projectId: null,
    key: "nri_buyers",
    category: "payment",
    valueEn: "NRI buyers can book; the sales team guides them on documentation.",
    valueHi: "NRI खरीदार बुकिंग कर सकते हैं; सेल्स टीम दस्तावेज़ों में मार्गदर्शन करती है।",
    valueGu: "NRI ખરીદદારો બુકિંગ કરી શકે છે; સેલ્સ ટીમ દસ્તાવેજો અંગે માર્ગદર્શન આપે છે.",
  },

  // ---- Aranya Heights (Project 1) ----
  { projectId: P1, key: "overview", category: "configuration", valueEn: "Aranya Heights is a residential project of 3 towers with 14 floors each, offering 2 and 3 BHK apartments.", valueHi: "अरण्य हाइट्स 3 टावरों (प्रत्येक 14 मंज़िल) का आवासीय प्रोजेक्ट है, जिसमें 2 और 3 BHK अपार्टमेंट हैं।", valueGu: "અરણ્ય હાઇટ્સ 3 ટાવર (દરેક 14 માળ)નો રહેણાંક પ્રોજેક્ટ છે, જેમાં 2 અને 3 BHK એપાર્ટમેન્ટ છે." },
  { projectId: P1, key: "total_units", category: "configuration", valueEn: "Aranya Heights has 240 apartments in total.", valueHi: "अरण्य हाइट्स में कुल 240 अपार्टमेंट हैं।", valueGu: "અરણ્ય હાઇટ્સમાં કુલ 240 એપાર્ટમેન્ટ છે." },
  { projectId: P1, key: "carpet_area_2bhk", category: "configuration", valueEn: "2 BHK carpet area: 780 to 820 sq ft (RERA carpet).", valueHi: "2 BHK कारपेट एरिया: 780 से 820 वर्ग फुट (RERA कारपेट)।", valueGu: "2 BHK કાર્પેટ એરિયા: 780 થી 820 ચો. ફૂટ (RERA કાર્પેટ)." },
  { projectId: P1, key: "carpet_area_3bhk", category: "configuration", valueEn: "3 BHK carpet area: 1,140 to 1,210 sq ft (RERA carpet).", valueHi: "3 BHK कारपेट एरिया: 1,140 से 1,210 वर्ग फुट (RERA कारपेट)।", valueGu: "3 BHK કાર્પેટ એરિયા: 1,140 થી 1,210 ચો. ફૂટ (RERA કાર્પેટ)." },
  { projectId: P1, key: "price_2bhk", category: "price", valueEn: "2 BHK at Aranya Heights: starting from ₹82 lakh (indicative).", valueHi: "अरण्य हाइट्स में 2 BHK: ₹82 लाख से शुरू (संकेतात्मक)।", valueGu: "અરણ્ય હાઇટ્સમાં 2 BHK: ₹82 લાખથી શરૂ (સૂચક).", quotable: true },
  { projectId: P1, key: "price_3bhk", category: "price", valueEn: "3 BHK at Aranya Heights: starting from ₹1.05 crore (indicative).", valueHi: "अरण्य हाइट्स में 3 BHK: ₹1.05 करोड़ से शुरू (संकेतात्मक)।", valueGu: "અરણ્ય હાઇટ્સમાં 3 BHK: ₹1.05 કરોડથી શરૂ (સૂચક).", quotable: true },
  { projectId: P1, key: "possession", category: "possession", valueEn: "Possession date as per RERA registration: December 2028.", valueHi: "RERA पंजीकरण के अनुसार पज़ेशन की तारीख: दिसंबर 2028।", valueGu: "RERA નોંધણી મુજબ પઝેશન તારીખ: ડિસેમ્બર 2028." },
  { projectId: P1, key: "construction_status", category: "possession", valueEn: "Construction status: foundation and podium work is complete; tower superstructure is in progress.", valueHi: "निर्माण स्थिति: नींव और पोडियम का काम पूरा; टावरों का ढांचा बन रहा है।", valueGu: "બાંધકામ સ્થિતિ: પાયો અને પોડિયમનું કામ પૂર્ણ; ટાવરનું માળખું ચાલુ છે." },
  { projectId: P1, key: "rera", category: "approvals", valueEn: "RERA registration number: PR/GJ/AHMEDABAD/DEMO/RAA00001/2026 (demo number).", valueHi: "RERA पंजीकरण संख्या: PR/GJ/AHMEDABAD/DEMO/RAA00001/2026 (डेमो नंबर)।", valueGu: "RERA નોંધણી નંબર: PR/GJ/AHMEDABAD/DEMO/RAA00001/2026 (ડેમો નંબર)." },
  { projectId: P1, key: "approvals", category: "approvals", valueEn: "The building plan is approved by the local development authority; copies are available at the site office.", valueHi: "बिल्डिंग प्लान स्थानीय विकास प्राधिकरण से स्वीकृत है; प्रतियां साइट ऑफिस में उपलब्ध हैं।", valueGu: "બિલ્ડિંગ પ્લાન સ્થાનિક વિકાસ સત્તામંડળ દ્વારા મંજૂર છે; નકલો સાઇટ ઓફિસમાં ઉપલબ્ધ છે." },
  { projectId: P1, key: "location", category: "location", valueEn: "Location: off Shela–Bopal Road, Shela, Ahmedabad 380058.", valueHi: "लोकेशन: शेला–बोपल रोड के पास, शेला, अहमदाबाद 380058।", valueGu: "લોકેશન: શેલા–બોપલ રોડ પાસે, શેલા, અમદાવાદ 380058." },
  { projectId: P1, key: "connectivity", category: "location", valueEn: "About 2 km from SP Ring Road and about 4 km from Bopal crossroads.", valueHi: "SP रिंग रोड से लगभग 2 किमी और बोपल चौराहे से लगभग 4 किमी।", valueGu: "SP રિંગ રોડથી આશરે 2 કિમી અને બોપલ ચાર રસ્તાથી આશરે 4 કિમી." },
  { projectId: P1, key: "nearby_schools_hospitals", category: "schools", valueEn: "Schools and a multi-speciality hospital are within 5 km; the sales team can share names on the visit.", valueHi: "5 किमी के भीतर स्कूल और एक मल्टी-स्पेशियलिटी अस्पताल हैं; विज़िट पर सेल्स टीम नाम बता सकती है।", valueGu: "5 કિમીની અંદર સ્કૂલો અને એક મલ્ટી-સ્પેશિયાલિટી હોસ્પિટલ છે; વિઝિટ વખતે સેલ્સ ટીમ નામ જણાવી શકે છે." },
  { projectId: P1, key: "amenities", category: "amenities", valueEn: "Amenities: clubhouse, swimming pool, gym, children's play area, landscaped garden, jogging track and a multipurpose hall.", valueHi: "सुविधाएं: क्लबहाउस, स्विमिंग पूल, जिम, बच्चों का खेल क्षेत्र, लैंडस्केप गार्डन, जॉगिंग ट्रैक और मल्टीपर्पज़ हॉल।", valueGu: "સુવિધાઓ: ક્લબહાઉસ, સ્વિમિંગ પૂલ, જિમ, બાળકોનો રમતવિસ્તાર, લેન્ડસ્કેપ ગાર્ડન, જોગિંગ ટ્રેક અને મલ્ટીપર્પઝ હોલ." },
  { projectId: P1, key: "open_space", category: "amenities", valueEn: "Around 60% of the land is kept as open and landscaped space.", valueHi: "ज़मीन का लगभग 60% हिस्सा खुली और हरित जगह के रूप में रखा गया है।", valueGu: "જમીનનો આશરે 60% ભાગ ખુલ્લી અને હરિયાળી જગ્યા તરીકે રાખવામાં આવ્યો છે." },
  { projectId: P1, key: "parking", category: "parking", valueEn: "One covered car parking per 2 BHK and two per 3 BHK, in the basement.", valueHi: "बेसमेंट में 2 BHK के लिए एक और 3 BHK के लिए दो कवर्ड कार पार्किंग।", valueGu: "બેઝમેન્ટમાં 2 BHK માટે એક અને 3 BHK માટે બે કવર્ડ કાર પાર્કિંગ." },
  { projectId: P1, key: "lifts", category: "construction", valueEn: "Each tower has two passenger lifts and one service lift with power backup.", valueHi: "हर टावर में पावर बैकअप के साथ दो पैसेंजर लिफ्ट और एक सर्विस लिफ्ट है।", valueGu: "દરેક ટાવરમાં પાવર બેકઅપ સાથે બે પેસેન્જર લિફ્ટ અને એક સર્વિસ લિફ્ટ છે." },
  { projectId: P1, key: "power_backup", category: "water", valueEn: "Power backup for lifts, common areas and water pumps.", valueHi: "लिफ्ट, कॉमन एरिया और पानी के पंप के लिए पावर बैकअप।", valueGu: "લિફ્ટ, કોમન એરિયા અને પાણીના પંપ માટે પાવર બેકઅપ." },
  { projectId: P1, key: "water_supply", category: "water", valueEn: "Water supply from the municipal line and borewell, with an overhead and underground storage tank.", valueHi: "नगरपालिका लाइन और बोरवेल से पानी, ओवरहेड और अंडरग्राउंड टंकी के साथ।", valueGu: "મ્યુનિસિપલ લાઇન અને બોરવેલથી પાણી, ઓવરહેડ અને અંડરગ્રાઉન્ડ ટાંકી સાથે." },
  { projectId: P1, key: "security", category: "security", valueEn: "Gated campus with 24×7 security, CCTV in common areas and video door phones.", valueHi: "24×7 सुरक्षा, कॉमन एरिया में CCTV और वीडियो डोर फोन के साथ गेटेड परिसर।", valueGu: "24×7 સુરક્ષા, કોમન એરિયામાં CCTV અને વિડિયો ડોર ફોન સાથે ગેટેડ કેમ્પસ." },
  { projectId: P1, key: "structure", category: "construction", valueEn: "RCC frame structure designed as per seismic zone III norms.", valueHi: "भूकंपीय ज़ोन III मानकों के अनुसार डिज़ाइन किया गया RCC फ्रेम ढांचा।", valueGu: "ભૂકંપ ઝોન III ધોરણો મુજબ ડિઝાઇન કરેલું RCC ફ્રેમ માળખું." },
  { projectId: P1, key: "flooring", category: "construction", valueEn: "Vitrified tile flooring in living and bedrooms; anti-skid tiles in bathrooms and balconies.", valueHi: "लिविंग और बेडरूम में विट्रिफाइड टाइल फ़्लोरिंग; बाथरूम और बालकनी में एंटी-स्किड टाइल।", valueGu: "લિવિંગ અને બેડરૂમમાં વિટ્રિફાઇડ ટાઇલ ફ્લોરિંગ; બાથરૂમ અને બાલ્કનીમાં એન્ટી-સ્કિડ ટાઇલ." },
  { projectId: P1, key: "kitchen", category: "construction", valueEn: "Kitchen with granite platform and stainless steel sink.", valueHi: "ग्रेनाइट प्लेटफॉर्म और स्टेनलेस स्टील सिंक के साथ रसोई।", valueGu: "ગ્રેનાઇટ પ્લેટફોર્મ અને સ્ટેનલેસ સ્ટીલ સિંક સાથે રસોડું." },
  { projectId: P1, key: "sample_flat", category: "visit", valueEn: "A furnished 3 BHK sample flat is open for viewing at the site office.", valueHi: "साइट ऑफिस में देखने के लिए एक फर्निश्ड 3 BHK सैंपल फ्लैट खुला है।", valueGu: "સાઇટ ઓફિસમાં જોવા માટે એક ફર્નિશ્ડ 3 BHK સેમ્પલ ફ્લેટ ખુલ્લો છે." },
  { projectId: P1, key: "ev_charging", category: "parking", valueEn: "EV charging points are provided in the common parking area.", valueHi: "कॉमन पार्किंग एरिया में EV चार्जिंग पॉइंट दिए गए हैं।", valueGu: "કોમન પાર્કિંગ એરિયામાં EV ચાર્જિંગ પોઇન્ટ આપવામાં આવ્યા છે." },

  // ---- Vasant Residency (Project 2) ----
  { projectId: P2, key: "overview", category: "configuration", valueEn: "Vasant Residency is a residential project of 2 towers with 12 floors each, offering 2 and 3 BHK apartments.", valueHi: "वसंत रेज़िडेंसी 2 टावरों (प्रत्येक 12 मंज़िल) का आवासीय प्रोजेक्ट है, जिसमें 2 और 3 BHK अपार्टमेंट हैं।", valueGu: "વસંત રેસિડેન્સી 2 ટાવર (દરેક 12 માળ)નો રહેણાંક પ્રોજેક્ટ છે, જેમાં 2 અને 3 BHK એપાર્ટમેન્ટ છે." },
  { projectId: P2, key: "total_units", category: "configuration", valueEn: "Vasant Residency has 180 apartments in total.", valueHi: "वसंत रेज़िडेंसी में कुल 180 अपार्टमेंट हैं।", valueGu: "વસંત રેસિડેન્સીમાં કુલ 180 એપાર્ટમેન્ટ છે." },
  { projectId: P2, key: "carpet_area_2bhk", category: "configuration", valueEn: "2 BHK carpet area: 690 to 740 sq ft (RERA carpet).", valueHi: "2 BHK कारपेट एरिया: 690 से 740 वर्ग फुट (RERA कारपेट)।", valueGu: "2 BHK કાર્પેટ એરિયા: 690 થી 740 ચો. ફૂટ (RERA કાર્પેટ)." },
  { projectId: P2, key: "carpet_area_3bhk", category: "configuration", valueEn: "3 BHK carpet area: 1,010 to 1,060 sq ft (RERA carpet).", valueHi: "3 BHK कारपेट एरिया: 1,010 से 1,060 वर्ग फुट (RERA कारपेट)।", valueGu: "3 BHK કાર્પેટ એરિયા: 1,010 થી 1,060 ચો. ફૂટ (RERA કાર્પેટ)." },
  { projectId: P2, key: "price_2bhk", category: "price", valueEn: "2 BHK at Vasant Residency: starting from ₹65 lakh (indicative).", valueHi: "वसंत रेज़िडेंसी में 2 BHK: ₹65 लाख से शुरू (संकेतात्मक)।", valueGu: "વસંત રેસિડેન્સીમાં 2 BHK: ₹65 લાખથી શરૂ (સૂચક).", quotable: true },
  { projectId: P2, key: "price_3bhk", category: "price", valueEn: "3 BHK at Vasant Residency: starting from ₹88 lakh (indicative).", valueHi: "वसंत रेज़िडेंसी में 3 BHK: ₹88 लाख से शुरू (संकेतात्मक)।", valueGu: "વસંત રેસિડેન્સીમાં 3 BHK: ₹88 લાખથી શરૂ (સૂચક).", quotable: true },
  { projectId: P2, key: "possession", category: "possession", valueEn: "Possession date as per RERA registration: June 2027.", valueHi: "RERA पंजीकरण के अनुसार पज़ेशन की तारीख: जून 2027।", valueGu: "RERA નોંધણી મુજબ પઝેશન તારીખ: જૂન 2027." },
  { projectId: P2, key: "construction_status", category: "possession", valueEn: "Construction status: structure of both towers is complete; finishing work is in progress.", valueHi: "निर्माण स्थिति: दोनों टावरों का ढांचा पूरा; फ़िनिशिंग का काम चल रहा है।", valueGu: "બાંધકામ સ્થિતિ: બંને ટાવરનું માળખું પૂર્ણ; ફિનિશિંગનું કામ ચાલુ છે." },
  { projectId: P2, key: "rera", category: "approvals", valueEn: "RERA registration number: PR/GJ/AHMEDABAD/DEMO/RAA00002/2026 (demo number).", valueHi: "RERA पंजीकरण संख्या: PR/GJ/AHMEDABAD/DEMO/RAA00002/2026 (डेमो नंबर)।", valueGu: "RERA નોંધણી નંબર: PR/GJ/AHMEDABAD/DEMO/RAA00002/2026 (ડેમો નંબર)." },
  { projectId: P2, key: "approvals", category: "approvals", valueEn: "The building plan is approved by the local development authority; copies are available at the site office.", valueHi: "बिल्डिंग प्लान स्थानीय विकास प्राधिकरण से स्वीकृत है; प्रतियां साइट ऑफिस में उपलब्ध हैं।", valueGu: "બિલ્ડિંગ પ્લાન સ્થાનિક વિકાસ સત્તામંડળ દ્વારા મંજૂર છે; નકલો સાઇટ ઓફિસમાં ઉપલબ્ધ છે." },
  { projectId: P2, key: "location", category: "location", valueEn: "Location: near Vande Mataram Circle, Gota, Ahmedabad 382481.", valueHi: "लोकेशन: वंदे मातरम सर्कल के पास, गोता, अहमदाबाद 382481।", valueGu: "લોકેશન: વંદે માતરમ સર્કલ પાસે, ગોતા, અમદાવાદ 382481." },
  { projectId: P2, key: "connectivity", category: "location", valueEn: "About 1.5 km from SG Highway and about 3 km from SP Ring Road.", valueHi: "SG हाईवे से लगभग 1.5 किमी और SP रिंग रोड से लगभग 3 किमी।", valueGu: "SG હાઇવેથી આશરે 1.5 કિમી અને SP રિંગ રોડથી આશરે 3 કિમી." },
  { projectId: P2, key: "nearby_schools_hospitals", category: "schools", valueEn: "Schools, a hospital and daily-needs shops are within 3 km; the sales team can share names on the visit.", valueHi: "3 किमी के भीतर स्कूल, अस्पताल और रोज़मर्रा की दुकानें हैं; विज़िट पर सेल्स टीम नाम बता सकती है।", valueGu: "3 કિમીની અંદર સ્કૂલો, હોસ્પિટલ અને રોજિંદી જરૂરિયાતની દુકાનો છે; વિઝિટ વખતે સેલ્સ ટીમ નામ જણાવી શકે છે." },
  { projectId: P2, key: "amenities", category: "amenities", valueEn: "Amenities: gym, children's play area, senior citizens' sit-out, garden, indoor games room and a party lawn.", valueHi: "सुविधाएं: जिम, बच्चों का खेल क्षेत्र, वरिष्ठ नागरिकों के लिए बैठक, गार्डन, इनडोर गेम्स रूम और पार्टी लॉन।", valueGu: "સુવિધાઓ: જિમ, બાળકોનો રમતવિસ્તાર, વરિષ્ઠ નાગરિકો માટે બેઠક, ગાર્ડન, ઇન્ડોર ગેમ્સ રૂમ અને પાર્ટી લૉન." },
  { projectId: P2, key: "swimming_pool", category: "amenities", valueEn: "Vasant Residency does not have a swimming pool.", valueHi: "वसंत रेज़िडेंसी में स्विमिंग पूल नहीं है।", valueGu: "વસંત રેસિડેન્સીમાં સ્વિમિંગ પૂલ નથી." },
  { projectId: P2, key: "parking", category: "parking", valueEn: "One covered car parking per apartment, plus visitor parking.", valueHi: "हर अपार्टमेंट के लिए एक कवर्ड कार पार्किंग, साथ में विज़िटर पार्किंग।", valueGu: "દરેક એપાર્ટમેન્ટ માટે એક કવર્ડ કાર પાર્કિંગ, સાથે વિઝિટર પાર્કિંગ." },
  { projectId: P2, key: "lifts", category: "construction", valueEn: "Each tower has two lifts with power backup.", valueHi: "हर टावर में पावर बैकअप के साथ दो लिफ्ट हैं।", valueGu: "દરેક ટાવરમાં પાવર બેકઅપ સાથે બે લિફ્ટ છે." },
  { projectId: P2, key: "power_backup", category: "water", valueEn: "Power backup for lifts, common areas and water pumps.", valueHi: "लिफ्ट, कॉमन एरिया और पानी के पंप के लिए पावर बैकअप।", valueGu: "લિફ્ટ, કોમન એરિયા અને પાણીના પંપ માટે પાવર બેકઅપ." },
  { projectId: P2, key: "water_supply", category: "water", valueEn: "Water supply from the municipal line with an underground storage tank.", valueHi: "अंडरग्राउंड टंकी के साथ नगरपालिका लाइन से पानी।", valueGu: "અંડરગ્રાઉન્ડ ટાંકી સાથે મ્યુનિસિપલ લાઇનથી પાણી." },
  { projectId: P2, key: "security", category: "security", valueEn: "Gated campus with 24×7 security and CCTV in common areas.", valueHi: "24×7 सुरक्षा और कॉमन एरिया में CCTV के साथ गेटेड परिसर।", valueGu: "24×7 સુરક્ષા અને કોમન એરિયામાં CCTV સાથે ગેટેડ કેમ્પસ." },
  { projectId: P2, key: "structure", category: "construction", valueEn: "RCC frame structure designed as per seismic zone III norms.", valueHi: "भूकंपीय ज़ोन III मानकों के अनुसार डिज़ाइन किया गया RCC फ्रेम ढांचा।", valueGu: "ભૂકંપ ઝોન III ધોરણો મુજબ ડિઝાઇન કરેલું RCC ફ્રેમ માળખું." },
  { projectId: P2, key: "flooring", category: "construction", valueEn: "Vitrified tile flooring throughout; anti-skid tiles in bathrooms.", valueHi: "पूरे घर में विट्रिफाइड टाइल फ़्लोरिंग; बाथरूम में एंटी-स्किड टाइल।", valueGu: "આખા ઘરમાં વિટ્રિફાઇડ ટાઇલ ફ્લોરિંગ; બાથરૂમમાં એન્ટી-સ્કિડ ટાઇલ." },
  { projectId: P2, key: "kitchen", category: "construction", valueEn: "Kitchen with granite platform and stainless steel sink.", valueHi: "ग्रेनाइट प्लेटफॉर्म और स्टेनलेस स्टील सिंक के साथ रसोई।", valueGu: "ગ્રેનાઇટ પ્લેટફોર્મ અને સ્ટેનલેસ સ્ટીલ સિંક સાથે રસોડું." },
  { projectId: P2, key: "sample_flat", category: "visit", valueEn: "A 2 BHK sample flat is open for viewing at the site office.", valueHi: "साइट ऑफिस में देखने के लिए एक 2 BHK सैंपल फ्लैट खुला है।", valueGu: "સાઇટ ઓફિસમાં જોવા માટે એક 2 BHK સેમ્પલ ફ્લેટ ખુલ્લો છે." },
  { projectId: P2, key: "rainwater", category: "water", valueEn: "Rainwater harvesting system for the campus.", valueHi: "परिसर के लिए वर्षा जल संचयन प्रणाली।", valueGu: "કેમ્પસ માટે વરસાદી પાણી સંગ્રહ વ્યવસ્થા." },
];
