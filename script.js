/* =========================================================
   PB MAIL HELPER PRO — script.js
   Vanilla JS. No frameworks.
   ========================================================= */

/* ---------- APP STATE ---------- */
const appState = {
  activeTemplateId: null,
  searchQuery: "",
  fieldValues: {},          // { fieldKey: value }
  sectionSelections: {},    // { sectionKey: boolean }
  documents: [],            // for RF template
  workingMode: false,       // RF
  workingDays: 5,           // RF working mode default
  tatDays: 10,              // RF
  updateDateOffset: 10,     // RF default (+10 calendar days)
  manualText: "",           // REQUEST CLOSURE
  manualTextVisible: false, // REQUEST CLOSURE
  previewEditing: false,
  manualPreviewOverride: null, // if user edits preview directly
  showUpdateDateOptions: false, // RF: reveal exact-date/working-day controls
  showTatOptions: false,        // RF: reveal TAT day controls
  miniPos: null,
  isFloating: false,
  isPiPActive: false
};

/* =========================================================
   DOCUMENT NAME NORMALIZATION MAP (for RF template)
   ========================================================= */
const DOC_MAP = [
  { keys: ["rc", "registration certificate"], out: "RC (REGISTRATION CERTIFICATE)" },
  { keys: ["aadhar", "aadhaar", "adhar", "aadhar card", "aadhaar card"], out: "AADHAAR CARD" },
  { keys: ["pan", "pan card"], out: "PAN CARD" },
  { keys: ["dl", "driving license", "driving licence"], out: "DRIVING LICENSE" },
  { keys: ["pyp", "previous year policy"], out: "PREVIOUS YEAR POLICY (PYP)" },
  { keys: ["cng", "cng invoice"], out: "CNG INVOICE" },
  { keys: ["noc"], out: "NOC" },
  { keys: ["fitness", "fitness certificate"], out: "FITNESS CERTIFICATE" },
  { keys: ["form35", "form 35"], out: "FORM 35" }
];

function normalizeDocument(raw) {
  if (!raw) return "";
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  for (const item of DOC_MAP) {
    if (item.keys.includes(key)) return item.out;
  }
  // Unknown -> uppercase
  return raw.trim().toUpperCase();
}

/* =========================================================
   INDIAN NUMBER FORMATTING
   ========================================================= */
function cleanAmount(raw) {
  if (raw === null || raw === undefined) return "";
  // Remove Rs, ₹, /-, commas, spaces
  let s = String(raw).replace(/[₹]/g, "").replace(/rs\.?/ig, "").replace(/\/-/g, "").replace(/,/g, "").trim();
  // Extract first number-like sequence (allow decimal)
  const m = s.match(/[\d]+(?:\.\d+)?/);
  return m ? m[0] : "";
}

function formatIndianNumber(numStr, decimals) {
  if (!numStr) return "";
  const n = parseFloat(numStr);
  if (isNaN(n)) return "";
  let fixed;
  if (decimals !== undefined) {
    fixed = n.toFixed(decimals);
  } else {
    fixed = String(n);
  }
  const parts = fixed.split(".");
  let intPart = parts[0];
  const decPart = parts[1];
  // Indian grouping: last 3 digits, then groups of 2
  const negative = intPart.startsWith("-");
  if (negative) intPart = intPart.slice(1);
  let out;
  if (intPart.length <= 3) {
    out = intPart;
  } else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const restFmt = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = restFmt + "," + last3;
  }
  if (negative) out = "-" + out;
  return decPart !== undefined ? out + "." + decPart : out;
}

/* =========================================================
   DATE HELPERS
   ========================================================= */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatDateDDMonthYYYY(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = MONTHS[date.getMonth()];
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}
function addDays(base, days) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/* =========================================================
   TEMPLATE DEFINITIONS
   ========================================================= */
const mailTemplates = [
  /* ---------- 1. RF ---------- */
  {
    id: "rf",
    header: "RF",
    description: "Request forwarded / endorsement processing mail builder",
    keywords: ["rf", "request forwarded", "forwarded request", "endorsement request", "status update", "tat mail", "forwarded"],
    type: "hybrid",
    defaultSelections: {
      greeting: true,
      reference: true,
      forwarded: true,
      documents: false,
      updateDate: true,
      tat: true,
      charges: true,
      originalCopy: true
    }
  },

  /* ---------- 2. ENDORSEMENT DONE ---------- */
  {
    id: "endts_done",
    header: "ENDORSEMENT DONE",
    description: "Share completed endorsed policy copy",
    keywords: ["endts done", "endorsement copy", "endorsement done", "endorsement completed", "endorsed copy", "endorsement complete", "endts"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "Please find attached the Endorsed soft copy of your policy.",
      "",
      "We wish to inform you that you need to keep your original soft copy along with the Endorsed copy for future."
    ].join("\n")
  },

  /* ---------- 3. SF PAYMENT ---------- */
  {
    id: "sf_payment",
    header: "SF PAYMENT",
    description: "Premium shortfall payment link mail",
    keywords: ["sf mail", "sf link", "shortfall", "short fall", "premium shortfall", "payment shortfall", "sf"],
    type: "dynamic",
    fields: [
      { key: "amount", label: "Shortfall Amount", placeholder: "e.g. 5000 or ₹5000 or Rs. 5000/-", type: "text" },
      { key: "link", label: "Payment Link", placeholder: "Paste payment link", type: "text" }
    ]
  },

  /* ---------- 4. REFUND DONE ---------- */
  {
    id: "refund_done",
    header: "REFUND DONE",
    description: "Refund processed successfully",
    keywords: ["refund done", "refund successful", "refund sucessful", "refund completed", "refund processed", "refund success", "refund"],
    type: "dynamic",
    defaultSelections: { workingDays: 7 },
    fields: [
      { key: "amount", label: "Refund Amount", placeholder: "e.g. 5000 or Rs 5000", type: "text" }
    ]
  },

  /* ---------- 2W VIDEO INSPECTION ---------- */
  {
    id: "two_w_video_inspection",
    header: "2W VIDEO INSPECTION",
    description: "Two-wheeler self-video inspection instructions",
    keywords: ["2w inspection", "2w video", "bike video", "bike inspection", "two wheeler video", "two wheeler inspection", "2 wheeler inspection", "2 wheeler video", "scooter inspection", "self video inspection", "pb inspect"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "Request you to follow the below guidelines to do a self video inspection of your vehicle.",
      "",
      "For Android:",
      "https://play.google.com/store/apps/details?id=com.policybazaar&hl=en-GB&pli=1&pid=mobile_hamburger&c=mobile_hamburger_dropdown",
      "",
      "For iOS Devices:",
      "https://apps.apple.com/in/app/id956740142?mt=8",
      "",
      "Mobile phone criteria:",
      "",
      "• Android based smart phone with Android version 5.0 or above OR iOS based device.",
      "• Mobile camera should be 4 Mega pixels or above.",
      "• Mobile Data or Wi-Fi connection should be turned ON on your smart phone.",
      "",
      "Inspection Guidelines:",
      "",
      "• The video has to be captured during day light.",
      "• Videos captured in basements or shades (e.g. tree shades) will not be valid.",
      "",
      "Video capture process:",
      "",
      "1. Install PB-inspect App on Google Playstore:",
      "https://play.google.com/store/apps/details?id=com.pb.inspection",
      "2. You can view the Demo video to understand the process further.",
      "3. Click on \"Start Inspection\", enter your Mobile number and Vehicle number to start the inspection.",
      "4. Start from front side of the vehicle with clear visibility of Registration number.",
      "5. Move towards left and start to capture the entire vehicle by moving 360 degrees around the vehicle.",
      "6. When you are on the back side of the vehicle, ensure clear visibility of Registration number.",
      "7. Ensure you capture Chassis number as part of the video.",
      "8. Also, ensure that you capture the odometer reading.",
      "9. In case of any dent or scratches, please take the mobile closer to the place where the dent or scratch is visible and capture a picture as well using the \"Capture\" option available on right hand side bottom corner of the screen while the video capture process is ON.",
      "10. You need not exit the App for this picture capture process. The same will happen while the video capturing is ON.",
      "11. 360 Degree view of the vehicle has to be captured in a single video and the vehicle cannot go out of focus at any time of the video capturing.",
      "12. The RC copy and Previous year policy copy (if applicable) should be captured in the video either at the start or end.",
      "13. Once you are done with capturing the video, please click the Upload button and ensure you do not exit the screen while the upload is in process."
    ].join("\n")
  },
  /* ---------- 5. 4W VIDEO INSPECTION ---------- */
  {
    id: "video_inspection",
    header: "4W VIDEO INSPECTION",
    description: "Four-wheeler self-video inspection instructions",
    keywords: ["video", "inspection", "4w video", "video inspection", "inspection video", "4w inspection", "car inspection", "self video", "vehicle video"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "Inspection of your vehicle is mandatory for us to proceed with the requested changes in your policy.",
      "",
      "Please follow the below guidelines to upload a self-video inspection of your vehicle:",
      "",
      "For Android:",
      "https://play.google.com/store/apps/details?id=com.policybazaar&hl=en-GB&pli=1&pid=mobile_hamburger&c=mobile_hamburger_dropdown",
      "",
      "For iOS:",
      "https://apps.apple.com/in/app/id956740142?mt=8",
      "",
      "Mobile Phone Requirements:",
      "",
      "• Android smartphone with Android version 5.0 or above OR an iOS device.",
      "• Mobile camera should be 4 MP or above.",
      "• Mobile data or Wi-Fi connection must be enabled.",
      "",
      "Things to Remember:",
      "",
      "• Capture the video in daylight, preferably before 6:00 PM on a clear day.",
      "• Avoid recording in basements, under shades, under trees, parking areas, or beneath electricity wires.",
      "• Ensure the vehicle is in a clean condition.",
      "• In case of dents or scratches, capture the affected area clearly by moving the mobile closer.",
      "• Ensure that the vehicle remains in focus throughout the video recording.",
      "",
      "Please read the instructions carefully before starting the video capture process:",
      "",
      "1. Install the PolicyBazaar App.",
      "2. View the Demo Video and follow the steps carefully.",
      "3. Click on \"Start Inspection\".",
      "4. Enter your Mobile Number and Vehicle Registration Number, including all digits and letters.",
      "5. Keep the RC (Registration Certificate) and Previous Year Policy ready.",
      "6. Open the bonnet and start making the video as guided in the application.",
      "7. Record the RC and Previous Year Policy.",
      "8. Start the engine and record the Odometer reading. A reading captured in trip mode will not be valid.",
      "9. Capture the external view of the vehicle.",
      "10. Record the Engine Number and Chassis Number, which may be located under the front bonnet or below/beside the driver/front passenger seat.",
      "11. Close the bonnet and record a complete 360-degree view of the vehicle as guided on the screen. Maintain an approximate distance of 2–3 feet from the vehicle.",
      "12. After completing the recording, click the Upload button and ensure that you exit the screen only after the upload is completed successfully.",
      "",
      "Once you successfully upload the video, kindly let us know so that we can proceed further with your request.",
      "",
      "Note:",
      "Please ensure that the CNG cylinder is also clearly captured if the vehicle has an externally fitted CNG kit."
    ].join("\n")
  },

  /* ---------- 6. CANCELLATION ---------- */
  {
    id: "cancellation",
    header: "CANCELLATION",
    description: "Post-issuance policy cancellation process",
    keywords: ["cancellation", "cancel", "post issuance cancel", "post issuance cancellation", "post issunce cancel", "post issunce cancellation", "118", "alt policy", "alternate policy", "alternative policy", "alternative"],
    type: "selectable",
    defaultSelections: { alternate: true }
  },

  /* ---------- 7. CHARGEBACK REVERSAL ---------- */
  {
    id: "chargeback",
    header: "CHARGEBACK REVERSAL",
    description: "Request customer to reverse bank chargeback",
    keywords: ["chargeback", "charge back", "reverse chargeback", "chargeback reverse", "bank chargeback", "cb request", "reverse cb"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We request you to kindly reverse the chargeback request with your respective bank and share the confirmation with us, so that we can process the refund from our end."
    ].join("\n")
  },

  /* ---------- BAJAJ OT ---------- */
  {
    id: "insured_person_change",
    header: "BAJAJ OT",
    description: "Request RC and PF form for new insured person details",
    keywords: ["insured person", "new insured", "insured person change", "new insured person", "rc", "pf", "rc pf", "rc and form", "pf form", "proposal form", "bajaj ot", "bajaj pf", "bajaj proposal form", "ot", "registration certificate", "name transfer"],
    type: "selectable",
    defaultSelections: { rc: true, pf: true }
  },
  /* ---------- CLAIM QUERY ---------- */
  {
    id: "claim_query",
    header: "CLAIM QUERY",
    description: "Share claims department contact details",
    keywords: ["claim", "claims", "claim query", "claims query", "claim department", "claims department", "spotclaims", "spotclaims email", "toll free claim", "claim contact"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is in reference to your request.",
      "",
      "Please share your concern with our claims department at Spotclaims@policybazaar.com or contact us at our toll-free number 1800-258-5881."
    ].join("\n")
  },
  /* ---------- 8. CALL NOT ANSWERED ---------- */
  {
    id: "call_not_answered",
    header: "CALL NOT ANSWERED",
    description: "Request customer to share suitable callback timing",
    keywords: ["call not answered", "not answered", "call unanswered", "callback", "call back", "suitable", "suitable timing", "pending concern", "registered mobile"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "We tried reaching you on the registered mobile no. however, the call was not answered.",
      "",
      "This is with the reference to your request.",
      "",
      "We request you to kindly share the suitable timing to connect with you on your pending concern."
    ].join("\n")
  },
  /* ---------- 8. COMPLETE MISMATCH ---------- */
  {
    id: "complete_mismatch",
    header: "COMPLETE MISMATCH",
    description: "Registration, chassis and engine details all mismatched",
    keywords: ["complete mismatch", "complete miss match", "total mismatch", "total miss match", "mismatch", "missmatch", "miss match", "all details mismatch", "details mismatch", "reg chassis engine mismatch", "complete details mismatch"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that the details mentioned in the policy are completely mismatched, as the Registration Number, Chassis Number, and Engine Number are all incorrect.",
      "",
      "Due to the complete mismatch in the vehicle details, correction and cancellation of the policy are not possible.",
      "",
      "We appreciate your understanding in this regard."
    ].join("\n")
  },

  /* ---------- 9. OD VAHAN ---------- */
  {
    id: "od_vahan",
    header: "OD VAHAN",
    description: "Own Damage policy details do not reflect on M-Parivahan",
    keywords: ["od vahan", "saod vahan", "od mparivahan", "od m parivahan", "mparivahan od", "m parivahan od", "own damage vahan", "own damage mparivahan", "saod mparivahan", "saod m parivahan", "third party vahan", "parivahan od", "m pariavahn", "maparivahan od"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that Own Damage (OD) policy details cannot be updated or reflected on M-Parivahan. Only Third-Party policy details are reflected on M-Parivahan.",
      "",
      "We request you to kindly refer to your Third-Party policy details on M-Parivahan."
    ].join("\n")
  },

  /* ---------- 10. VAHAN 7WD ---------- */
  {
    id: "vahan_7wd",
    header: "VAHAN 7WD",
    description: "M-Parivahan / VAHAN update may take up to 7 working days",
    keywords: ["vahan 7wd", "parivahan update", "mparivahan update", "m parivahan update", "parivahan pending", "vahan pending", "vahan update", "tp update", "third party update", "7 working days vahan", "7wd vahan"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that the policy update on the M-Parivahan/VAHAN portal may take up to 7 working days. The processing time remains the same irrespective of the policy start date.",
      "",
      "Meanwhile, you may use the soft copy (PDF) of your insurance policy as valid proof of insurance, if required by any concerned authority.",
      "",
      "We appreciate your patience and understanding."
    ].join("\n")
  },

  /* ---------- 11. VAHAN UPDATED ---------- */
  {
    id: "vahan_updated",
    header: "VAHAN UPDATED",
    description: "Policy details already updated on M-Parivahan",
    keywords: ["vahan updated", "mparivahan updated", "m parivahan updated", "policy updated vahan", "vahan done", "mparivahan done", "nextgen mparivahan", "vahan reflect", "policy reflect", "updated parivahan"],
    type: "selectable",
    defaultSelections: { screenshot: false }
  },

  /* ---------- 12. PA NOMINEE ---------- */
  {
    id: "pa_nominee",
    header: "PA NOMINEE",
    description: "Standalone PA cover nominee details explanation",
    keywords: ["pa nominee", "standalone pa", "stand alone pa", "pa policy", "nominee pa", "nominee details", "separate pa", "pa copy", "personal accident nominee", "sa pa nominee"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that you have opted for a Stand-Alone Personal Accident (PA) Cover, and the nominee details are already updated in the respective PA policy.",
      "",
      "Since the Personal Accident (PA) Cover has been issued as a separate policy, the nominee details under the PA policy do not impact the vehicle insurance policy.",
      "",
      "Please find attached the PA policy copy for your reference."
    ].join("\n")
  },

  /* ---------- 13. RENEWAL CONTACT ---------- */
  {
    id: "renewal_contact",
    header: "RENEWAL CONTACT",
    description: "Vehicle policy renewal contact details",
    keywords: ["renewal", "renew", "2w renewal", "4w renewal", "two wheeler renewal", "car renewal", "renewal number", "renewal contact", "renewal team", "policy renewal"],
    type: "selectable",
    defaultSelections: { twoW: true, fourW: true }
  },

  /* ---------- 14. DIGILOCKER UPDATE ---------- */
  {
    id: "digilocker",
    header: "DIGILOCKER UPDATE",
    description: "Policy active but external DigiLocker update issue",
    keywords: ["digilocker", "digi locker", "dig locker", "policy active valid", "active policy", "third party website", "third party platform", "digilocker update", "digi locker update", "policy not showing digilocker", "policy missing digilocker"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that the attached insurance policy is active and valid.",
      "",
      "Please note that we do not have a provision to update or modify policy details on third-party platforms such as DigiLocker. Therefore, for any concern related to the display, availability, or update of policy details on DigiLocker, we request you to kindly contact DigiLocker Support for further assistance."
    ].join("\n")
  },

  /* ---------- 15. REQUEST CLOSURE ---------- */
  {
    id: "request_closure",
    header: "REQUEST CLOSURE",
    description: "Close request after telephonic conversation",
    keywords: ["close request", "request close", "closing request", "closure", "close ticket", "ticket close", "call discussion", "telephonic conversation", "as discussed", "case close", "request closure"],
    type: "dynamic"
  }
];

/* =========================================================
   SEARCH ENGINE
   ========================================================= */
function normalizeSearch(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTemplates(query) {
  const q = normalizeSearch(query);
  if (!q) return [];

  const results = [];
  for (const tpl of mailTemplates) {
    let score = 0;
    const headerNorm = normalizeSearch(tpl.header);
    const descNorm = normalizeSearch(tpl.description);

    // Exact header match
    if (headerNorm === q) score += 1000;
    // Header starts with
    if (headerNorm.startsWith(q)) score += 400;
    // Header contains
    if (headerNorm.includes(q)) score += 200;

    // Keyword exact
    for (const kw of tpl.keywords) {
      const kNorm = normalizeSearch(kw);
      if (kNorm === q) score += 500;
      else if (kNorm.startsWith(q)) score += 150;
      else if (kNorm.includes(q)) score += 80;
      else if (q.includes(kNorm) && kNorm.length >= 3) score += 40;
    }

    // Description contains
    if (descNorm.includes(q)) score += 30;

    // Word-by-word matching (each query word must appear somewhere)
    const qWords = q.split(" ").filter(w => w.length >= 2);
    if (qWords.length > 1) {
      const haystack = headerNorm + " " + descNorm + " " + tpl.keywords.map(normalizeSearch).join(" ");
      let allWordsMatch = true;
      for (const w of qWords) {
        if (!haystack.includes(w)) { allWordsMatch = false; break; }
      }
      if (allWordsMatch) score += 60;
    }

    // Common typo tolerance for very short queries (single character difference)
    if (score === 0 && q.length >= 4) {
      const haystack = headerNorm + " " + tpl.keywords.map(normalizeSearch).join(" ");
      if (fuzzyContains(haystack, q)) score += 20;
    }

    if (score > 0) results.push({ tpl, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.tpl);
}

function fuzzyContains(haystack, needle) {
  // simple 1-edit tolerance check per word
  const words = haystack.split(" ");
  for (const w of words) {
    if (Math.abs(w.length - needle.length) > 2) continue;
    if (levenshtein(w, needle) <= 1) return true;
  }
  return false;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

/* =========================================================
   TEMPLATE RENDERERS (BUILD PREVIEW TEXT)
   ========================================================= */
function buildPreview() {
  if (appState.manualPreviewOverride !== null) {
    return appState.manualPreviewOverride;
  }
  const tpl = getActiveTemplate();
  if (!tpl) return "";

  if (tpl.type === "fixed") return tpl.body;

  switch (tpl.id) {
    case "rf":              return buildRF();
    case "sf_payment":      return buildSF();
    case "refund_done":     return buildRefund();
    case "cancellation":    return buildCancellation();
    case "insured_person_change": return buildInsuredPersonChange();
    case "vahan_updated":   return buildVahanUpdated();
    case "renewal_contact": return buildRenewal();
    case "request_closure": return buildClosure();
    default: return tpl.body || "";
  }
}

function getActiveTemplate() {
  return mailTemplates.find(t => t.id === appState.activeTemplateId) || null;
}

/* ---------- RF ---------- */
function buildRF() {
  const s = appState.sectionSelections;
  const parts = [];

  if (s.greeting) parts.push("Greetings from PolicyBazaar.com!");
  if (s.reference) parts.push("This is with reference to your request.");
  if (s.forwarded) parts.push("We would like to inform you that we have forwarded your request to the insurance company.");

  if (s.documents && appState.documents.length > 0) {
    let docBlock = "We kindly request you to share the following documents to proceed further with your request:\n";
    for (const d of appState.documents) docBlock += "\n• " + d;
    parts.push(docBlock);
  }

  if (s.updateDate) {
    if (appState.workingMode) {
      const days = appState.workingDays;
      const unit = days === 1 ? "working day" : "working days";
      parts.push(`Request you to kindly allow us ${days} ${unit} to share the status update.`);
    } else {
      const target = addDays(new Date(), appState.updateDateOffset);
      parts.push(`Request you to kindly allow us time till ${formatDateDDMonthYYYY(target)} to share the status update.`);
    }
  }

  if (s.tat && !appState.workingMode) {
    parts.push(`We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to ${appState.tatDays} days.`);
  }

  if (s.charges && !appState.workingMode) {
    parts.push("We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.");
  }

  if (s.originalCopy && !appState.workingMode) {
    parts.push("We wish to inform you that you need to keep your original soft copy along with the Endorsed copy for future.");
  }

  return parts.join("\n\n");
}

/* ---------- BAJAJ OT ---------- */
function buildInsuredPersonChange() {
  const s = appState.sectionSelections;
  const docs = [];
  if (s.rc) docs.push("copy of your vehicle's RC (Registration Certificate)");
  if (s.pf) docs.push("attached form after filling the same with the information of new insured person");

  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is in reference to your request."
  ];

  if (docs.length > 0) {
    parts.push("", `We request you to share the ${docs.join(" & share the ")}, for us to proceed further with your request.`);
  }

  parts.push(
    "",
    "We would like to inform you that we have forwarded your request to the insurance company.",
    "",
    "We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to 10 days.",
    "",
    "We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.",
    "",
    "We wish to inform you that you need to keep your original soft copy along with the Endorsed copy for future."
  );

  return parts.join("\n");
}
/* ---------- SF PAYMENT ---------- */
function buildSF() {
  const rawAmt = appState.fieldValues.amount || "";
  const cleaned = cleanAmount(rawAmt);
  const amt = cleaned ? formatIndianNumber(cleaned) : "[AMOUNT]";
  const link = (appState.fieldValues.link || "").trim() || "[PAYMENT LINK]";

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    `We would like to inform you that, as confirmed by the Insurer, there is a shortfall in the premium amount of Rs. ${amt}/- for your insurance policy.`,
    "",
    "We kindly request you to make the payment using the link provided below:",
    "",
    link,
    "",
    "Once the payment is completed, kindly share the payment screenshot with us for further processing of your request."
  ].join("\n");
}

/* ---------- REFUND DONE ---------- */
function buildRefund() {
  const rawAmt = appState.fieldValues.amount || "";
  const cleaned = cleanAmount(rawAmt);
  const amt = cleaned ? formatIndianNumber(cleaned, 2) : "[AMOUNT]";
  const days = appState.workingDays || 7;
  const unit = days === 1 ? "working day" : "working days";

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    `We would like to inform you that your refund of Rs. ${amt} has been processed successfully.`,
    "",
    `The refund amount is expected to reflect within ${days} ${unit} in the applicable account as per the refund details available for your request.`
  ].join("\n");
}

/* ---------- CANCELLATION ---------- */
function buildCancellation() {
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We wish to inform you that the cancellation process usually takes 10 days after receiving all the required documents/details."
  ];
  if (appState.sectionSelections.alternate) {
    parts.push("", "We request you to kindly share an alternate policy along with the reason for cancellation for further processing.");
  }
  parts.push("", "Further, we wish to inform you that there may be a pro-rata deduction along with Rs. 118/- administrative charges, if applicable, as confirmed by the insurer. We shall keep you informed through our future communication.");
  return parts.join("\n");
}

/* ---------- VAHAN UPDATED ---------- */
function buildVahanUpdated() {
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We would like to inform you that your policy details have already been updated on M-Parivahan."
  ];
  if (appState.sectionSelections.screenshot) {
    parts.push("", "Please find attached the M-Parivahan screenshot for your reference.");
  }
  parts.push(
    "",
    "You may check the updated policy details using the NextGen mParivahan application through the link provided below:",
    "",
    "https://play.google.com/store/apps/details?id=com.nic.mparivahan"
  );
  return parts.join("\n");
}

/* ---------- RENEWAL CONTACT ---------- */
function buildRenewal() {
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We request you to kindly visit the PolicyBazaar website for the renewal of your vehicle insurance policy.",
    "",
    "Website:",
    "www.policybazaar.com"
  ];
  if (appState.sectionSelections.twoW) {
    parts.push(
      "",
      "TWO-WHEELER RENEWAL:",
      "",
      "• 1800 208 8787 - IVR Toll-Free Number",
      "• 0124 6138301 - Direct connection with the Two-Wheeler Renewal Team"
    );
  }
  if (appState.sectionSelections.fourW) {
    parts.push(
      "",
      "FOUR-WHEELER RENEWAL:",
      "",
      "• 1800 419 7716 - Four-Wheeler Renewal Assistance"
    );
  }
  parts.push("", "We request you to kindly contact the relevant renewal team for further assistance.");
  return parts.join("\n");
}

/* ---------- REQUEST CLOSURE ---------- */
function buildClosure() {
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We would like to inform you that, as per our telephonic conversation, we are proceeding with the closure of this request."
  ];
  const manual = (appState.manualText || "").trim();
  if (manual) {
    parts.push("", manual);
  }
  return parts.join("\n");
}

/* =========================================================
   RENDER — LEFT CONTROLS PANE
   ========================================================= */
function renderControls() {
  const empty = document.getElementById("controlsEmpty");
  const content = document.getElementById("controlsContent");
  const tpl = getActiveTemplate();

  if (!tpl) {
    empty.style.display = "";
    content.style.display = "none";
    renderQuickTemplates();
    return;
  }
  empty.style.display = "none";
  content.style.display = "";

  document.getElementById("activeTplHeader").textContent = tpl.header;

  const host = document.getElementById("dynamicControls");
  host.innerHTML = "";

  if (tpl.type === "fixed") {
    const info = document.createElement("div");
    info.className = "control-group";
    info.innerHTML = `<div class="ctrl-label">Info</div><div style="font-size:12.5px;color:var(--text-soft);">This is a fixed template. Preview the mail on the right and click <b>Copy Mail</b>.</div>`;
    host.appendChild(info);
    return;
  }

  switch (tpl.id) {
    case "rf":              renderRFControls(host); break;
    case "sf_payment":      renderSFControls(host); break;
    case "refund_done":     renderRefundControls(host); break;
    case "cancellation":    renderCancellationControls(host); break;
    case "insured_person_change": renderInsuredPersonChangeControls(host); break;
    case "vahan_updated":   renderVahanUpdatedControls(host); break;
    case "renewal_contact": renderRenewalControls(host); break;
    case "request_closure": renderClosureControls(host); break;
  }
}

function renderQuickTemplates() {
  const host = document.getElementById("quickTemplates");
  host.innerHTML = "";
  mailTemplates.forEach(t => {
    const chip = document.createElement("button");
    chip.className = "quick-tpl-chip";
    chip.type = "button";
    chip.textContent = t.header;
    chip.addEventListener("click", () => selectTemplate(t.id));
    host.appendChild(chip);
  });
}

/* ---------- RF Controls ---------- */
function renderRFControls(host) {
  const s = appState.sectionSelections;

  const grp1 = createGroup("Sections");
  grp1.appendChild(createToggleRow("Greeting", "Greetings from PolicyBazaar.com!", s.greeting, val => { s.greeting = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Reference", "This is with reference to your request.", s.reference, val => { s.reference = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Request Forwarded", "Forwarded to insurance company", s.forwarded, val => { s.forwarded = val; updatePreview(); }));
  host.appendChild(grp1);

  /* Documents */
  const docGrp = createGroup("Documents");
  docGrp.appendChild(createToggleRow("Include Documents", "Adds document request block", s.documents, val => {
    s.documents = val;
    if (val) {
      s.updateDate = false; // auto-off per rules
    }
    renderControls();
    updatePreview();
  }));
  if (s.documents) {
    const docWrap = document.createElement("div");
    docWrap.style.marginTop = "8px";
    docWrap.innerHTML = `
      <div class="doc-input-row">
        <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, aadhar, pyp"/>
        <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
      </div>
      <div class="doc-chips" id="docChips"></div>
    `;
    docGrp.appendChild(docWrap);
  }
  host.appendChild(docGrp);

  /* Update Date + Working */
  const dateGrp = createGroup("Timing");
  dateGrp.appendChild(createToggleRow("Exact TAT", appState.workingMode ? "Working-days wording" : "Exact TAT wording", s.updateDate, val => { s.updateDate = val; updatePreview(); }));

  const dateOptionsBtn = document.createElement("button");
  dateOptionsBtn.type = "button";
  dateOptionsBtn.className = "working-btn";
  dateOptionsBtn.style.marginTop = "8px";
  dateOptionsBtn.textContent = appState.showUpdateDateOptions ? "Hide Options" : "Show Options";
  dateOptionsBtn.addEventListener("click", () => {
    appState.showUpdateDateOptions = !appState.showUpdateDateOptions;
    renderControls();
  });
  dateGrp.appendChild(dateOptionsBtn);

  if (appState.showUpdateDateOptions) {
    const workRow = document.createElement("div");
    workRow.className = "working-inline";
    const workBtn = document.createElement("button");
    workBtn.type = "button";
    workBtn.className = "working-btn" + (appState.workingMode ? " active" : "");
    workBtn.textContent = appState.workingMode ? "✓ Working mode" : "Working";
    workBtn.addEventListener("click", () => {
      appState.workingMode = !appState.workingMode;
      if (appState.workingMode) {
        // keep only greeting/reference/forwarded/updateDate ON
        s.greeting = true;
        s.reference = true;
        s.forwarded = true;
        s.updateDate = true;
        s.documents = false;
        s.tat = false;
        s.charges = false;
        s.originalCopy = false;
      }
      renderControls();
      updatePreview();
    });
    workRow.appendChild(workBtn);

    if (appState.workingMode) {
      const chipSel = document.createElement("div");
      chipSel.className = "chip-select";
      chipSel.style.marginTop = "6px";
      for (let i = 1; i <= 10; i++) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "chip-opt" + (appState.workingDays === i ? " active" : "");
        c.textContent = i;
        c.addEventListener("click", () => {
          appState.workingDays = i;
          renderControls();
          updatePreview();
        });
        chipSel.appendChild(c);
      }
      const lbl = document.createElement("div");
      lbl.className = "ctrl-label";
      lbl.style.marginTop = "10px";
      lbl.textContent = "Working days";
      dateGrp.appendChild(lbl);
      dateGrp.appendChild(chipSel);
    } else {
      const lbl = document.createElement("div");
      lbl.className = "ctrl-label";
      lbl.style.marginTop = "10px";
      lbl.textContent = "Days from today";
      const chipSel = document.createElement("div");
      chipSel.className = "chip-select";
      [5, 7, 10, 14, 21].forEach(n => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "chip-opt" + (appState.updateDateOffset === n ? " active" : "");
        c.textContent = "+" + n;
        c.addEventListener("click", () => {
          appState.updateDateOffset = n;
          renderControls();
          updatePreview();
        });
        chipSel.appendChild(c);
      });
      dateGrp.appendChild(lbl);
      dateGrp.appendChild(chipSel);
    }

    dateGrp.appendChild(workRow);
  }
  host.appendChild(dateGrp);

  if (!appState.workingMode) {
    /* TAT */
    const tatGrp = createGroup("TAT");
    tatGrp.appendChild(createToggleRow("Include TAT Line", "Turnaround time statement", s.tat, val => { s.tat = val; updatePreview(); }));
    if (s.tat) {
      const tatOptionsBtn = document.createElement("button");
      tatOptionsBtn.type = "button";
      tatOptionsBtn.className = "working-btn";
      tatOptionsBtn.style.marginTop = "8px";
      tatOptionsBtn.textContent = appState.showTatOptions ? "Hide Options" : "Show Options";
      tatOptionsBtn.addEventListener("click", () => {
        appState.showTatOptions = !appState.showTatOptions;
        renderControls();
      });
      tatGrp.appendChild(tatOptionsBtn);

      if (appState.showTatOptions) {
        const chipSel = document.createElement("div");
        chipSel.className = "chip-select";
        chipSel.style.marginTop = "8px";
        [5, 7, 10].forEach(n => {
          const c = document.createElement("button");
          c.type = "button";
          c.className = "chip-opt" + (appState.tatDays === n ? " active" : "");
          c.textContent = n + " days";
          c.addEventListener("click", () => {
            appState.tatDays = n;
            renderControls();
            updatePreview();
          });
          chipSel.appendChild(c);
        });
        tatGrp.appendChild(chipSel);
      }
    }
    host.appendChild(tatGrp);

    /* Extras */
    const extrasGrp = createGroup("Extras");
    extrasGrp.appendChild(createToggleRow("Charges / Inspection", "Possible charges & inspection note", s.charges, val => { s.charges = val; updatePreview(); }));
    extrasGrp.appendChild(createToggleRow("Original + Endorsed Copy", "Keep both copies note", s.originalCopy, val => { s.originalCopy = val; updatePreview(); }));
    host.appendChild(extrasGrp);
  }

  // Wire up docs
  if (s.documents) {
    const input = document.getElementById("docInput");
    const btn = document.getElementById("docAddBtn");
    const chips = document.getElementById("docChips");
    if (input && btn && chips) {
      const doAdd = () => {
        const val = input.value.trim();
        if (!val) return;
        const norm = normalizeDocument(val);
        if (!appState.documents.includes(norm)) {
          appState.documents.push(norm);
        }
        input.value = "";
        renderDocChips(chips);
        updatePreview();
      };
      btn.addEventListener("click", doAdd);
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); doAdd(); }
      });
      renderDocChips(chips);
    }
  }
}

function renderDocChips(host) {
  host.innerHTML = "";
  appState.documents.forEach((d, idx) => {
    const chip = document.createElement("span");
    chip.className = "doc-chip";
    const txt = document.createElement("span");
    txt.textContent = d;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove " + d);
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      appState.documents.splice(idx, 1);
      renderDocChips(host);
      updatePreview();
    });
    chip.appendChild(txt);
    chip.appendChild(rm);
    host.appendChild(chip);
  });
}

/* ---------- SF Controls ---------- */
function renderSFControls(host) {
  const grp = createGroup("Payment Details");

  const amtLbl = document.createElement("label");
  amtLbl.className = "ctrl-label";
  amtLbl.textContent = "Shortfall Amount";
  const amtInput = document.createElement("input");
  amtInput.type = "text";
  amtInput.className = "text-input";
  amtInput.placeholder = "e.g. 5000 or ₹5000 or Rs. 5000/-";
  amtInput.value = appState.fieldValues.amount || "";
  amtInput.addEventListener("input", () => {
    appState.fieldValues.amount = amtInput.value;
    updatePreview();
  });
  grp.appendChild(amtLbl);
  grp.appendChild(amtInput);

  const linkLbl = document.createElement("label");
  linkLbl.className = "ctrl-label";
  linkLbl.style.marginTop = "10px";
  linkLbl.textContent = "Payment Link";
  const linkInput = document.createElement("input");
  linkInput.type = "text";
  linkInput.className = "text-input";
  linkInput.placeholder = "Paste payment link";
  linkInput.value = appState.fieldValues.link || "";
  linkInput.addEventListener("input", () => {
    appState.fieldValues.link = linkInput.value;
    updatePreview();
  });
  grp.appendChild(linkLbl);
  grp.appendChild(linkInput);

  host.appendChild(grp);
}

/* ---------- REFUND Controls ---------- */
function renderRefundControls(host) {
  const grp = createGroup("Refund Details");

  const amtLbl = document.createElement("label");
  amtLbl.className = "ctrl-label";
  amtLbl.textContent = "Refund Amount";
  const amtInput = document.createElement("input");
  amtInput.type = "text";
  amtInput.className = "text-input";
  amtInput.placeholder = "e.g. 5000 or Rs 5000";
  amtInput.value = appState.fieldValues.amount || "";
  amtInput.addEventListener("input", () => {
    appState.fieldValues.amount = amtInput.value;
    updatePreview();
  });
  grp.appendChild(amtLbl);
  grp.appendChild(amtInput);

  const dayLbl = document.createElement("label");
  dayLbl.className = "ctrl-label";
  dayLbl.style.marginTop = "10px";
  dayLbl.textContent = "Working Days";
  const chipSel = document.createElement("div");
  chipSel.className = "chip-select";
  for (let i = 1; i <= 10; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip-opt" + (appState.workingDays === i ? " active" : "");
    c.textContent = i;
    c.addEventListener("click", () => {
      appState.workingDays = i;
      renderControls();
      updatePreview();
    });
    chipSel.appendChild(c);
  }
  grp.appendChild(dayLbl);
  grp.appendChild(chipSel);

  host.appendChild(grp);
}

/* ---------- BAJAJ OT Controls ---------- */
function renderInsuredPersonChangeControls(host) {
  const grp = createGroup("Required Documents");
  grp.appendChild(createToggleRow(
    "RC",
    "Include vehicle RC (Registration Certificate)",
    appState.sectionSelections.rc,
    val => { appState.sectionSelections.rc = val; updatePreview(); }
  ));
  grp.appendChild(createToggleRow(
    "PF Form",
    "Include attached form for new insured person details",
    appState.sectionSelections.pf,
    val => { appState.sectionSelections.pf = val; updatePreview(); }
  ));
  host.appendChild(grp);
}
/* ---------- CANCELLATION Controls ---------- */
function renderCancellationControls(host) {
  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Alternate Policy Line",
    "Ask customer to share alternate policy & reason",
    appState.sectionSelections.alternate,
    val => { appState.sectionSelections.alternate = val; updatePreview(); }
  ));
  host.appendChild(grp);
}

/* ---------- VAHAN UPDATED Controls ---------- */
function renderVahanUpdatedControls(host) {
  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Attach Screenshot Line",
    "Include: Please find attached the M-Parivahan screenshot",
    appState.sectionSelections.screenshot,
    val => { appState.sectionSelections.screenshot = val; updatePreview(); }
  ));
  host.appendChild(grp);
}

/* ---------- RENEWAL Controls ---------- */
function renderRenewalControls(host) {
  const grp = createGroup("Renewal Sections");
  grp.appendChild(createToggleRow(
    "Two-Wheeler Renewal",
    "Include 2W renewal numbers",
    appState.sectionSelections.twoW,
    val => { appState.sectionSelections.twoW = val; updatePreview(); }
  ));
  grp.appendChild(createToggleRow(
    "Four-Wheeler Renewal",
    "Include 4W renewal number",
    appState.sectionSelections.fourW,
    val => { appState.sectionSelections.fourW = val; updatePreview(); }
  ));
  host.appendChild(grp);
}

/* ---------- CLOSURE Controls ---------- */
function renderClosureControls(host) {
  const grp = createGroup("Manual Note");
  if (!appState.manualTextVisible) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-manual-btn";
    btn.textContent = "+ Add Manual Text";
    btn.addEventListener("click", () => {
      appState.manualTextVisible = true;
      renderControls();
    });
    grp.appendChild(btn);
  } else {
    const lbl = document.createElement("label");
    lbl.className = "ctrl-label";
    lbl.textContent = "Additional Information";
    const ta = document.createElement("textarea");
    ta.className = "text-area";
    ta.placeholder = "Add additional information...";
    ta.value = appState.manualText;
    ta.rows = 4;
    ta.addEventListener("input", () => {
      appState.manualText = ta.value;
      updatePreview();
    });
    grp.appendChild(lbl);
    grp.appendChild(ta);

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "link-btn";
    rm.style.marginTop = "6px";
    rm.textContent = "Remove manual text";
    rm.addEventListener("click", () => {
      appState.manualTextVisible = false;
      appState.manualText = "";
      renderControls();
      updatePreview();
    });
    grp.appendChild(rm);
  }
  host.appendChild(grp);
}

/* ---------- Helpers ---------- */
function createGroup(title) {
  const wrap = document.createElement("div");
  wrap.className = "control-group";
  const lbl = document.createElement("div");
  lbl.className = "ctrl-label";
  lbl.textContent = title;
  wrap.appendChild(lbl);
  return wrap;
}

function createToggleRow(label, desc, checked, onChange) {
  const row = document.createElement("div");
  row.className = "toggle-row";

  const left = document.createElement("div");
  left.style.flex = "1";
  const l = document.createElement("div");
  l.className = "toggle-label";
  l.textContent = label;
  const d = document.createElement("div");
  d.className = "toggle-desc";
  d.textContent = desc || "";
  left.appendChild(l);
  if (desc) left.appendChild(d);

  const sw = document.createElement("label");
  sw.className = "switch";
  const inp = document.createElement("input");
  inp.type = "checkbox";
  inp.checked = !!checked;
  inp.addEventListener("change", () => onChange(inp.checked));
  const slider = document.createElement("span");
  slider.className = "slider";
  sw.appendChild(inp);
  sw.appendChild(slider);

  row.appendChild(left);
  row.appendChild(sw);
  return row;
}

/* =========================================================
   PREVIEW RENDERING (safe textContent)
   ========================================================= */
function updatePreview() {
  // If user is currently editing preview, don't overwrite
  if (appState.previewEditing) return;
  const card = document.getElementById("previewCard");
  const text = buildPreview();
  card.textContent = text;

  const copyBtn = document.getElementById("copyBtn");
  copyBtn.disabled = !text.trim();
}

/* =========================================================
   TEMPLATE SELECTION
   ========================================================= */
function selectTemplate(id) {
  const tpl = mailTemplates.find(t => t.id === id);
  if (!tpl) return;

  appState.activeTemplateId = id;
  appState.fieldValues = {};
  appState.documents = [];
  appState.manualText = "";
  appState.manualTextVisible = false;
  appState.manualPreviewOverride = null;
  appState.previewEditing = false;
  appState.workingMode = false;
  appState.showUpdateDateOptions = false;
  appState.showTatOptions = false;
  appState.updateDateOffset = 10;
  appState.tatDays = 10;

  // Init section selections
  if (tpl.id === "rf") {
    appState.sectionSelections = {
      greeting: true, reference: true, forwarded: true,
      documents: false, updateDate: true, tat: true,
      charges: true, originalCopy: true
    };
  } else if (tpl.defaultSelections) {
    appState.sectionSelections = { ...tpl.defaultSelections };
    if (tpl.id === "refund_done") {
      appState.workingDays = tpl.defaultSelections.workingDays || 7;
    }
  } else {
    appState.sectionSelections = {};
  }

  // Close search dropdown
  document.getElementById("resultsDropdown").classList.remove("visible");
  document.getElementById("searchInput").value = "";
  document.getElementById("clearSearchBtn").style.display = "none";

  // Turn off contenteditable
  const card = document.getElementById("previewCard");
  card.setAttribute("contenteditable", "false");

  renderControls();
  updatePreview();
}

/* =========================================================
   SEARCH DROPDOWN
   ========================================================= */
function showResults(query) {
  const dd = document.getElementById("resultsDropdown");
  const q = query.trim();
  if (!q) {
    dd.classList.remove("visible");
    dd.innerHTML = "";
    return;
  }
  const results = searchTemplates(q);
  dd.innerHTML = "";
  if (results.length === 0) {
    const nr = document.createElement("div");
    nr.className = "no-results";
    nr.textContent = "No matching templates found.";
    dd.appendChild(nr);
  } else {
    results.forEach((tpl, idx) => {
      const card = document.createElement("div");
      card.className = "result-card";
      card.setAttribute("role", "option");
      card.dataset.tplId = tpl.id;
      if (idx === 0) card.classList.add("highlighted");
      const h = document.createElement("div");
      h.className = "result-header";
      h.textContent = tpl.header;
      const d = document.createElement("div");
      d.className = "result-desc";
      d.textContent = tpl.description;
      card.appendChild(h);
      card.appendChild(d);
      card.addEventListener("click", () => selectTemplate(tpl.id));
      dd.appendChild(card);
    });
  }
  dd.classList.add("visible");
}

/* =========================================================
   COPY LOGIC
   ========================================================= */
async function copyMail() {
  const card = document.getElementById("previewCard");
  // If user edited preview, use its textContent
  let text = card.textContent || "";
  text = text.replace(/\r\n/g, "\n").trim();
  if (!text) return;

  let success = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      success = true;
    } else {
      success = fallbackCopy(text);
    }
  } catch (e) {
    success = fallbackCopy(text);
  }

  const btn = document.getElementById("copyBtn");
  if (success) {
    btn.classList.add("copied");
    btn.textContent = "Copied ✓";
    showToast("Mail copied to clipboard", "success");
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "Copy Mail";
    }, 1500);
  } else {
    showToast("Unable to copy. Please select & copy manually.", "error");
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

/* =========================================================
   RESET
   ========================================================= */
function resetTemplate() {
  const id = appState.activeTemplateId;
  if (!id) {
    showToast("No template selected", "error");
    return;
  }
  selectTemplate(id);
  showToast("Template reset", "success");
}

/* =========================================================
   HIDE / RESTORE / CLOSE / PIP
   ========================================================= */
function getAppShell() {
  return document.getElementById("appShell") ||
    (pipWindow && !pipWindow.closed ? pipWindow.document.getElementById("appShell") : null);
}

function getMiniWidget() {
  return document.getElementById("miniWidget");
}

function resetShellToFullView(shell) {
  if (!shell) return;
  appState.isFloating = false;
  shell.classList.remove("floating");
  shell.style.top = "";
  shell.style.left = "";
  shell.style.right = "";
  shell.style.width = "";
  shell.style.height = "";
}

function hideToMini() {
  const shell = getAppShell();
  const mini = getMiniWidget();
  if (!shell || !mini) return;
  shell.style.display = "none";
  mini.style.display = "flex";
  // Restore last mini position
  if (appState.miniPos) {
    mini.style.top = appState.miniPos.y + "px";
    mini.style.left = appState.miniPos.x + "px";
    mini.style.right = "auto";
  }
  // Close PiP if active
  if (appState.isPiPActive) closePiP();
}

function restoreFromMini() {
  const shell = getAppShell();
  const mini = getMiniWidget();
  if (!shell || !mini) return;
  resetShellToFullView(shell);
  shell.style.display = "";
  mini.style.display = "none";
}

function closeApp() {
  const shell = getAppShell();
  const mini = getMiniWidget();
  const launcher = document.getElementById("reopenLauncher");
  if (!shell || !mini || !launcher) return;
  shell.style.display = "none";
  mini.style.display = "none";
  launcher.style.display = "flex";
  if (appState.isPiPActive) closePiP();
}

function reopenApp() {
  const shell = getAppShell();
  const launcher = document.getElementById("reopenLauncher");
  if (!shell || !launcher) return;
  resetShellToFullView(shell);
  shell.style.display = "";
  launcher.style.display = "none";
}

/* ---------- DOCUMENT PIP ---------- */
let pipWindow = null;
async function togglePiP() {
  if (appState.isPiPActive) { closePiP(); return; }

  if (!("documentPictureInPicture" in window)) {
    // Fallback: floating mode
    toggleFloating();
    showToast("PiP not supported — using floating fallback", "success");
    return;
  }

  try {
    const shell = document.getElementById("appShell");
    const rect = shell.getBoundingClientRect();
    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: Math.min(900, Math.round(rect.width) || 900),
      height: Math.min(640, Math.round(rect.height) || 640)
    });

    // Copy stylesheets
    [...document.styleSheets].forEach(sheet => {
      try {
        const style = document.createElement("style");
        style.textContent = [...sheet.cssRules].map(r => r.cssText).join("\n");
        pipWindow.document.head.appendChild(style);
      } catch (e) {
        // Cross-origin sheets — link them
        if (sheet.href) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          pipWindow.document.head.appendChild(link);
        }
      }
    });

    pipWindow.document.body.classList.add("pip-mode");
    // Move shell into PiP
    pipWindow.document.body.appendChild(shell);
    appState.isPiPActive = true;

    pipWindow.addEventListener("pagehide", () => {
      // Move back
      document.body.appendChild(shell);
      pipWindow = null;
      appState.isPiPActive = false;
    });
  } catch (e) {
    showToast("Could not open PiP — using floating mode", "error");
    toggleFloating();
  }
}

function closePiP() {
  if (pipWindow && !pipWindow.closed) {
    try { pipWindow.close(); } catch (e) {}
  }
}

/* ---------- Floating fallback ---------- */
function toggleFloating() {
  const shell = document.getElementById("appShell");
  appState.isFloating = !appState.isFloating;
  shell.classList.toggle("floating", appState.isFloating);
  if (appState.isFloating) {
    enableShellDrag();
  }
}

let shellDragBound = false;
function enableShellDrag() {
  if (shellDragBound) return;
  shellDragBound = true;
  const shell = document.getElementById("appShell");
  const header = document.getElementById("appHeader");
  let dragging = false, offX = 0, offY = 0;

  header.addEventListener("pointerdown", e => {
    if (!appState.isFloating) return;
    // Ignore drags on action buttons
    if (e.target.closest(".header-actions")) return;
    dragging = true;
    const rect = shell.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    header.setPointerCapture(e.pointerId);
  });
  header.addEventListener("pointermove", e => {
    if (!dragging) return;
    let x = e.clientX - offX;
    let y = e.clientY - offY;
    const rect = shell.getBoundingClientRect();
    x = Math.max(0, Math.min(window.innerWidth - rect.width, x));
    y = Math.max(0, Math.min(window.innerHeight - 40, y));
    shell.style.left = x + "px";
    shell.style.top = y + "px";
  });
  header.addEventListener("pointerup", e => {
    dragging = false;
    try { header.releasePointerCapture(e.pointerId); } catch (err) {}
  });
}

/* =========================================================
   MINI WIDGET DRAG
   ========================================================= */
function initMiniDrag() {
  const mini = document.getElementById("miniWidget");
  let dragging = false;
  let startX = 0, startY = 0, offX = 0, offY = 0;
  let moved = false;

  // Load last position
  try {
    const saved = sessionStorage.getItem("pbmh_mini_pos");
    if (saved) {
      const p = JSON.parse(saved);
      if (p && typeof p.x === "number") {
        appState.miniPos = p;
      }
    }
  } catch (e) {}

  mini.addEventListener("pointerdown", e => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = mini.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    mini.setPointerCapture(e.pointerId);
    mini.classList.add("dragging");
  });

  mini.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    let x = e.clientX - offX;
    let y = e.clientY - offY;
    const rect = mini.getBoundingClientRect();
    x = Math.max(4, Math.min(window.innerWidth - rect.width - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - rect.height - 4, y));
    mini.style.left = x + "px";
    mini.style.top = y + "px";
    mini.style.right = "auto";
    appState.miniPos = { x, y };
  });

  mini.addEventListener("pointerup", e => {
    dragging = false;
    mini.classList.remove("dragging");
    try { mini.releasePointerCapture(e.pointerId); } catch (err) {}
    if (appState.miniPos) {
      try { sessionStorage.setItem("pbmh_mini_pos", JSON.stringify(appState.miniPos)); } catch (err) {}
    }
    if (!moved) restoreFromMini();
  });

  mini.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      restoreFromMini();
    }
  });
}

/* =========================================================
   TOAST
   ========================================================= */
let toastTimer = null;
function showToast(msg, kind) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + (kind || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = "toast";
  }, 2000);
}

/* =========================================================
   INITIALIZE
   ========================================================= */
function init() {
  // Search
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  searchInput.addEventListener("input", () => {
    appState.searchQuery = searchInput.value;
    clearBtn.style.display = searchInput.value ? "" : "none";
    showResults(searchInput.value);
  });
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) showResults(searchInput.value);
  });
  searchInput.addEventListener("keydown", e => {
    const dd = document.getElementById("resultsDropdown");
    const cards = [...dd.querySelectorAll(".result-card")];
    const highlighted = dd.querySelector(".result-card.highlighted");
    let idx = cards.indexOf(highlighted);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cards.length === 0) return;
      idx = (idx + 1) % cards.length;
      cards.forEach(c => c.classList.remove("highlighted"));
      cards[idx].classList.add("highlighted");
      cards[idx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cards.length === 0) return;
      idx = idx <= 0 ? cards.length - 1 : idx - 1;
      cards.forEach(c => c.classList.remove("highlighted"));
      cards[idx].classList.add("highlighted");
      cards[idx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (highlighted) {
        e.preventDefault();
        selectTemplate(highlighted.dataset.tplId);
      }
    } else if (e.key === "Escape") {
      dd.classList.remove("visible");
      searchInput.blur();
    }
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    document.getElementById("resultsDropdown").classList.remove("visible");
    searchInput.focus();
  });

  // Close dropdown on outside click
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-section")) {
      document.getElementById("resultsDropdown").classList.remove("visible");
    }
  });

  // Header buttons
  document.getElementById("pipBtn").addEventListener("click", togglePiP);
  document.getElementById("hideBtn").addEventListener("click", hideToMini);
  document.getElementById("closeBtn").addEventListener("click", closeApp);

  // Change template
  document.getElementById("changeTplBtn").addEventListener("click", () => {
    appState.activeTemplateId = null;
    document.getElementById("previewCard").textContent = "";
    document.getElementById("copyBtn").disabled = true;
    document.getElementById("searchInput").focus();
    renderControls();
  });

  // Footer buttons
  document.getElementById("resetBtn").addEventListener("click", resetTemplate);
  document.getElementById("copyBtn").addEventListener("click", copyMail);

  // Preview editing
  const card = document.getElementById("previewCard");
  card.addEventListener("dblclick", () => {
    if (!appState.activeTemplateId) return;
    card.setAttribute("contenteditable", "true");
    appState.previewEditing = true;
    card.focus();
    showToast("Editing enabled — click outside to save", "success");
  });
  card.addEventListener("blur", () => {
    if (appState.previewEditing) {
      appState.previewEditing = false;
      card.setAttribute("contenteditable", "false");
      appState.manualPreviewOverride = card.textContent;
    }
  });

  // Mini widget
  document.getElementById("miniWidget").addEventListener("click", e => {
    // handled by pointerdown/up
  });
  initMiniDrag();

  // Reopen launcher
  document.getElementById("reopenLauncher").addEventListener("click", reopenApp);
  document.getElementById("reopenLauncher").addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reopenApp(); }
  });

  // Keyboard: Ctrl+F focuses search
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      const shell = document.getElementById("appShell");
      if (shell.style.display !== "none") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
    if (e.key === "Escape") {
      const dd = document.getElementById("resultsDropdown");
      if (dd.classList.contains("visible")) dd.classList.remove("visible");
    }
  });

  // Initial render
  renderControls();
  updatePreview();
  document.getElementById("copyBtn").disabled = true;
}

document.addEventListener("DOMContentLoaded", init);
