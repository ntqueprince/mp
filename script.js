/* =========================================================
   PB MAIL HELPER PRO � script.js
   Vanilla JS. No frameworks.
   ========================================================= */

/* ---------- APP STATE ---------- */
const appState = {
  activeTemplateId: null,
  searchQuery: "",
  fieldValues: {},          // { fieldKey: value }
  sectionSelections: {},    // { sectionKey: boolean }
  documents: [],            // for RF template
  nameCorrectionDocs: [],   // for Ownership Transfer Name Correction
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
  extraNoteActive: false,       // toggle for appending extra note at bottom of any mail
  extraNoteText: "",            // text content for extra note
  miniPos: null,
  isFloating: false,
  isPiPActive: false
};

/* =========================================================
   DOCUMENT NAME NORMALIZATION MAP (for RF template)
   ========================================================= */
const DOC_MAP = [
  { keys: ["rc", "registration certificate"], out: "RC (REGISTRATION CERTIFICATE)" },
  { keys: ["aadhar", "aadhaar", "adhar", "aadhr", "adhaar", "aadhar card", "aadhaar card"], out: "AADHAAR CARD" },
  { keys: ["pan", "pan card"], out: "PAN CARD" },
  { keys: ["dl", "driving license", "driving licence"], out: "DRIVING LICENSE" },
  { keys: ["pyp", "previous year policy"], out: "PREVIOUS YEAR POLICY (PYP)" },
  { keys: ["cng", "cng invoice"], out: "CNG INVOICE" },
  { keys: ["noc"], out: "NOC" },
  { keys: ["fitness", "fitness certificate"], out: "FITNESS CERTIFICATE" },
  { keys: ["form35", "form 35"], out: "FORM 35" },
  { keys: ["pf", "proposal form", "prosal form", "proposal", "prosal"], out: "PROPOSAL FORM" },
  { keys: ["ncb", "ncb confirmation", "ncb letter", "ncb confirmation letter"], out: "NCB CONFIRMATION LETTER FROM PREVIOUS INSURER" },
  { keys: ["rto", "rto receipt", "rto receipt copy"], out: "RTO RECEIPT" },
  { keys: ["gst", "gst invoice", "gst bill", "gst i"], out: "GST INVOICE" },
  { keys: ["gst certificate", "gst cert", "gst copy", "insured gst", "gst c"], out: "GST CERTIFICATE IN THE NAME OF INSURED" },
  { keys: ["tp", "third party", "third party policy"], out: "THIRD PARTY POLICY" },
  { keys: ["saod", "od", "stand alone own damage", "stand alone own damage policy", "own damage policy"], out: "STAND ALONE OWN DAMAGE (SAOD) POLICY" },
  { keys: ["comp", "compre", "comprehensive", "comprehensive policy"], out: "COMPREHENSIVE POLICY" },
  { keys: ["bund", "bundle", "bundle policy"], out: "BUNDLE POLICY" },
  { keys: ["idv", "insured declared value"], out: "IDV (INSURED DECLARED VALUE)" },
  { keys: ["address", "address proof", "addr", "address proof copy"], out: "ADDRESS PROOF REFLECTING THE EXACT SAME ADDRESS TO BE UPDATED" },
  { keys: ["neft", "bank details", "bank detail", "cancelled cheque", "cheque", "passbook", "bank passbook", "neft details", "cancel"], out: "A CANCELLED CHEQUE OR BANK PASSBOOK OF THE INSURED PERSON AS PER POLICY" },
  { keys: ["zd", "zero dep", "zero depreciation"], out: "ZERO DEPRECIATION" },
  { keys: ["alt", "alt policy", "alternate", "alternate policy", "alternative policy"], out: "ALTERNATE POLICY FOR SAME VEHICLE" },
  { keys: ["mmv", "mv", "make model variant", "model variant", "make model"], out: "MAKE, MODEL & VARIANT DETAILS" }
];

function normalizeDocument(raw) {
  if (!raw) return "";
  const original = raw.trim();
  const lowerRaw = original.toLowerCase();

  // If contains " or " or "/" or " / " or " and "
  if (lowerRaw.includes(" or ") || lowerRaw.includes("/") || lowerRaw.includes(" and ")) {
    const parts = original.split(/\s+or\s+|\s*\/\s*|\s+and\s+/i);
    const normalizedParts = parts.map(part => normalizeSingleDocument(part));
    return normalizedParts.filter(p => p).join(" OR ");
  }

  return normalizeSingleDocument(original);
}

function normalizeSingleDocument(raw) {
  if (!raw) return "";
  const original = raw.trim();
  const key = original.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  for (const item of DOC_MAP) {
    if (item.keys.includes(key)) return item.out;
  }

  for (const item of DOC_MAP) {
    for (const docKey of item.keys) {
      const normalizedDocKey = docKey.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      if (!normalizedDocKey) continue;
      const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedDocKey)}(\\s|$)`);
      if (pattern.test(key)) return key.replace(pattern, `$1${item.out}$2`).replace(/\s+/g, " ").trim().toUpperCase();
    }
  }

  return original.toUpperCase();
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/* =========================================================
   INDIAN NUMBER FORMATTING
   ========================================================= */
function cleanAmount(raw) {
  if (raw === null || raw === undefined) return "";
  // Remove Rs, /-, commas, spaces
  let s = String(raw).replace(/rs\.?/ig, "").replace(/\/-/g, "").replace(/,/g, "").trim();
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
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
  /* ---------- BLANK MAIL ---------- */
  {
    id: "blank_mail",
    header: "BLANK MAIL",
    description: "Compose custom mail with default greeting and reference",
    keywords: ["blank", "custom", "manual", "write", "empty", "compose", "blank mail"],
    type: "dynamic"
  },
  /* ---------- DOCS ONLY ---------- */
  {
    id: "docs_only",
    header: "DOCS ONLY",
    description: "Request documents only with optional custom details",
    keywords: ["docs only", "document only", "pending documents", "docs", "request docs"],
    type: "hybrid",
    defaultSelections: {
      greeting: true,
      reference: true,
      docRequestHeader: true,
      detailsSection: false
    }
  },
  /* ---------- GATEPASS / NATIONAL CANCELLATION ---------- */
  {
    id: "gatepass_national_cancellation",
    header: "GATEPASS / NATIONAL CANCELLATION",
    description: "New vehicle cancellation deductions & gate pass rules builder",
    keywords: ["gatepass", "national cancellation", "gate pass", "deduction", "old policy date", "national", "cancellation", "alternative policy"],
    type: "selectable",
    defaultSelections: {
      dateType: "same",
      gatepassStatus: "not_provided"
    }
  },
  /* ---------- DOCS REQUIRED ---------- */
  {
    id: "docs_required",
    header: "DOCS REQUIRED",
    description: "Request specific documents from customer",
    keywords: ["docs required", "document request", "documents required", "pending documents", "docs", "request documents"],
    type: "hybrid",
    defaultSelections: {
      tat: true,
      charges: true,
      originalCopy: true
    }
  },
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
      forwarded: false,
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
      "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
    ].join("\n")
  },

  /* ---------- NCB CONFIRMATION RECEIVED ---------- */
  {
    id: "ncb_received",
    header: "NCB CONFIRMATION LETTER",
    description: "Share received No Claim Bonus (NCB) confirmation letter",
    keywords: ["ncb received", "ncb confirmation", "ncb letter", "ncb confirmation letter", "ncb letter received", "no claim bonus"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is in reference to your request.",
      "",
      "Please find attached the No Claim Bonus (NCB) confirmation letter, as requested."
    ].join("\n")
  },

  /* ---------- GST ADDITION NOT POSSIBLE ---------- */
  {
    id: "gst_not_possible",
    header: "GST ADDITION NOT POSSIBLE",
    description: "Informing customer that GST addition/update is not allowed by the insurer post policy issuance",
    keywords: ["gst addition not possible", "gst", "gst update", "gst addition", "gst details", "not possible", "gst mismatch"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request regarding the addition of GST details to your active insurance policy.",
      "",
      "We forwarded your request to the insurance provider for processing. However, the insurer has informed us that as per their guidelines, they do not allow the addition or endorsement of GST details once the policy has been generated and issued. Since this constraint is enforced directly by the insurer, we are unable to make any changes to the tax invoice at this stage.",
      "",
      "We sincerely regret the inconvenience this may cause and appreciate your understanding and cooperation."
    ].join("\n")
  },

  /* ---------- INSURER PORTAL UPDATED ---------- */
  {
    id: "insurer_portal_updated",
    header: "INSURER PORTAL UPDATED",
    description: "Informing customer that their policy is successfully updated on the insurer portal",
    keywords: ["insurer portal updated", "portal update", "insurer portal", "portal", "update check", "updated"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We are pleased to inform you that your policy has been successfully updated on the insurer's official portal.",
      "",
      "We request you to kindly check the portal to verify the updated status of your policy."
    ].join("\n")
  },

  /* ---------- 3. SF PAYMENT ---------- */
  {
    id: "sf_payment",
    header: "SF PAYMENT",
    description: "Premium shortfall payment link mail",
    keywords: ["sf mail", "sf link", "shortfall", "short fall", "premium shortfall", "payment shortfall", "sf", "idv", "idv confirmation", "new idv"],
    type: "selectable",
    defaultSelections: { confirmIdv: false }
  },

  /* ---------- 4. REFUND DONE ---------- */
  {
    id: "refund_done",
    header: "REFUND DONE",
    description: "Refund processed successfully",
    keywords: ["refund done", "refund successful", "refund sucessful", "refund completed", "refund processed", "refund success", "refund"],
    type: "hybrid",
    defaultSelections: { workingDays: 7, neftRefund: false },
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
    type: "selectable",
    defaultSelections: { reinspection: false, rcNote: false }
  },
  /* ---------- 5. 4W VIDEO INSPECTION ---------- */
  {
    id: "video_inspection",
    header: "4W VIDEO INSPECTION",
    description: "Four-wheeler self-video inspection instructions",
    keywords: ["video", "inspection", "4w video", "video inspection", "inspection video", "4w inspection", "car inspection", "self video", "vehicle video"],
    type: "selectable",
    defaultSelections: { reinspection: false }
  },

  /* ---------- 6. CANCELLATION ---------- */
  {
    id: "cancellation",
    header: "CANCELLATION",
    description: "Post-issuance policy cancellation process",
    keywords: ["cancellation", "cancel", "post issuance cancel", "post issuance cancellation", "post issunce cancel", "post issunce cancellation", "118", "alt policy", "alternate policy", "alternative policy", "alternative", "neft", "refund details", "bank details", "written consent", "cancelled cheque", "bank passbook", "package policy", "documents", "docs", "rc", "pyp", "aadhar", "pan", "dl", "noc", "cng"],
    type: "selectable",
    defaultSelections: { irdaiNote: false, consent: false, alternate: true, alternateMayBe: false, neft: false, documents: false }
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

  /* ---------- POLICY START PENDING ---------- */
  {
    id: "policy_start_pending",
    header: "POLICY START PENDING",
    description: "Endorsement request can be raised after policy start date",
    keywords: ["policy start", "policy not started", "start date", "before policy start", "endorsement after start", "endorsement not allowed", "request after start", "policy start pending", "endorsement pending", "insurer not allow"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that your endorsement request cannot be processed before the policy start date, as the insurance company allows such endorsement requests only after the policy has started.",
      "",
      "We request you to kindly raise the endorsement request once the policy is active.",
      "",
      "We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to 10 days.",
      "",
      "We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.",
      "",
      "If any documents are applicable, we will update you accordingly.",
      "",
      "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
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
      "We request you to kindly share the suitable timing to connect with you on your pending concern. Alternatively, you can also reach us at 1800-258-5970."
    ].join("\n")
  },
  /* ---------- 8. COMPLETE MISMATCH ---------- */
  {
    id: "complete_mismatch",
    header: "COMPLETE MISMATCH",
    description: "Registration, chassis and engine details all mismatched",
    keywords: ["complete mismatch", "complete miss match", "total mismatch", "total miss match", "mismatch", "missmatch", "miss match", "all details mismatch", "details mismatch", "reg chassis engine mismatch", "complete details mismatch", "multiple mismatch", "multiple miss match"],
    type: "selectable",
    defaultSelections: { includeCancellation: true }
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
      "We would like to inform you that the policy update on the M-Parivahan/VAHAN portal may take up to 7 working days from the policy start date. Please note that the processing time is calculated from the policy start date and not from the purchase date.",
      "",
      "Meanwhile, post the policy start date, you may use the soft copy (PDF) of your insurance policy as valid proof of insurance, if required by any concerned authority.",
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
  /* ---------- NOMINEE NOT REQUIRED ---------- */
  {
    id: "nominee_not_required",
    header: "NOMINEE NOT REQUIRED",
    description: "Nominee details not required when no Stand-Alone PA policy is applicable",
    keywords: ["nominee not required", "pa not required", "no pa", "pa nominee not required", "standalone pa not available", "stand alone pa not available", "pa not applicable", "nominee details not required", "nominee not applicable"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that there is no Stand-Alone Personal Accident (PA) policy applicable with your vehicle insurance policy.",
      "",
      "Therefore, nominee details are not required and do not impact the vehicle insurance policy.",
      "",
      "We appreciate your understanding in this regard."
    ].join("\n")
  },
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

  /* ---------- UNNAMED PASSENGER COVER ---------- */
  {
    id: "unnamed_passenger_cover",
    header: "UNNAMED PASSENGER COVER",
    description: "Ask customer to confirm PA cover option for unnamed passengers",
    keywords: ["unnamed passenger cover", "unnamed passenger", "pa unnamed", "pa cover unnamed", "passenger cover", "pa passenger", "sum insured passenger", "50", "100"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "We have received your request for making changes in your policy.",
      "",
      "We request you to kindly confirm the PA cover for unnamed passengers that you wish to opt for:",
      "",
      "1. PA cover for unnamed passengers of Rs. 50/- (excluding GST) for a sum insured value of Rs. 1,00,000/-",
      "",
      "2. PA cover for unnamed passengers of Rs. 100/- (excluding GST) for a sum insured value of Rs. 2,00,000/-",
      "",
      "We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to 10 days.",
      "",
      "We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.",
      "",
      "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
    ].join("\n")
  },
  /* ---------- 15. 24HR TAT MAIL ---------- */
  {
    id: "tat_24hr",
    header: "24HR TAT MAIL",
    description: "Apology and status update TAT mail with 24 hours / working days options",
    keywords: ["24hr", "24 hr", "24 hours", "tat mail", "delay", "apology", "apologize", "status update", "working days", "2wd", "5wd", "2 working days", "5 working days"],
    type: "dynamic"
  },

  /* ---------- TAT ALREADY SHARED ---------- */
  {
    id: "tat_already_shared",
    header: "TAT ALREADY SHARED",
    description: "Status update mail for received requirements or expedited follow-up",
    keywords: ["tat already shared", "already shared", "earlier communication", "wait tat", "ongoing concern", "already raised", "request processing", "follow up", "followup", "tat wait", "docs received", "expedited", "priority"],
    type: "selectable",
    defaultSelections: {
      mailMode: "docs_received",
      docsReceived: true,
      expedited: false,
      waitTat: true,
      trackingAssurance: false
    }
  },
  /* ---------- CHANGES NOT POSSIBLE ---------- */
  {
    id: "change_not_possible",
    header: "CHANGES NOT POSSIBLE",
    description: "Informing customer that their requested endorsement (IDV, POI, Name, PYP active, Running Claim) cannot be processed",
    keywords: ["changes not possible", "not possible", "idv not possible", "poi not possible", "idv endorsement", "poi change", "rejected", "pyp active", "active pyp", "after expiry", "previous policy active", "pre start", "running claim", "active claim", "claim pending", "claim closure letter"],
    type: "selectable",
    defaultSelections: {
      pypActiveMode: false,
      idvNotPossible: true,
      reasonThirdParty: true,
      poiNotPossible: false,
      reasonPrevTP: false,
      reasonExpired: false
    }
  },
  /* ---------- 16. ADDRESS CHANGE ---------- */
  {
    id: "address_change",
    header: "ADDRESS CHANGE",
    description: "Request valid address proof for address update",
    keywords: ["address change", "address proof", "new address", "address update", "address correction", "address endorsement", "address modification"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request for an address change in your insurance policy.",
      "",
      "To process the requested endorsement, we kindly request you to share a valid address proof reflecting the exact same address that needs to be updated in the policy.",
      "",
      "Once we receive the correct document matching the requested new address, we will proceed further with your update request.",
      "",
      "We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to 10 days.",
      "",
      "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
    ].join("\n")
  },

  /* ---------- AS PER RC NO CORRECTION ---------- */
  {
    id: "as_per_rc_no_correction",
    header: "AS PER RC NO CORRECTION",
    description: "Details are already correct as per RC/details available",
    keywords: ["as per rc", "no correction", "already correct", "name correction", "details correct", "updated rc", "supporting documents", "rc correct", "correction not required"],
    type: "selectable",
    defaultSelections: { updatedDocs: false }
  },
  /* ---------- 17. OWNERSHIP TRANSFER ---------- */
  {
    id: "ownership_transfer",
    header: "OWNERSHIP TRANSFER",
    description: "Request documents and new owner details for ownership transfer",
    keywords: ["ownership transfer", "owner transfer", "transfer ownership", "name transfer", "new owner", "ownership", "rc holder", "name correction", "pyp rc holder", "transfer request", "OT", "ot"],
    type: "dynamic"
  },
  /* ---------- 17. REQUEST CLOSURE ---------- */
  {
    id: "request_closure",
    header: "REQUEST CLOSURE",
    description: "Close request after telephonic conversation",
    keywords: ["close request", "request close", "closing request", "closure", "close ticket", "ticket close", "call discussion", "telephonic conversation", "as discussed", "case close", "request closure"],
    type: "dynamic"
  },
  /* ---------- DUPLICATE MAIL ---------- */
  {
    id: "duplicate_mail",
    header: "DUPLICATE MAIL",
    description: "Close request due to duplication under active request",
    keywords: ["duplicate mail", "duplicate request", "duplicate", "already included", "active request", "duplicate processing", "close duplicate", "request close"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that the concern raised through this request is already included in an existing active request and is currently under process.",
      "",
      "To ensure efficient handling and avoid duplicate processing, all related concerns will be addressed under the existing active request.",
      "",
      "Accordingly, this request is being closed, and the existing active request will continue to be processed until all applicable concerns are resolved.",
      "",
      "We appreciate your patience and understanding."
    ].join("\n")
  },
  /* ---------- BANK STATEMENT ---------- */
  {
    id: "bank_statement",
    header: "BANK STATEMENT",
    description: "Request bank/credit card statement for processed refund confirmation",
    keywords: ["bank statement", "statement", "credit card statement", "refund details", "refund not received", "refund reflection", "statement request", "refund pending", "insurer refund"],
    type: "selectable",
    defaultSelections: { useSharedAccount: false, tatType: "24-48hr" }
  },
  /* ---------- VAS VOUCHER ---------- */
  {
    id: "vas_voucher",
    header: "VAS VOUCHER",
    description: "Share Value Added Service (VAS) voucher and helpline details",
    keywords: ["vas", "value added service", "voucher", "vas voucher", "helpline", "vas number", "service voucher", "avail vas", "gift voucher"],
    type: "selectable",
    defaultSelections: {}
  },
  /* ---------- RUNNING CLAIM ---------- */
  {
    id: "running_claim",
    header: "RUNNING CLAIM",
    description: "Endorsement rejected due to an active running claim on policy",
    keywords: ["running claim", "active claim", "claim pending", "claim settlement", "claim closure letter", "endorsement claim", "claim settlement letter", "claim process"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request regarding the endorsement of your insurance policy.",
      "",
      "We would like to inform you that your request cannot be processed at this stage due to an active, ongoing claim on your policy. The insurance company can process endorsement requests only after the current claim is closed.",
      "",
      "We kindly request you to raise a fresh endorsement request once your claim is closed, along with a copy of the Claim Closure Letter (if applicable).",
      "",
      "We sincerely regret any inconvenience caused and appreciate your understanding in this regard."
    ].join("\n")
  },
  /* ---------- DND ACTIVATED ---------- */
  {
    id: "dnd_activated",
    header: "DND ACTIVATED",
    description: "Informing customer that DND service has been activated within 24 hours upon request for data deletion",
    keywords: ["dnd", "do not disturb", "data deletion", "delete data", "delete personal data", "erase data", "dnd activated", "dnd service"],
    type: "fixed",
    body: [
      "Greetings from Policybazaar.com!",
      "",
      "This is in reference to your request regarding the deletion of personal data.",
      "",
      "While we are unable to erase all personal data as it is necessary for our records, we have successfully initiated the Do Not Disturb (DND) service for your mobile number.",
      "",
      "The DND service will be activated within the next 24 hours."
    ].join("\n")
  },
  /* ---------- SBI OT ---------- */
  {
    id: "sbi_ot",
    header: "SBI OT",
    description: "SBI Ownership Transfer with PA Cover declaration and shortfall payment options",
    keywords: ["sbi ot", "sbi ownership transfer", "sbi", "pa declaration", "shortfall 50", "pa cover owner driver", "sbi shortfall"],
    type: "hybrid",
    defaultSelections: {
      paCoverSection: true,
      shortfallPayment: false,
      tat: true,
      charges: true,
      inspection: true,
      originalCopy: true
    }
  },
  /* ---------- BAJAJ ZERO DEP ---------- */
  {
    id: "bajaj_zero_dep",
    header: "BAJAJ ZERO DEP",
    description: "Zero Depreciation cover mentioned as Eco Assure - Repair Protection",
    keywords: ["bajaj zero dep", "zd included", "zd", "zero depreciation", "zero dep", "eco assure", "eco repair", "repair protection", "bajaj repair", "preferred repair workshop", "preferred workshop", "zd query", "claim assistance", "service assistance"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      "We would like to inform you that Zero Depreciation cover is included in your policy and is mentioned as \"Eco Assure - Repair Protection\".",
      "",
      "Please note that the Eco Repair cover is applicable only at Bajaj General Preferred Repair Workshops.",
      "",
      "For any further service-related assistance, you may contact our service team at 1800-258-5970 or write to us at CARE@POLICYBAZAAR.COM.",
      "",
      "For any claim-related assistance, you may contact our claims department at Spotclaims@policybazaar.com or call our toll-free number 1800-258-5881."
    ].join("\n")
  },
  /* ---------- ZD VIDEO ---------- */
  {
    id: "zd_video",
    header: "ZD VIDEO",
    description: "Video inspection approved for validation",
    keywords: ["zd video", "zd video inspection", "zero dep video", "video approved", "inspection approved", "zd approved", "zero depreciation video"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your recent request.",
      "",
      "We are pleased to inform you that your video inspection has been successfully approved for validation."
    ].join("\n")
  },
  /* ---------- M PARIVAHAN MAIL ---------- */
  {
    id: "m_parivahan_mail",
    header: "M PARIVAHAN MAIL",
    description: "M-Parivahan / VAHAN policy update request builder with documents & TAT options",
    keywords: ["m parivahan mail", "mparivahan mail", "parivahan mail", "m parivahan", "vahan mail", "mparivahan", "parivahan update", "vahan update", "parivahan status", "tp parivahan"],
    type: "hybrid",
    defaultSelections: {
      greeting: true,
      reference: true,
      forwarded: false,
      documents: false,
      tat: true,
      showExactDate: true
    }
  },
  /* ---------- RSA REIMBURSEMENT ---------- */
  {
    id: "rsa_reimbursement",
    header: "RSA REIMBURSEMENT",
    description: "Roadside Assistance (RSA) reimbursement case escalation update mail",
    keywords: ["rsa reimbursement", "rsa", "roadside assistance", "reimbursement", "rsa claim", "rsa status", "roadside assistance reimbursement", "rsa escalation"],
    type: "fixed",
    body: [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request regarding your Roadside Assistance (RSA) reimbursement.",
      "",
      "We have escalated your case to the concerned department for review. Our team is actively processing it, and you will receive an update within the next 24 to 48 hours.",
      "",
      "We appreciate your patience while we work on resolving this for you."
    ].join("\n")
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

  let baseText = "";
  if (tpl.type === "fixed") {
    baseText = tpl.body;
  } else {
    switch (tpl.id) {
      case "blank_mail": baseText = buildBlankMail(); break;
      case "docs_only": baseText = buildDocsOnly(); break;
      case "gatepass_national_cancellation": baseText = buildGatepassNationalCancellation(); break;
      case "docs_required": baseText = buildDocsRequired(); break;
      case "rf": baseText = buildRF(); break;
      case "sf_payment": baseText = buildSF(); break;
      case "refund_done": baseText = buildRefund(); break;
      case "cancellation": baseText = buildCancellation(); break;
      case "insured_person_change": baseText = buildInsuredPersonChange(); break;
      case "vahan_updated": baseText = buildVahanUpdated(); break;
      case "renewal_contact": baseText = buildRenewal(); break;
      case "tat_24hr": baseText = buildTat24Hr(); break;
      case "tat_already_shared": baseText = buildTatAlreadyShared(); break;
      case "ownership_transfer": baseText = buildOwnershipTransfer(); break;
      case "video_inspection": baseText = buildVideoInspection(); break;
      case "two_w_video_inspection": baseText = buildTwoWVideoInspection(); break;
      case "as_per_rc_no_correction": baseText = buildAsPerRcNoCorrection(); break;
      case "request_closure": baseText = buildClosure(); break;
      case "complete_mismatch": baseText = buildCompleteMismatch(); break;
      case "m_parivahan_mail": baseText = buildMParivahanMail(); break;
      case "bank_statement": baseText = buildBankStatement(); break;
      case "vas_voucher": baseText = buildVasVoucher(); break;
      case "change_not_possible": baseText = buildChangeNotPossible(); break;
      case "sbi_ot": baseText = buildSbiOt(); break;
      default: baseText = tpl.body || ""; break;
    }
  }

  if (appState.extraNoteActive && (appState.extraNoteText || "").trim()) {
    let extraText = expandAbbreviations(appState.extraNoteText.trim());
    if (!/^note[\s:-]/i.test(extraText)) {
      extraText = "Note: " + extraText;
    }
    if (baseText) {
      baseText += "\n\n" + extraText;
    } else {
      baseText = extraText;
    }
  }

  return baseText;
}

function getActiveTemplate() {
  return mailTemplates.find(t => t.id === appState.activeTemplateId) || null;
}

/* ---------- BLANK MAIL ---------- */
function buildBlankMail() {
  const manual = (appState.manualText || "").trim();
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request."
  ];

  if (manual) {
    parts.push("", expandAbbreviations(manual));
  }

  return parts.join("\n");
}

/* ---------- GATEPASS / NATIONAL CANCELLATION ---------- */
function buildGatepassNationalCancellation() {
  const s = appState.sectionSelections;
  const dateType = s.dateType || "same";
  const gpStatus = s.gatepassStatus || "not_provided";

  const parts = [
    "Dear Customer,",
    "Greetings from Policybazaar.com!",
    "",
    "We appreciate your patience. This is in reference to your request regarding the cancellation of your Car Insurance."
  ];

  if (dateType === "same") {
    parts.push(
      "As per the insurer guidelines, since your alternate policy starts on the same date as your old policy, there will be a deduction of only \u20B9118 administrative fee from your refund.",
      "Please confirm to proceed with the cancellation."
    );
  } else {
    // Different Date
    if (gpStatus === "provided_valid") {
      parts.push(
        "As per the latest update from the insurer, since you have provided a valid gate pass proving the vehicle was delivered on the new policy date, only a \u20B9118 administrative fee will be deducted.",
        "Please confirm to proceed with the cancellation."
      );
    } else if (gpStatus === "ask_gp") {
      parts.push(
        "Since your alternate policy start date differs from the old policy date, the insurer will assume the vehicle was delivered under the old policy, which will result in the following deductions:",
        "\u2022 \u20B9118 administrative fee\n\u2022 1 year of third-party premium\n\u2022 Approximately 20% of the own damage premium",
        "To avoid these deductions, please share a copy of the Gate Pass (or delivery receipt) reflecting that the vehicle was delivered on the new policy date. If the gate pass reflects the old date or is not provided, the above deductions will apply.",
        "Please share the gate pass or confirm if we should proceed with the deductions."
      );
    } else {
      // not_provided or old date gatepass
      parts.push(
        "As per the latest update from the insurer, since the alternate policy start date differs and the gate pass reflects the old policy date (or has not been provided), it is considered that the vehicle was delivered under the coverage of the old policy. Therefore, the following deductions will apply:",
        "\u2022 \u20B9118 administrative fee\n\u2022 1 year of third-party premium\n\u2022 Approximately 20% of the own damage premium",
        "Please confirm to proceed with this adjustment."
      );
    }
  }

  return parts.join("\n\n");
}

/* ---------- DOCS ONLY ---------- */
function buildDocsOnly() {
  const s = appState.sectionSelections;
  const parts = [];

  if (s.greeting !== false) {
    parts.push("Greetings from PolicyBazaar.com!");
  }
  if (s.reference !== false) {
    parts.push("This is with reference to your request.");
  }

  const formattedDocs = getFormattedDocuments();
  if (s.docRequestHeader !== false) {
    if (formattedDocs.length > 0) {
      let docBlock = "We kindly request you to share the following document(s) to proceed further with your request:\n";
      for (const d of formattedDocs) docBlock += "\n\u2022 " + d;
      parts.push(docBlock);
    } else {
      parts.push("We kindly request you to share the required documents to proceed further with your request.");
    }
  } else {
    if (formattedDocs.length > 0) {
      let docBlock = "";
      for (let i = 0; i < formattedDocs.length; i++) {
        docBlock += (i > 0 ? "\n" : "") + "\u2022 " + formattedDocs[i];
      }
      parts.push(docBlock);
    }
  }

  if (s.detailsSection && (appState.manualText || "").trim()) {
    parts.push("Please also share/provide the following details:\n\n" + expandAbbreviations(appState.manualText.trim()));
  }

  return parts.join("\n\n");
}

/* ---------- DOCS REQUIRED ---------- */
function buildDocsRequired() {
  const s = appState.sectionSelections;
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "This is with reference to your request."
  ];

  const formattedDocs = getFormattedDocuments();
  if (formattedDocs.length > 0) {
    let docBlock = "We kindly request you to share the following document(s) to proceed further with your request:\n";
    for (const d of formattedDocs) docBlock += "\n\u2022 " + d;
    parts.push(docBlock);
  } else {
    parts.push("We kindly request you to share the required documents to proceed further with your request.");
  }

  if (s.tat !== false) {
    parts.push(
      "We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to 10 days."
    );
  }

  if (s.charges) {
    parts.push("We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.");
  }

  if (s.originalCopy) {
    parts.push("We request you to kindly keep the Endorsed copy along with your original policy copy for future reference.");
  }

  return parts.join("\n\n");
}

/* ---------- RF ---------- */
function buildRF() {
  const s = appState.sectionSelections;
  const parts = [];

  if (s.greeting) parts.push("Greetings from PolicyBazaar.com!");
  if (s.reference) parts.push("This is with reference to your request.");

  if (s.forwarded) {
    if (s.concernedTeam) {
      parts.push("We would like to inform you that we have forwarded your request to the insurer for the necessary update.");
    } else {
      parts.push("We would like to inform you that we have forwarded your request to the insurance company.");
    }
  }

  const formattedDocs = getFormattedDocuments();
  if (s.documents && formattedDocs.length > 0) {
    const hasProposalForm = formattedDocs.includes("PROPOSAL FORM");
    let docBlock = "We kindly request you to share the following documents to proceed further with your request:\n";
    for (const d of formattedDocs) docBlock += "\n\u2022 " + d;
    parts.push(docBlock);

    if (hasProposalForm) {
      parts.push("We request you to kindly fill and share the attached Proposal Form to proceed further with your request.");
    }
  }

  if (s.updateDate) {
    if (appState.workingMode) {
      const days = appState.workingDays;
      const unit = days === 1 ? "working day" : "working days";
      parts.push(`Request you to kindly allow us ${days} ${unit} to share the status update.`);
    } else {
      const target = addDays(new Date(), appState.updateDateOffset);
      const days = appState.updateDateOffset;
      parts.push(`Request you to kindly allow us ${days} days (time till ${formatDateDDMonthYYYY(target)}) to share the status update.`);
    }
  }

  if (s.tat && !appState.workingMode) {
    if (s.concernedTeam) {
      parts.push(`We would like to apprise you that the turnaround time for processing your request can take up to ${appState.tatDays} days.`);
    } else {
      parts.push(`We would like to apprise you that the turnaround time for getting the changes made in your policy copy can take up to ${appState.tatDays} days.`);
    }
  }

  if (s.charges && !appState.workingMode && !s.concernedTeam) {
    parts.push("We would like to update you that there may be charges and inspection applicable, which shall be communicated to you in future communication.");
  }

  if (s.originalCopy && !appState.workingMode && !s.concernedTeam) {
    parts.push("We request you to kindly keep the Endorsed copy along with your original policy copy for future reference.");
  }

  if (s.ncbNote) {
    parts.push("Note: NCB Confirmation Letter may be required to proceed further with your request.");
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
    "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
  );

  return parts.join("\n");
}
/* ---------- SF PAYMENT ---------- */
function buildSF() {
  const s = appState.sectionSelections;
  const rawAmt = appState.fieldValues.amount || "";
  const cleaned = cleanAmount(rawAmt);
  const amt = cleaned ? formatIndianNumber(cleaned) : "[AMOUNT]";
  const link = (appState.fieldValues.link || "").trim() || "[PAYMENT LINK]";

  if (s.confirmIdv) {
    const rawIdv = appState.fieldValues.newIdv || "";
    const cleanedIdv = cleanAmount(rawIdv);
    const idv = cleanedIdv ? formatIndianNumber(cleanedIdv) : "[NEW IDV]";

    return [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request.",
      "",
      `We would like to inform you that, as confirmed by the Insurer, due to the requested changes in your policy, there is a shortfall in the premium amount of Rs. ${amt}/- and the IDV of your vehicle will be revised to Rs. ${idv}/-.`,
      "",
      "We kindly request you to make the payment using the link provided below:",
      "",
      link,
      "",
      `Once the payment is completed, kindly share the payment screenshot along with your confirmation as "Agreed with new IDV" in reply to this email for further processing of your request.`
    ].join("\n");
  }

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    `We would like to inform you that, as confirmed by the Insurer, due to the requested changes in your policy, there is a shortfall in the premium amount of Rs. ${amt}/- for your insurance policy.`,
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
  const s = appState.sectionSelections;
  const rawAmt = appState.fieldValues.amount || "";
  const cleaned = cleanAmount(rawAmt);
  const amt = cleaned ? formatIndianNumber(cleaned, 2) : "[AMOUNT]";
  const days = appState.workingDays || 7;
  const unit = days === 1 ? "working day" : "working days";

  const accountWording = s.neftRefund
    ? "the bank account details shared by you"
    : "your source account";

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    `We would like to inform you that your refund of Rs. ${amt} has been processed successfully.`,
    "",
    `The refund amount is expected to reflect within ${days} ${unit} in ${accountWording}.`
  ].join("\n");
}

/* ---------- AS PER RC NO CORRECTION ---------- */
function buildAsPerRcNoCorrection() {
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We would like to inform you that the details mentioned in your policy are already updated as per the RC/details available with us.",
    "",
    "Hence, no correction is required from our end."
  ];

  if (appState.sectionSelections.updatedDocs) {
    parts.push("", "If you still wish to make any changes, we request you to kindly reply to this email or connect with us along with the updated RC/supporting documents reflecting the required changes.");
  }

  return parts.join("\n");
}
/* ---------- OWNERSHIP TRANSFER ---------- */
function buildOwnershipTransfer() {
  const s = appState.sectionSelections;
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is in reference to your request regarding your Car Insurance policy."
  ];

  if (s.clarification) {
    parts.push(
      "To proceed further, we request you to kindly confirm whether this request is for an Ownership Transfer or a Name Correction. Please share the respective documents and details as per your requirement:",
      "",
      "OPTION 1: For Ownership Transfer",
      ""
    );

    const formattedDocs = getFormattedDocuments();
    let docsStr = "";
    if (formattedDocs.length > 0) {
      docsStr = "Documents Required:\n" + formattedDocs.map(d => `\u2022 ${d}`).join("\n") + "\n\n";
    }

    parts.push(
      docsStr +
      "New Owner Details Required:\n" +
      "\u2022 Insured Name\n" +
      "\u2022 Address\n" +
      "\u2022 Email ID\n" +
      "\u2022 Mobile Number\n" +
      "\u2022 Date of Birth\n" +
      "\u2022 Marital Status\n" +
      "\u2022 Nominee Name\n" +
      "\u2022 Nominee Date of Birth\n" +
      "\u2022 Nominee Relationship with the Insured",
      "",
      "OPTION 2: For Name Correction",
      "",
      "Documents Required:\n" +
      (appState.nameCorrectionDocs && appState.nameCorrectionDocs.length > 0
        ? appState.nameCorrectionDocs.map(d => `\u2022 ${d}`).join("\n")
        : "\u2022 Clear copy of the vehicle's Registration Certificate (RC)\n\u2022 Insured's ID proof (Aadhaar Card / PAN Card) reflecting the correct spelling of the name") + "\n\n" +
      "Details Required:\n" +
      "\u2022 Exact spelling of the Insured's Name to be corrected"
    );
  } else {
    parts.push(
      "We would like to inform you that we have forwarded your request to the insurance company."
    );

    const formattedDocs = getFormattedDocuments();
    if (formattedDocs.length > 0) {
      let docBlock = "To proceed further, we kindly request you to share the following documents:\n";
      for (const d of formattedDocs) docBlock += "\n\u2022 " + d;
      parts.push(docBlock);
    }

    parts.push(
      "Please also share the following details of the new owner:\n\n" +
      "\u2022 Insured Name\n" +
      "\u2022 Address\n" +
      "\u2022 Email ID\n" +
      "\u2022 Mobile Number\n" +
      "\u2022 Date of Birth\n" +
      "\u2022 Marital Status\n" +
      "\u2022 Nominee Name\n" +
      "\u2022 Nominee Date of Birth\n" +
      "\u2022 Nominee Relationship with the Insured"
    );
  }

  parts.push(
    "We would like to apprise you that the turnaround time for making the changes in your policy copy can take up to 10 days.",
    "Please note that there may be charges and inspections applicable, which will be communicated to you in future correspondence.",
    "We also request you to keep the endorsed copy along with your original policy copy for future reference."
  );

  return parts.join("\n\n");
}

/* ---------- 2W VIDEO INSPECTION ---------- */
function buildTwoWVideoInspection() {
  const s = appState.sectionSelections;
  const reason = expandAbbreviations(appState.fieldValues.twoWReinspectionReason || "");

  const parts = [
    "Greetings from PolicyBazaar.com!"
  ];

  if (s.reinspection && reason.trim()) {
    parts.push("", `Note: We request you to upload the video again because ${reason.trim()}.`);
  }

  if (s.rcNote) {
    parts.push("", "Note: Please ensure to clearly capture the RC (Registration Certificate) in the video. Alternatively, you may send a copy of the RC separately by replying to this email or on WhatsApp at 8506013131 from your registered mobile number.");
  }

  parts.push(
    "",
    "Request you to follow the below guidelines to do a self video inspection of your TWO WHEELER.",
    "",
    "Please follow the process outlined below:",
    "",
    "1. Install the PB-App from the Play Store.",
    "2. Go to Account > Vehicle Inspection > Changes in Existing Policy.",
    "3. Input your policy number and vehicle registration number.",
    "4. Complete the checklist.",
    "5. Watch the demo video.",
    "6. Start the video inspection.",
    "",
    "You will need to capture the following details:",
    "",
    "• RC copy (front and back side)",
    "• Current odometer reading of the vehicle",
    "• Engraved chassis number",
    "• 360-degree view of the vehicle, including front and back number plate."
  );

  return parts.join("\n");
}
/* ---------- 4W VIDEO INSPECTION ---------- */
function buildVideoInspection() {
  const s = appState.sectionSelections;
  const reason = expandAbbreviations(appState.fieldValues.reinspectionReason || "");

  const parts = [
    "Greetings from PolicyBazaar.com!",
    "This is with reference to your request."
  ];

  if (s.reinspection && reason.trim()) {
    parts.push(`Note: We request you to upload the video again because ${reason.trim()}.`);
  }

  parts.push("Note: Please ensure that the CNG cylinder is also clearly captured if the vehicle has an externally fitted CNG kit.");

  if (s.rcNote) {
    parts.push("Note: Please ensure to clearly capture the RC (Registration Certificate) in the video. Alternatively, you may send a copy of the RC separately by replying to this email or on WhatsApp at 8506013131 from your registered mobile number.");
  }

  parts.push(
    "Inspection of your vehicle is mandatory for us to proceed with the requested changes in your policy.",
    "Please follow the below guidelines to upload a self-video inspection of your vehicle:",
    "For Android:\nhttps://play.google.com/store/apps/details?id=com.policybazaar&hl=en-GB&pli=1&pid=mobile_hamburger&c=mobile_hamburger_dropdown",
    "For iOS:\nhttps://apps.apple.com/in/app/id956740142?mt=8",
    "Mobile Phone Requirements:\n\n\u2022 Android smartphone with Android version 5.0 or above OR an iOS device.\n\u2022 Mobile camera should be 4 MP or above.\n\u2022 Mobile data or Wi-Fi connection must be enabled.",
    "Things to Remember:\n\n\u2022 Capture the video in daylight, preferably before 6:00 PM on a clear day.\n\u2022 Avoid recording in basements, under shades, under trees, parking areas, or beneath electricity wires.\n\u2022 Ensure the vehicle is in a clean condition.\n\u2022 In case of dents or scratches, capture the affected area clearly by moving the mobile closer.\n\u2022 Ensure that the vehicle remains in focus throughout the video recording.",
    "Please read the instructions carefully before starting the video capture process:\n\n" +
    "1. Install the PolicyBazaar App.\n" +
    "2. View the Demo Video and follow the steps carefully.\n" +
    "3. Click on \"Start Inspection\".\n" +
    "4. Enter your Mobile Number and Vehicle Registration Number, including all digits and letters.\n" +
    "5. Keep the RC (Registration Certificate) and Previous Year Policy ready.\n" +
    "6. Open the bonnet and start making the video as guided in the application.\n" +
    "7. Record the RC and Previous Year Policy.\n" +
    "8. Start the engine and record the Odometer reading. A reading captured in trip mode will not be valid.\n" +
    "9. Capture the external view of the vehicle.\n" +
    "10. Record the Engine Number and Chassis Number, which may be located under the front bonnet or below/beside the driver/front passenger seat.\n" +
    "11. Close the bonnet and record a complete 360-degree view of the vehicle as guided on the screen. Maintain an approximate distance of 2-3 feet from the vehicle.\n" +
    "12. After completing the recording, click the Upload button and ensure that you exit the screen only after the upload is completed successfully.",
    "Once you successfully upload the video, kindly let us know so that we can proceed further with your request."
  );

  return parts.join("\n\n");
}

/* ---------- CANCELLATION ---------- */
function buildCancellation() {
  const parts = [
    "Greetings from PolicyBazaar.com!"
  ];

  parts.push(
    "This is in reference to your cancellation request."
  );

  const items = [];
  if (appState.sectionSelections.consent) {
    items.push("Written consent for cancellation with the policy number (I want to cancel this policy no: ______________)");
  }

  const isMayBe = appState.sectionSelections.alternateMayBe;
  const includeBundle = appState.sectionSelections.includeBundle;
  const shortPolicyName = includeBundle
    ? "Alternate / Bundle policy"
    : "Alternate policy";
  const policyName = `${shortPolicyName} of the same vehicle`;

  if (appState.sectionSelections.alternate && !isMayBe) {
    items.push(policyName);
  }

  if (appState.sectionSelections.neft) {
    items.push("A cancelled cheque or bank passbook of the insured person as per policy");
  }

  if (appState.sectionSelections.documents) {
    const formattedDocs = getFormattedDocuments();
    for (const d of formattedDocs) {
      items.push(d);
    }
  }

  if (items.length > 0) {
    const formatted = items.map((text, idx) => `${idx + 1}. ${text}`);
    parts.push("However, we kindly request you to provide the following:\n\n" + formatted.join("\n"));
  }

  parts.push(
    "The cancellation process typically takes 10 days.",
    "Additionally, please note that there will be an INR 118 administrative fee, along with a deduction based on the policy usage, which will be determined by the insurer after the cancellation request is raised."
  );

  if (appState.sectionSelections.irdaiNote) {
    parts.push("Note: Alternate should be comprehensive, incase of alternate TP, the later issued policy will be cancelled");
  }

  if (appState.sectionSelections.alternate && isMayBe) {
    parts.push(`Note: ${shortPolicyName} may be required as per insurer confirmation.`);
  }

  return parts.join("\n\n");
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
      "\u2022 1800 208 8787 - IVR Toll-Free Number",
      "\u2022 0124 6138301 - Direct connection with the Two-Wheeler Renewal Team"
    );
  }
  if (appState.sectionSelections.fourW) {
    parts.push(
      "",
      "FOUR-WHEELER RENEWAL:",
      "",
      "\u2022 1800 419 7716 - Four-Wheeler Renewal Assistance"
    );
  }
  parts.push("", "We request you to kindly contact the relevant renewal team for further assistance.");
  return parts.join("\n");
}

/* ---------- 24HR TAT MAIL ---------- */
function buildTat24Hr() {
  const mode = appState.fieldValues.tatMode || "24hr";
  const customDays = parseInt(appState.fieldValues.tatCustomDays, 10);
  const customType = appState.fieldValues.tatCustomType || "working";
  const showExact = !!appState.fieldValues.tatCustomShowExactDate;
  const s = appState.sectionSelections;
  let tatText = "24 hours";

  if (mode === "2wd") tatText = "2 working days";
  if (mode === "5wd") tatText = "5 working days";
  if (mode === "10wd") tatText = "10 working days";
  if (mode === "custom") {
    const days = Number.isFinite(customDays) && customDays > 0 ? customDays : 1;
    if (customType === "normal") {
      if (showExact) {
        const target = addDays(new Date(), days);
        tatText = `${days} ${days === 1 ? "day" : "days"} (time till ${formatDateDDMonthYYYY(target)})`;
      } else {
        tatText = `${days} ${days === 1 ? "day" : "days"}`;
      }
    } else {
      tatText = `${days} ${days === 1 ? "working day" : "working days"}`;
    }
  }

  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We apologize for the delay in the update.",
    "",
    "We would like to inform you that we are checking the details with the concerned team/insurance company.",
    "",
    `Request you to kindly allow us ${tatText} to share the status update.`,
    "",
    "We appreciate your patience and understanding."
  ];

  if (s.cancellationFee) {
    parts.push(
      "",
      "Additionally, please note that there will be an INR 118 administrative fee, along with a deduction based on the policy usage, which will be determined by the insurer after the cancellation request is raised."
    );
  }

  return parts.join("\n");
}

function expandAbbreviations(str) {
  if (!str) return "";
  let res = str;
  res = res.replace(/\bzd\b/gi, "zero depreciation");
  res = res.replace(/\bsaod\b/gi, "stand alone own damage policy");
  res = res.replace(/\bod\b/gi, "stand alone own damage policy");
  res = res.replace(/\bot\b/gi, "ownership transfer");
  res = res.replace(/\bcpa\b/gi, "compulsory personal accident (CPA) cover");
  res = res.replace(/\btp\b/gi, "third party");
  res = res.replace(/\bncb\b/gi, "no claim bonus (NCB)");
  res = res.replace(/\bpyp\b/gi, "previous year policy (PYP)");
  res = res.replace(/\brc\b/gi, "registration certificate (RC)");
  res = res.replace(/\bpoi\b/gi, "Period of Insurance (POI)");
  res = res.replace(/\balt policy\b/gi, "alternative policy for same vehicle");
  res = res.replace(/\balt\b/gi, "alternative policy for same vehicle");
  res = res.replace(/\brsa\b/gi, "Roadside Assistance (RSA)");
  res = res.replace(/\b(mmv|mv)\b/gi, "Make, Model & Variant");
  res = res.replace(/\b(comp|compre)\b/gi, "comprehensive policy");
  return res;
}

/* ---------- REQUEST CLOSURE ---------- */
function polishConcern(raw) {
  let clean = raw.trim().toLowerCase();
  if (!clean) return "";

  // Expand abbreviations
  clean = expandAbbreviations(clean);

  let expandedRaw = expandAbbreviations(raw);

  const words = clean.split(/\s+/);
  if (words.length > 8 || raw.length > 50) {
    return expandedRaw;
  }

  const mappings = [
    { keys: ["rsa", "roadside assistance"], label: "Roadside Assistance (RSA) reimbursement" },
    { keys: ["ncb", "no claim bonus"], label: "NCB (No Claim Bonus) update" },
    { keys: ["address", "addr"], label: "Address update" },
    { keys: ["nominee"], label: "Nominee details update" },
    { keys: ["cancellation", "cancel"], label: "Policy cancellation" },
    { keys: ["mobile", "phone", "contact", "number"], label: "Mobile number update" },
    { keys: ["email", "mail"], label: "Email ID update" },
    { keys: ["name", "owner name"], label: "Name correction" },
    { keys: ["chassis"], label: "Chassis number correction" },
    { keys: ["engine"], label: "Engine number correction" },
    { keys: ["reg", "registration", "vehicle number"], label: "Registration number correction" },
    { keys: ["model", "variant", "make", "mmv", "mv"], label: "Make, Model & Variant correction" },
    { keys: ["pyp", "previous year", "previous policy"], label: "Previous policy details update" },
    { keys: ["gender"], label: "Gender correction" },
    { keys: ["dob", "date of birth"], label: "Date of birth correction" },
    { keys: ["ownership transfer", "ownership", "transfer"], label: "Ownership Transfer" },
    { keys: ["third party", "third-party"], label: "Third-Party details update" },
    { keys: ["compulsory personal accident", "personal accident"], label: "Compulsory Personal Accident (CPA) cover update" }
  ];
  for (const m of mappings) {
    if (m.keys.some(k => clean.includes(k))) {
      return m.label;
    }
  }
  return expandedRaw.replace(/\b\w/g, c => c.toUpperCase());
}

function buildClosure() {
  const manual = (appState.manualText || "").trim();
  const warningActive = appState.sectionSelections.claimWarning;

  let closureParagraph = "";
  if (warningActive) {
    closureParagraph = "We would like to inform you that, as per our telephonic conversation, we are proceeding with the closure of this request for now.";
  } else {
    closureParagraph = "We would like to inform you that, as per our telephonic conversation, we are proceeding with the closure of this request as your query has been addressed.";
  }

  if (manual) {
    const cleanLower = manual.toLowerCase();
    const isMapped = [
      "ncb", "no claim bonus", "address", "addr", "nominee", "cancellation", "cancel",
      "mobile", "phone", "contact", "number", "email", "mail", "name", "owner name",
      "chassis", "engine", "reg", "registration", "vehicle number", "model", "variant",
      "make", "pyp", "previous year", "previous policy", "gender", "dob", "date of birth",
      "third party", "tp", "cpa", "ot", "ownership transfer", "ownership", "transfer",
      "claim", "inspection", "video", "charges"
    ].some(k => cleanLower.includes(k)) || manual.split(/\s+/).length <= 8;

    if (isMapped) {
      const polished = polishConcern(manual);
      if (warningActive) {
        closureParagraph = `We would like to inform you that, as per our telephonic conversation regarding your query/request for ${polished}, we are proceeding with the closure of this request for now.`;
      } else {
        closureParagraph = `We would like to inform you that, as per our telephonic conversation regarding your query/request for ${polished}, we are proceeding with the closure of this request as the necessary details have been shared and you do not wish to proceed further.`;
      }
    } else {
      if (warningActive) {
        closureParagraph = `We would like to inform you that, as per our telephonic conversation, we are proceeding with the closure of this request for now.\n\n${manual}`;
      } else {
        closureParagraph = `We would like to inform you that, as per our telephonic conversation, we are proceeding with the closure of this request as your query has been addressed.\n\n${manual}`;
      }
    }
  }

  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    closureParagraph
  ];

  if (warningActive) {
    parts.push(
      "",
      "We would also like to apprise you that in the event of a claim, any incorrect details on the policy copy may lead to complications or claim rejection from the insurer. Therefore, we request you to kindly arrange the required documents at the earliest and get the details verified or endorsed to avoid any issues during a claim."
    );
  }

  parts.push(
    "",
    "We appreciate your understanding in this regard."
  );
  return parts.join("\n");
}

/* ---------- COMPLETE MISMATCH ---------- */
function buildCompleteMismatch() {
  const s = appState.sectionSelections;
  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We would like to inform you that the details mentioned in the policy are completely mismatched, as the Registration Number, Chassis Number, and Engine Number do not match the vehicle's Registration Certificate (RC)."
  ];

  parts.push(
    "",
    "To process the correction, we require the Registration Certificate (RC) of the same vehicle reflecting the correct Registration Number, Chassis Number, and Engine Number. Without the correct RC, the requested correction cannot be processed."
  );

  if (s.includeCancellation) {
    parts.push(
      "",
      "Alternatively, if you wish to proceed with cancellation of the policy, the insurer requires an alternative policy issued for the same vehicle with the correct Registration Number, Chassis Number, and Engine Number.",
      "",
      "Additionally, please note that there will be an INR 118 administrative fee, along with a deduction based on the policy usage, which will be determined by the insurer after the cancellation request is raised."
    );
  }

  parts.push(
    "",
    "We appreciate your understanding in this regard."
  );

  return parts.join("\n");
}

/* ---------- CHANGES NOT POSSIBLE ---------- */
function buildChangeNotPossible() {
  const s = appState.sectionSelections;
  let change = (appState.fieldValues.notPossibleChange || "").trim();

  // Automatically expand abbreviations
  change = expandAbbreviations(change);
  change = change.replace(/\bidv\b/gi, "IDV (Insured Declared Value)");
  change = change.replace(/\bpoi\b/gi, "Period of Insurance (POI)");

  if (s.runningClaimMode) {
    const changeDetail = change ? ` for ${change}` : "";
    return [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request regarding the endorsement of your insurance policy.",
      "",
      `We would like to inform you that your request${changeDetail} cannot be processed at this stage due to an active, ongoing claim on your policy. The insurance company can process endorsement requests only after the current claim is closed.`,
      "",
      "We kindly request you to raise a fresh endorsement request once your claim is closed, along with a copy of the Claim Closure Letter (if applicable).",
      "",
      "We sincerely regret any inconvenience caused and appreciate your understanding in this regard."
    ].join("\n");
  }

  if (s.pypActiveMode) {
    const targetField = change || "Period of Insurance (POI)";
    return [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your request regarding the endorsement of your insurance policy.",
      "",
      `We would like to inform you that the requested endorsement or changes cannot be processed at this stage, as your current policy has not started yet. The insurance company can only correct the ${targetField} once the policy becomes active.`,
      "",
      "We kindly request you to raise a fresh endorsement request once your policy is active.",
      "",
      "We sincerely regret any inconvenience caused and appreciate your understanding in this regard."
    ].join("\n");
  }

  const reason = (appState.fieldValues.notPossibleReason || "").trim();

  const parts = [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request regarding the endorsement in your insurance policy."
  ];

  if (change) {
    parts.push(
      "",
      `We would like to inform you that the requested ${change} cannot be processed at this stage.`
    );
  } else {
    parts.push(
      "",
      "We would like to inform you that the requested endorsement or changes cannot be processed at this stage."
    );
  }

  if (reason) {
    let reasonText = expandAbbreviations(reason);
    const lower = reasonText.toLowerCase();
    if (lower.startsWith("since") || lower.startsWith("because") || lower.startsWith("as ")) {
      reasonText = "Please note that " + reasonText;
    }
    // Capitalize first character
    reasonText = reasonText.charAt(0).toUpperCase() + reasonText.slice(1);
    if (!reasonText.endsWith(".")) {
      reasonText += ".";
    }
    parts.push(
      "",
      reasonText
    );
  }

  parts.push(
    "",
    "We sincerely regret the inconvenience caused to you and appreciate your understanding in this regard."
  );

  return parts.join("\n");
}

/* ---------- SBI OT ---------- */
function buildSbiOt() {
  const s = appState.sectionSelections;
  const rawAmt = appState.fieldValues.amount || "";
  const cleaned = cleanAmount(rawAmt);
  const amt = cleaned ? formatIndianNumber(cleaned) : "50";
  const link = (appState.fieldValues.link || "").trim() || "[PAYMENT LINK]";

  const parts = [
    "Greetings from Policybazaar.com!",
    "",
    "This is in reference to your request regarding the Transfer of Ownership for your vehicle insurance policy."
  ];

  const formattedDocs = getFormattedDocuments();
  if (formattedDocs.length > 0) {
    let docBlock = "To proceed further with your request, we kindly request you to share the following documents and details:\n";
    for (const d of formattedDocs) {
      docBlock += `\n\u2022 ${d}`;
    }

    docBlock += "\n\nNew Owner Details:\n" +
      "\u2022 Insured Name\n" +
      "\u2022 Address\n" +
      "\u2022 Email ID\n" +
      "\u2022 Mobile Number\n" +
      "\u2022 Date of Birth (DOB)\n" +
      "\u2022 Marital Status\n" +
      "\u2022 Nominee Name\n" +
      "\u2022 Nominee DOB\n" +
      "\u2022 Nominee Relationship with the Insured";

    parts.push("", docBlock);
  }

  if (s.paCoverSection) {
    parts.push(
      "",
      "Also, we request you to share a declaration stating whether you wish to add the Personal Accident (PA) Cover for Owner-Driver to your policy:\n\n" +
      "\u2022 If you want to add the PA Cover: Please share a copy of your Driving License (DL) along with the nominee details.\n" +
      "\u2022 If you DO NOT want to add the PA Cover: Please share the reason for opting out. The insurer considers the following valid reasons:\n" +
      "  1. Owner does not have a valid driving license\n" +
      "  2. Already have a personal accidental cover\n" +
      "  3. Owner is not driving the vehicle"
    );
  }

  if (s.shortfallPayment) {
    let noteText = `We wish to inform you there is a shortfall Rs. ${amt}/- in the premium amount as confirmed by the Insurer.`;
    if (s.paCoverSection) {
      noteText = `Note - If you do not want PA cover for owner driver, we request you to make the payment of Rs. ${amt}/- using the link below and share the screenshot after making the payment:\n\n${link}\n\nWe wish to inform you there is a shortfall Rs. ${amt}/- in the premium amount as confirmed by the Insurer.`;
    } else {
      noteText = `We request you to make the shortfall payment of Rs. ${amt}/- using the link below and share the screenshot after making the payment:\n\n${link}\n\nWe wish to inform you there is a shortfall Rs. ${amt}/- in the premium amount as confirmed by the Insurer.`;
    }
    parts.push("", noteText);
  }

  if (s.tat) {
    parts.push(
      "",
      "We would like to apprise you that the turnaround time for getting the changes done in your policy will take 10 days."
    );
  }

  if (s.charges) {
    parts.push(
      "",
      "We would like to inform you that there will be charges applicable for the changes required in your policy, which we will be able to confirm post the insurer's confirmation. We shall keep you informed in our future communication."
    );
  }

  if (s.inspection) {
    parts.push(
      "",
      "An inspection of your vehicle is required as per the insurer's guidelines, which we will update you along with the charges for the same."
    );
  }

  if (s.originalCopy) {
    parts.push(
      "",
      "We request you to kindly keep the Endorsed copy along with your original policy copy for future reference."
    );
  }

  return parts.join("\n");
}

/* ---------- BANK STATEMENT ---------- */
function buildBankStatement() {
  const s = appState.sectionSelections;

  let tatText = "24-48 hours";
  if (s.tatType === "2wd") tatText = "2 working days";
  else if (s.tatType === "5wd") tatText = "5 working days";
  else if (s.tatType === "7wd") tatText = "7 working days";
  else if (s.tatType === "custom") {
    const days = parseInt(appState.fieldValues.statementCustomDays, 10);
    const unit = days === 1 ? "working day" : "working days";
    tatText = `${Number.isFinite(days) && days > 0 ? days : 1} ${unit}`;
  }

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "We would like to inform you that the refund has already been processed by the Insurance Company. If the refund amount is not reflecting in your account, we request you to kindly share your statement.",
    "",
    "Please share the bank/payment statement of the payment source (Credit Card/Debit Card/Bank Account/UPI) or the bank details provided for the refund, from payment date to till date.",
    "",
    `Once we receive the statement, we will check the status with the Insurer/Bank and update you within ${tatText}.`,
    "",
    "We appreciate your patience and understanding."
  ].join("\n");
}

/* ---------- VAS VOUCHER ---------- */
function buildVasVoucher() {
  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request regarding the Value Added Service (VAS).",
    "",
    "Please find attached the voucher to avail of your Value Added Service (VAS).",
    "",
    "For any further queries or detailed information, you can contact the service helpline number provided at the bottom of the voucher.",
    "",
    "In case of any queries, you can write to us at care@policybazaar.com or reply directly to this email.",
    "",
    "We appreciate your understanding in this regard."
  ].join("\n");
}

/* ---------- M PARIVAHAN MAIL ---------- */
function buildMParivahanMail() {
  const s = appState.sectionSelections;
  const parts = [];

  if (s.greeting !== false) parts.push("Greetings from PolicyBazaar.com!");
  if (s.reference !== false) parts.push("This is with reference to your request.");

  if (s.forwarded !== false) {
    parts.push("We would like to inform you that we have forwarded your request to the insurer for the necessary update on the M-Parivahan / VAHAN portal.");
  }

  const formattedDocs = getFormattedDocuments();
  if (s.documents && formattedDocs.length > 0) {
    let docBlock = "We kindly request you to share the following document(s) to proceed further with your request:\n";
    for (const d of formattedDocs) docBlock += "\n\u2022 " + d;
    parts.push(docBlock);
  }

  if (s.tat !== false) {
    const mode = appState.fieldValues.mParivahanTatMode || "10days";
    let tatText = "";

    if (mode === "10days") {
      const showExact = s.showExactDate !== false;
      if (showExact) {
        const target = addDays(new Date(), 10);
        tatText = `10 days (time till ${formatDateDDMonthYYYY(target)})`;
      } else {
        tatText = "10 days";
      }
    } else if (mode === "7wd") {
      tatText = "7 working days";
    } else if (mode === "custom") {
      const days = parseInt(appState.fieldValues.mParivahanCustomDays, 10) || 10;
      const customType = appState.fieldValues.mParivahanCustomType || "working";
      const showExact = !!s.showExactDate;

      if (customType === "normal") {
        if (showExact) {
          const target = addDays(new Date(), days);
          tatText = `${days} ${days === 1 ? "day" : "days"} (time till ${formatDateDDMonthYYYY(target)})`;
        } else {
          tatText = `${days} ${days === 1 ? "day" : "days"}`;
        }
      } else {
        tatText = `${days} ${days === 1 ? "working day" : "working days"}`;
      }
    }

    parts.push(`Request you to kindly allow us ${tatText} to share the status update.`);
  }

  return parts.join("\n\n");
}

/* ---------- TAT ALREADY SHARED ---------- */
function buildTatAlreadyShared() {
  const s = appState.sectionSelections;
  const mode = s.mailMode || "docs_received";

  if (mode === "expedited") {
    return [
      "Greetings from PolicyBazaar.com!",
      "",
      "This is with reference to your recent email regarding the status update of your request.",
      "",
      "We apologize for the inconvenience caused due to the waiting time.",
      "",
      "We would like to inform you that your request is under active processing with the insurance company, and we have already expedited it with the concerned team for a priority resolution.",
      "",
      "Request you to kindly allow us time until the completion of the Turnaround Time (TAT) shared in our earlier communication to share the status update.",
      "",
      "Please be assured that we are tracking your request closely to share the update at the earliest.",
      "",
      "We appreciate your patience and cooperation."
    ].join("\n");
  }

  return [
    "Greetings from PolicyBazaar.com!",
    "",
    "This is with reference to your request.",
    "",
    "Thank you for sharing the requested documents / details.",
    "",
    "We would like to inform you that we have forwarded your request to the insurance company for processing.",
    "",
    "Request you to kindly allow us time until the completion of the Turnaround Time (TAT) shared in our earlier communication to share the status update.",
    "",
    "We appreciate your patience and cooperation."
  ].join("\n");
}

/* =========================================================
   RENDER � LEFT CONTROLS PANE
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
    renderExtraNoteControls(host);
    return;
  }

  switch (tpl.id) {
    case "blank_mail": renderBlankMailControls(host); break;
    case "docs_only": renderDocsOnlyControls(host); break;
    case "gatepass_national_cancellation": renderGatepassNationalCancellationControls(host); break;
    case "docs_required": renderDocsRequiredControls(host); break;
    case "rf": renderRFControls(host); break;
    case "sf_payment": renderSFControls(host); break;
    case "refund_done": renderRefundControls(host); break;
    case "cancellation": renderCancellationControls(host); break;
    case "insured_person_change": renderInsuredPersonChangeControls(host); break;
    case "vahan_updated": renderVahanUpdatedControls(host); break;
    case "renewal_contact": renderRenewalControls(host); break;
    case "tat_24hr": renderTat24HrControls(host); break;
    case "tat_already_shared": renderTatAlreadySharedControls(host); break;
    case "ownership_transfer": renderOwnershipTransferControls(host); break;
    case "video_inspection": renderVideoInspectionControls(host); break;
    case "two_w_video_inspection": renderTwoWVideoInspectionControls(host); break;
    case "as_per_rc_no_correction": renderAsPerRcNoCorrectionControls(host); break;
    case "request_closure": renderClosureControls(host); break;
    case "complete_mismatch": renderCompleteMismatchControls(host); break;
    case "m_parivahan_mail": renderMParivahanMailControls(host); break;
    case "bank_statement": renderBankStatementControls(host); break;
    case "vas_voucher": renderVasVoucherControls(host); break;
    case "change_not_possible": renderChangeNotPossibleControls(host); break;
    case "sbi_ot": renderSbiOtControls(host); break;
  }

  renderExtraNoteControls(host);
}

function renderExtraNoteControls(host) {
  const grp = createGroup("Extra Note");
  grp.appendChild(createToggleRow(
    "Include Extra Note",
    "Add custom note / text at the end of the mail",
    !!appState.extraNoteActive,
    val => {
      appState.extraNoteActive = val;
      renderControls();
      updatePreview();
    }
  ));

  if (appState.extraNoteActive) {
    const ta = document.createElement("textarea");
    ta.className = "text-area";
    ta.placeholder = "Type your additional note here...";
    ta.value = appState.extraNoteText || "";
    ta.rows = 3;
    ta.style.marginTop = "8px";
    ta.addEventListener("input", () => {
      appState.extraNoteText = ta.value;
      updatePreview(true, true);
    });
    grp.appendChild(ta);
  }

  host.appendChild(grp);
}

function renderBlankMailControls(host) {
  const grp = createGroup("Compose Mail");

  const lbl = document.createElement("label");
  lbl.className = "ctrl-label";
  lbl.textContent = "Your Custom Message";

  const ta = document.createElement("textarea");
  ta.className = "text-area";
  ta.placeholder = "Type your custom message here...";
  ta.value = appState.manualText;
  ta.rows = 6;
  ta.addEventListener("input", () => {
    appState.manualText = ta.value;
    updatePreview();
  });

  grp.appendChild(lbl);
  grp.appendChild(ta);
  host.appendChild(grp);
}

function renderGatepassNationalCancellationControls(host) {
  const s = appState.sectionSelections;

  // 1. Alternate Policy Date Type Selector
  const dateGrp = createGroup("Alternate Policy Date");
  const dateWrap = document.createElement("div");
  dateWrap.className = "chip-select";
  dateWrap.style.marginTop = "6px";

  const currentType = s.dateType || "same";

  const optSame = document.createElement("button");
  optSame.type = "button";
  optSame.className = "chip-opt" + (currentType === "same" ? " active" : "");
  optSame.textContent = "Same Date";
  optSame.addEventListener("click", () => {
    s.dateType = "same";
    renderControls();
    updatePreview();
  });

  const optDiff = document.createElement("button");
  optDiff.type = "button";
  optDiff.className = "chip-opt" + (currentType === "diff" ? " active" : "");
  optDiff.textContent = "Different Date";
  optDiff.addEventListener("click", () => {
    s.dateType = "diff";
    renderControls();
    updatePreview();
  });

  dateWrap.appendChild(optSame);
  dateWrap.appendChild(optDiff);
  dateGrp.appendChild(dateWrap);
  host.appendChild(dateGrp);

  // 2. Gate Pass Options (only if different date)
  if (currentType === "diff") {
    const gpGrp = createGroup("Gate Pass Status");
    const gpWrap = document.createElement("div");
    gpWrap.className = "chip-select";
    gpWrap.style.marginTop = "6px";

    const currentGp = s.gatepassStatus || "not_provided";

    const optNotProvided = document.createElement("button");
    optNotProvided.type = "button";
    optNotProvided.className = "chip-opt" + (currentGp === "not_provided" ? " active" : "");
    optNotProvided.textContent = "Old Date / Not Provided";
    optNotProvided.addEventListener("click", () => {
      s.gatepassStatus = "not_provided";
      renderControls();
      updatePreview();
    });

    const optAsk = document.createElement("button");
    optAsk.type = "button";
    optAsk.className = "chip-opt" + (currentGp === "ask_gp" ? " active" : "");
    optAsk.textContent = "Ask for Gate Pass";
    optAsk.addEventListener("click", () => {
      s.gatepassStatus = "ask_gp";
      renderControls();
      updatePreview();
    });

    const optValid = document.createElement("button");
    optValid.type = "button";
    optValid.className = "chip-opt" + (currentGp === "provided_valid" ? " active" : "");
    optValid.textContent = "Valid Date Provided";
    optValid.addEventListener("click", () => {
      s.gatepassStatus = "provided_valid";
      renderControls();
      updatePreview();
    });

    gpWrap.appendChild(optNotProvided);
    gpWrap.appendChild(optAsk);
    gpWrap.appendChild(optValid);
    gpGrp.appendChild(gpWrap);
    host.appendChild(gpGrp);
  }
}

function renderDocsOnlyControls(host) {
  const s = appState.sectionSelections;

  // Documents Group
  const docGrp = createGroup("Documents");
  const docWrap = document.createElement("div");
  docWrap.style.marginTop = "8px";
  docWrap.innerHTML = `
    <div class="doc-input-row">
      <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, pyp, saod, poi"/>
      <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
    </div>
    <div class="doc-chips" id="docChips"></div>
  `;
  docGrp.appendChild(docWrap);
  host.appendChild(docGrp);

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

  // Options Group (Toggles)
  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Greeting",
    "Greetings from PolicyBazaar.com!",
    s.greeting !== false,
    val => { s.greeting = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Reference",
    "This is with reference to your request.",
    s.reference !== false,
    val => { s.reference = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Document Request Line",
    "We kindly request you to share...",
    s.docRequestHeader !== false,
    val => { s.docRequestHeader = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Include Custom Details",
    "Request additional details or information",
    !!s.detailsSection,
    val => {
      s.detailsSection = val;
      renderControls();
      updatePreview();
    }
  ));
  host.appendChild(optGrp);

  // If details toggle is active, show the details textarea
  if (s.detailsSection) {
    const detailsGrp = createGroup("Custom Details");
    const ta = document.createElement("textarea");
    ta.className = "text-area";
    ta.placeholder = "e.g. written consent with policy number...";
    ta.value = appState.manualText || "";
    ta.rows = 4;
    ta.addEventListener("input", () => {
      appState.manualText = ta.value;
      updatePreview();
    });
    detailsGrp.appendChild(ta);
    host.appendChild(detailsGrp);
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

/* ---------- DOCS REQUIRED Controls ---------- */
function renderDocsRequiredControls(host) {
  const s = appState.sectionSelections;

  const docGrp = createGroup("Documents");
  const docWrap = document.createElement("div");
  docWrap.style.marginTop = "8px";
  docWrap.innerHTML = `
    <div class="doc-input-row">
      <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, pyp, aadhar"/>
      <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
    </div>
    <div class="doc-chips" id="docChips"></div>
  `;
  docGrp.appendChild(docWrap);
  host.appendChild(docGrp);

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

  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Include TAT Line",
    "Show turnaround time statement",
    s.tat !== false,
    val => { s.tat = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Charges & Inspection Line",
    "Show charges applicable warning",
    !!s.charges,
    val => { s.charges = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Original Copy Warning Line",
    "Show keep endorsed copy recommendation",
    !!s.originalCopy,
    val => { s.originalCopy = val; updatePreview(); }
  ));
  host.appendChild(optGrp);
}

/* ---------- RF Controls ---------- */
function renderRFControls(host) {
  const s = appState.sectionSelections;

  const grp1 = createGroup("Sections");
  grp1.appendChild(createToggleRow("Greeting", "Greetings from PolicyBazaar.com!", s.greeting, val => { s.greeting = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Reference", "This is with reference to your request.", s.reference, val => { s.reference = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Request Forwarded", "Forwarded to insurance company", s.forwarded, val => { s.forwarded = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Forward to Insurer", "Forwarded to insurer for the update (for general query / M-Parivahan)", !!s.concernedTeam, val => { s.concernedTeam = val; updatePreview(); }));
  host.appendChild(grp1);

  /* Documents */
  const docGrp = createGroup("📄 Documents");
  docGrp.appendChild(createToggleRow("📄 Include Documents", "Adds document request block", s.documents, val => {
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
    workBtn.textContent = appState.workingMode ? "Working mode" : "Working";
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

        const predef = [5, 7, 10];
        const isCustom = !predef.includes(appState.tatDays);

        predef.forEach(n => {
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

        const customBtn = document.createElement("button");
        customBtn.type = "button";
        customBtn.className = "chip-opt" + (isCustom ? " active" : "");
        customBtn.textContent = "Custom";
        customBtn.addEventListener("click", () => {
          if (!isCustom) {
            appState.tatDays = 3; // Default custom value
          }
          renderControls();
          updatePreview();
        });
        chipSel.appendChild(customBtn);
        tatGrp.appendChild(chipSel);

        if (isCustom) {
          const customWrap = document.createElement("div");
          customWrap.style.marginTop = "10px";
          const lbl = document.createElement("label");
          lbl.className = "ctrl-label";
          lbl.textContent = "Custom TAT Days";
          const inp = document.createElement("input");
          inp.type = "number";
          inp.min = "1";
          inp.className = "text-input";
          inp.value = appState.tatDays;
          inp.addEventListener("input", () => {
            const val = parseInt(inp.value, 10);
            appState.tatDays = Number.isFinite(val) && val > 0 ? val : 1;
            updatePreview();
          });
          customWrap.appendChild(lbl);
          customWrap.appendChild(inp);
          tatGrp.appendChild(customWrap);
        }
      }
    }
    host.appendChild(tatGrp);

    /* Extras */
    const extrasGrp = createGroup("Extras");
    extrasGrp.appendChild(createToggleRow("Charges / Inspection", "Possible charges & inspection note", s.charges, val => { s.charges = val; updatePreview(); }));
    extrasGrp.appendChild(createToggleRow("Original + Endorsed Copy", "Keep both copies note", s.originalCopy, val => { s.originalCopy = val; updatePreview(); }));
    extrasGrp.appendChild(createToggleRow("NCB Note", "Include NCB Confirmation Letter requirement note", s.ncbNote, val => { s.ncbNote = val; updatePreview(); }));
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

function getFormattedDocuments() {
  const s = appState.sectionSelections;
  const target = "ADDRESS PROOF REFLECTING THE EXACT SAME ADDRESS TO BE UPDATED";
  return appState.documents.map(d => {
    if (d === target && s.kycAddressOption) {
      return "ADDRESS PROOF WITH SAME ADDRESS OR YOU WANT US TO PROCEED WITH THE ADDRESS MENTIONED IN THE KYC DOCUMENTS SHARED BY YOU";
    }
    return d;
  });
}

function renderKycAddressToggle(parentEl) {
  const s = appState.sectionSelections;
  const target = "ADDRESS PROOF REFLECTING THE EXACT SAME ADDRESS TO BE UPDATED";
  const hasAddr = appState.documents.includes(target);

  const existing = parentEl.querySelector(".kyc-toggle-wrap");
  if (existing) existing.remove();

  if (hasAddr) {
    const wrap = document.createElement("div");
    wrap.className = "kyc-toggle-wrap";
    wrap.style.marginTop = "8px";
    wrap.appendChild(createToggleRow(
      "KYC Address Option",
      "Allow customer to proceed with KYC address (Aadhaar Card)",
      !!s.kycAddressOption,
      val => {
        s.kycAddressOption = val;
        updatePreview();
      }
    ));
    parentEl.appendChild(wrap);
  } else {
    s.kycAddressOption = false;
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
    rm.textContent = "x";
    rm.addEventListener("click", () => {
      appState.documents.splice(idx, 1);
      renderDocChips(host);
      updatePreview();
    });
    chip.appendChild(txt);
    chip.appendChild(rm);
    host.appendChild(chip);
  });

  if (host.parentElement) {
    renderKycAddressToggle(host.parentElement);
  }
}

function renderNameDocChips(host) {
  host.innerHTML = "";
  if (!appState.nameCorrectionDocs) appState.nameCorrectionDocs = [];
  appState.nameCorrectionDocs.forEach((d, idx) => {
    const chip = document.createElement("span");
    chip.className = "doc-chip";
    const txt = document.createElement("span");
    txt.textContent = d;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove " + d);
    rm.textContent = "x";
    rm.addEventListener("click", () => {
      appState.nameCorrectionDocs.splice(idx, 1);
      renderNameDocChips(host);
      updatePreview();
    });
    chip.appendChild(txt);
    chip.appendChild(rm);
    host.appendChild(chip);
  });
}

/* ---------- SF Controls ---------- */
function renderSFControls(host) {
  const s = appState.sectionSelections;
  const grp = createGroup("Payment Details");

  const amtLbl = document.createElement("label");
  amtLbl.className = "ctrl-label";
  amtLbl.textContent = "Shortfall Amount";
  const amtInput = document.createElement("input");
  amtInput.type = "text";
  amtInput.className = "text-input";
  amtInput.placeholder = "e.g. 5000 or Rs. 5000/-";
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

  const optGrp = createGroup("IDV Options");
  optGrp.appendChild(createToggleRow(
    "IDV Change Confirmation",
    "Request confirmation of new IDV along with shortfall payment",
    !!s.confirmIdv,
    val => {
      s.confirmIdv = val;
      renderControls();
      updatePreview();
    }
  ));

  if (s.confirmIdv) {
    const idvLbl = document.createElement("label");
    idvLbl.className = "ctrl-label";
    idvLbl.style.marginTop = "10px";
    idvLbl.textContent = "New IDV Amount";
    const idvInput = document.createElement("input");
    idvInput.type = "text";
    idvInput.className = "text-input";
    idvInput.placeholder = "e.g. 450000 or Rs. 4,50,000/-";
    idvInput.value = appState.fieldValues.newIdv || "";
    idvInput.addEventListener("input", () => {
      appState.fieldValues.newIdv = idvInput.value;
      updatePreview();
    });
    optGrp.appendChild(idvLbl);
    optGrp.appendChild(idvInput);
  }

  host.appendChild(optGrp);
}

/* ---------- REFUND Controls ---------- */
function renderRefundControls(host) {
  const s = appState.sectionSelections;
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

  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Refund to NEFT / Bank Account",
    "Show bank account details shared by you instead of source account",
    !!s.neftRefund,
    val => {
      s.neftRefund = val;
      updatePreview();
    }
  ));
  host.appendChild(optGrp);
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
  const s = appState.sectionSelections;

  /* Documents Group */
  const docGrp = createGroup("📄 Documents");
  docGrp.appendChild(createToggleRow("📄 Include Documents", "Adds document request block", !!s.documents, val => {
    s.documents = val;
    renderControls();
    updatePreview();
  }));

  if (s.documents) {
    const docWrap = document.createElement("div");
    docWrap.style.marginTop = "8px";
    docWrap.innerHTML = `
      <div class="doc-input-row">
        <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, pyp, aadhar, dl, noc"/>
        <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
      </div>
      <div class="doc-chips" id="docChips"></div>
    `;
    docGrp.appendChild(docWrap);
  }
  host.appendChild(docGrp);

  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Insurer Norms Note",
    "Include TP/package policy cancellation note as per insurer norms",
    appState.sectionSelections.irdaiNote,
    val => { appState.sectionSelections.irdaiNote = val; updatePreview(); }
  ));
  grp.appendChild(createToggleRow(
    "Written Consent Line",
    "Ask for written consent with policy number",
    appState.sectionSelections.consent,
    val => { appState.sectionSelections.consent = val; updatePreview(); }
  ));
  grp.appendChild(createToggleRow(
    "Alternate Policy Line",
    "Ask customer to share alternate policy",
    appState.sectionSelections.alternate,
    val => {
      appState.sectionSelections.alternate = val;
      renderControls();
      updatePreview();
    }
  ));
  if (appState.sectionSelections.alternate) {
    grp.appendChild(createToggleRow(
      "Include 'Bundle' Word",
      "Show 'Alternate / Bundle policy' instead of 'Alternate policy'",
      appState.sectionSelections.includeBundle,
      val => { appState.sectionSelections.includeBundle = val; updatePreview(); }
    ));
    grp.appendChild(createToggleRow(
      "Alternate Policy (May Be Note)",
      "Show note at bottom: Alternate / Bundle policy may be required as per insurer confirmation",
      appState.sectionSelections.alternateMayBe,
      val => { appState.sectionSelections.alternateMayBe = val; updatePreview(); }
    ));
  }
  grp.appendChild(createToggleRow(
    "Bank Proof Line",
    "Ask for cancelled cheque/passbook of insured person",
    appState.sectionSelections.neft,
    val => { appState.sectionSelections.neft = val; updatePreview(); }
  ));
  host.appendChild(grp);

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
/* ---------- AS PER RC NO CORRECTION Controls ---------- */
function renderAsPerRcNoCorrectionControls(host) {
  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Updated RC / Supporting Documents Line",
    "Ask customer to reply/connect with updated RC/docs",
    appState.sectionSelections.updatedDocs,
    val => { appState.sectionSelections.updatedDocs = val; updatePreview(); }
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

/* ---------- 24HR TAT Controls ---------- */
function renderTat24HrControls(host) {
  const grp = createGroup("TAT Options");
  const mode = appState.fieldValues.tatMode || "24hr";
  const chipSel = document.createElement("div");
  chipSel.className = "chip-select";

  [
    { value: "24hr", label: "24 hours" },
    { value: "2wd", label: "2 WD" },
    { value: "5wd", label: "5 WD" },
    { value: "10wd", label: "10 WD" },
    { value: "custom", label: "Custom WD" }
  ].forEach(opt => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip-opt" + (mode === opt.value ? " active" : "");
    c.textContent = opt.label;
    c.addEventListener("click", () => {
      appState.fieldValues.tatMode = opt.value;
      if (opt.value === "custom" && !appState.fieldValues.tatCustomDays) {
        appState.fieldValues.tatCustomDays = "3";
      }
      renderControls();
      updatePreview();
    });
    chipSel.appendChild(c);
  });
  grp.appendChild(chipSel);

  if (mode === "custom") {
    const typeLbl = document.createElement("label");
    typeLbl.className = "ctrl-label";
    typeLbl.style.marginTop = "10px";
    typeLbl.textContent = "Day Type";

    const typeWrap = document.createElement("div");
    typeWrap.className = "chip-select";
    typeWrap.style.marginTop = "6px";

    const customType = appState.fieldValues.tatCustomType || "working";

    const optWorking = document.createElement("button");
    optWorking.type = "button";
    optWorking.className = "chip-opt" + (customType === "working" ? " active" : "");
    optWorking.textContent = "Working Days";
    optWorking.addEventListener("click", () => {
      appState.fieldValues.tatCustomType = "working";
      renderControls();
      updatePreview();
    });

    const optNormal = document.createElement("button");
    optNormal.type = "button";
    optNormal.className = "chip-opt" + (customType === "normal" ? " active" : "");
    optNormal.textContent = "Normal Days";
    optNormal.addEventListener("click", () => {
      appState.fieldValues.tatCustomType = "normal";
      renderControls();
      updatePreview();
    });

    typeWrap.appendChild(optWorking);
    typeWrap.appendChild(optNormal);
    grp.appendChild(typeLbl);
    grp.appendChild(typeWrap);

    const dayLbl = document.createElement("label");
    dayLbl.className = "ctrl-label";
    dayLbl.style.marginTop = "10px";
    dayLbl.textContent = customType === "normal" ? "Custom Normal Days" : "Custom Working Days";
    const dayInput = document.createElement("input");
    dayInput.type = "number";
    dayInput.min = "1";
    dayInput.max = "30";
    dayInput.className = "text-input";
    dayInput.placeholder = "e.g. 3";
    dayInput.value = appState.fieldValues.tatCustomDays || "3";
    dayInput.addEventListener("input", () => {
      appState.fieldValues.tatCustomDays = dayInput.value;
      updatePreview();
    });
    grp.appendChild(dayLbl);
    grp.appendChild(dayInput);

    if (customType === "normal") {
      const toggleRow = createToggleRow(
        "Show as Exact Date",
        "Convert normal days count to exact calendar date",
        !!appState.fieldValues.tatCustomShowExactDate,
        val => {
          appState.fieldValues.tatCustomShowExactDate = val;
          updatePreview();
        }
      );
      toggleRow.style.marginTop = "10px";
      grp.appendChild(toggleRow);
    }
  }

  host.appendChild(grp);

  const s = appState.sectionSelections;
  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Cancellation Info",
    "Show cancellation charges and fee structure",
    !!s.cancellationFee,
    val => { s.cancellationFee = val; updatePreview(); }
  ));
  host.appendChild(optGrp);
}

/* ---------- TAT ALREADY SHARED Controls ---------- */
function renderTatAlreadySharedControls(host) {
  const s = appState.sectionSelections;

  const modeGrp = createGroup("Select Mail Type");
  const chipWrap = document.createElement("div");
  chipWrap.className = "chip-select";
  chipWrap.style.marginTop = "6px";

  const currentMode = s.mailMode || "docs_received";

  const optDocs = document.createElement("button");
  optDocs.type = "button";
  optDocs.className = "chip-opt" + (currentMode === "docs_received" ? " active" : "");
  optDocs.textContent = "Requirements Received";
  optDocs.addEventListener("click", () => {
    s.mailMode = "docs_received";
    renderControls();
    updatePreview();
  });

  const optExp = document.createElement("button");
  optExp.type = "button";
  optExp.className = "chip-opt" + (currentMode === "expedited" ? " active" : "");
  optExp.textContent = "Expedited Follow-up";
  optExp.addEventListener("click", () => {
    s.mailMode = "expedited";
    renderControls();
    updatePreview();
  });

  chipWrap.appendChild(optDocs);
  chipWrap.appendChild(optExp);
  modeGrp.appendChild(chipWrap);
  host.appendChild(modeGrp);
}

/* ---------- OWNERSHIP TRANSFER Controls ---------- */
function renderOwnershipTransferControls(host) {
  const s = appState.sectionSelections;

  // 1. Documents for Ownership Transfer
  const docGrp = createGroup("Ownership Transfer Documents");
  const docWrap = document.createElement("div");
  docWrap.innerHTML = `
    <div class="doc-input-row">
      <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. clear rc, new owner aadhar, pan"/>
      <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
    </div>
    <div class="doc-chips" id="docChips"></div>
  `;
  docGrp.appendChild(docWrap);
  host.appendChild(docGrp);

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

  // 2. Documents for Name Correction (if clarification is enabled)
  if (s.clarification) {
    const nameDocGrp = createGroup("Name Correction Documents");
    const nameDocWrap = document.createElement("div");
    nameDocWrap.innerHTML = `
      <div class="doc-input-row">
        <input type="text" class="text-input" id="nameDocInput" placeholder="Type document e.g. correct rc, pan, aadhar"/>
        <button type="button" class="doc-add-btn" id="nameDocAddBtn">Add</button>
      </div>
      <div class="doc-chips" id="nameDocChips"></div>
    `;
    nameDocGrp.appendChild(nameDocWrap);
    host.appendChild(nameDocGrp);

    const nameInput = document.getElementById("nameDocInput");
    const nameBtn = document.getElementById("nameDocAddBtn");
    const nameChips = document.getElementById("nameDocChips");
    if (nameInput && nameBtn && nameChips) {
      const doAdd = () => {
        const val = nameInput.value.trim();
        if (!val) return;
        const norm = normalizeDocument(val);
        if (!appState.nameCorrectionDocs) appState.nameCorrectionDocs = [];
        if (!appState.nameCorrectionDocs.includes(norm)) {
          appState.nameCorrectionDocs.push(norm);
        }
        nameInput.value = "";
        renderNameDocChips(nameChips);
        updatePreview();
      };
      nameBtn.addEventListener("click", doAdd);
      nameInput.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); doAdd(); }
      });
      renderNameDocChips(nameChips);
    }
  }

  // 3. Options
  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Ownership / Name Correction Clarification",
    "Ask customer to confirm ownership transfer or name correction",
    appState.sectionSelections.clarification,
    val => {
      appState.sectionSelections.clarification = val;
      renderControls();
      updatePreview();
    }
  ));
  host.appendChild(optGrp);

  const infoGrp = createGroup("Included Details");
  const info = document.createElement("div");
  info.style.fontSize = "12.5px";
  info.style.color = "var(--text-soft)";
  info.textContent = "New owner details, 10-day TAT, charges/inspection note, and endorsed-copy note are included automatically.";
  infoGrp.appendChild(info);
  host.appendChild(infoGrp);
}
/* ---------- 2W VIDEO INSPECTION Controls ---------- */
function renderTwoWVideoInspectionControls(host) {
  const s = appState.sectionSelections;

  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Re-inspection Note",
    "Add a note explaining why a new video is required",
    !!s.reinspection,
    val => {
      s.reinspection = val;
      renderControls();
      updatePreview();
    }
  ));
  grp.appendChild(createToggleRow(
    "RC Copy / WhatsApp Note",
    "Ask customer to show RC in video or send via Email / WhatsApp (8506013131)",
    !!s.rcNote,
    val => {
      s.rcNote = val;
      updatePreview();
    }
  ));
  host.appendChild(grp);

  if (s.reinspection) {
    const reasonGrp = createGroup("Re-inspection Details");

    const label = document.createElement("label");
    label.className = "ctrl-label";
    label.textContent = "Reason for asking again";
    reasonGrp.appendChild(label);

    const input = document.createElement("textarea");
    input.className = "text-input";
    input.style.width = "100%";
    input.style.minHeight = "60px";
    input.style.resize = "vertical";
    input.placeholder = "e.g. the previous video was not clear / night time recording";
    input.value = appState.fieldValues.twoWReinspectionReason || "";
    input.addEventListener("input", () => {
      appState.fieldValues.twoWReinspectionReason = input.value;
      updatePreview();
    });

    reasonGrp.appendChild(input);
    host.appendChild(reasonGrp);
  }
}

/* ---------- 4W VIDEO INSPECTION Controls ---------- */
function renderVideoInspectionControls(host) {
  const s = appState.sectionSelections;

  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Re-inspection Note",
    "Add a note explaining why a new video is required",
    !!s.reinspection,
    val => {
      s.reinspection = val;
      renderControls();
      updatePreview();
    }
  ));
  grp.appendChild(createToggleRow(
    "RC Copy / WhatsApp Note",
    "Ask customer to show RC in video or send via Email / WhatsApp (8506013131)",
    !!s.rcNote,
    val => {
      s.rcNote = val;
      updatePreview();
    }
  ));
  host.appendChild(grp);

  if (s.reinspection) {
    const reasonGrp = createGroup("Re-inspection Details");

    const label = document.createElement("label");
    label.className = "ctrl-label";
    label.textContent = "Reason for asking again";
    reasonGrp.appendChild(label);

    const input = document.createElement("textarea");
    input.className = "text-input";
    input.style.width = "100%";
    input.style.minHeight = "60px";
    input.style.resize = "vertical";
    input.placeholder = "e.g. the previous video was not clear / night time recording";
    input.value = appState.fieldValues.reinspectionReason || "";
    input.addEventListener("input", () => {
      appState.fieldValues.reinspectionReason = input.value;
      updatePreview();
    });

    reasonGrp.appendChild(input);
    host.appendChild(reasonGrp);
  }
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

  const s = appState.sectionSelections;
  const optGrp = createGroup("Options");
  optGrp.appendChild(createToggleRow(
    "Incorrect Details / Claim Warning",
    "Include warning that incorrect policy details may affect claim settlement",
    !!s.claimWarning,
    val => {
      s.claimWarning = val;
      updatePreview();
    }
  ));
  host.appendChild(optGrp);
}

/* ---------- COMPLETE MISMATCH Controls ---------- */
function renderCompleteMismatchControls(host) {
  const grp = createGroup("Options");
  grp.appendChild(createToggleRow(
    "Cancellation Details",
    "Include policy cancellation option and administrative fee info",
    !!appState.sectionSelections.includeCancellation,
    val => {
      appState.sectionSelections.includeCancellation = val;
      updatePreview();
    }
  ));
  host.appendChild(grp);
}

/* ---------- CHANGES NOT POSSIBLE Controls ---------- */
function renderChangeNotPossibleControls(host) {
  const s = appState.sectionSelections;

  // Toggle Group for Mode Options
  const modeGrp = createGroup("Mode Options");
  modeGrp.appendChild(createToggleRow(
    "Policy Not Started Mode",
    "Insurer requires policy to become active before correcting details (POI, Name, Mobile, MMV)",
    !!s.pypActiveMode,
    val => {
      s.pypActiveMode = val;
      if (val) s.runningClaimMode = false;
      renderControls();
      updatePreview();
    }
  ));
  modeGrp.appendChild(createToggleRow(
    "Running Claim Mode",
    "Insurer cannot process changes due to active ongoing claim on policy",
    !!s.runningClaimMode,
    val => {
      s.runningClaimMode = val;
      if (val) s.pypActiveMode = false;
      renderControls();
      updatePreview();
    }
  ));
  host.appendChild(modeGrp);

  const groupTitle = s.runningClaimMode
    ? "Claim & Detail Options"
    : (s.pypActiveMode ? "Correction Details" : "Custom Rejection Details");

  const grp = createGroup(groupTitle);

  const changeLbl = document.createElement("label");
  changeLbl.className = "ctrl-label";
  changeLbl.textContent = s.runningClaimMode
    ? "Detail requested (Optional, e.g. Name, MMV, POI)"
    : (s.pypActiveMode ? "Detail to correct (e.g. POI, Name, Mobile Number, MMV)" : "What change is not possible? (e.g. IDV update)");

  const changeInp = document.createElement("input");
  changeInp.type = "text";
  changeInp.className = "text-input";
  changeInp.placeholder = s.runningClaimMode
    ? "Optional e.g. Name or MMV"
    : (s.pypActiveMode ? "e.g. POI, Name, Mobile Number, MMV" : "e.g. IDV update");
  changeInp.value = appState.fieldValues.notPossibleChange || "";
  changeInp.addEventListener("input", () => {
    appState.fieldValues.notPossibleChange = changeInp.value;
    updatePreview();
  });
  grp.appendChild(changeLbl);
  grp.appendChild(changeInp);

  if (!s.pypActiveMode && !s.runningClaimMode) {
    const reasonLbl = document.createElement("label");
    reasonLbl.className = "ctrl-label";
    reasonLbl.style.marginTop = "10px";
    reasonLbl.textContent = "Why is it not possible? (Reason)";
    const reasonTa = document.createElement("textarea");
    reasonTa.className = "text-input";
    reasonTa.style.width = "100%";
    reasonTa.style.minHeight = "80px";
    reasonTa.style.resize = "vertical";
    reasonTa.placeholder = "e.g. since this is a Third-Party policy, the vehicle itself is not covered...";
    reasonTa.value = appState.fieldValues.notPossibleReason || "";
    reasonTa.addEventListener("input", () => {
      appState.fieldValues.notPossibleReason = reasonTa.value;
      updatePreview();
    });
    grp.appendChild(reasonLbl);
    grp.appendChild(reasonTa);
  }

  host.appendChild(grp);

  // Quick Presets
  const presetGrp = createGroup("Quick Presets");

  const presets = [
    {
      name: "Running Claim Mode",
      change: "",
      runningClaimMode: true,
      pypActiveMode: false
    },
    {
      name: "Policy Not Started (POI)",
      change: "Period of Insurance (POI)",
      pypActiveMode: true,
      runningClaimMode: false
    },
    {
      name: "Policy Not Started (Name)",
      change: "Name",
      pypActiveMode: true,
      runningClaimMode: false
    },
    {
      name: "Policy Not Started (MMV)",
      change: "Make, Model & Variant",
      pypActiveMode: true,
      runningClaimMode: false
    },
    {
      name: "IDV (Third-Party)",
      change: "IDV update",
      reason: "since this is a Third-Party policy, the vehicle itself is not covered, and therefore, an Insured Declared Value (IDV) is not applicable",
      pypActiveMode: false,
      runningClaimMode: false
    },
    {
      name: "POI (Expired)",
      change: "insurance dates (Period of Insurance) change",
      reason: "your previous policy had already expired before the current policy was renewed. It is considered a break-in policy and was not renewed in continuity",
      pypActiveMode: false,
      runningClaimMode: false
    },
    {
      name: "POI (Previous TP)",
      change: "insurance dates (Period of Insurance) change",
      reason: "your previous year's policy was a Third-Party policy, and insurance dates cannot be aligned in continuity under these circumstances",
      pypActiveMode: false,
      runningClaimMode: false
    }
  ];

  const btnWrap = document.createElement("div");
  btnWrap.className = "chip-select";
  btnWrap.style.marginTop = "8px";

  presets.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-opt";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      s.pypActiveMode = !!p.pypActiveMode;
      appState.fieldValues.notPossibleChange = p.change;
      if (p.reason) {
        appState.fieldValues.notPossibleReason = p.reason;
      }
      renderControls();
      updatePreview();
    });
    btnWrap.appendChild(btn);
  });

  presetGrp.appendChild(btnWrap);
  host.appendChild(presetGrp);
}

/* ---------- SBI OT Controls ---------- */
function renderSbiOtControls(host) {
  const s = appState.sectionSelections;

  // Documents
  const docGrp = createGroup("Documents & Details");
  const docWrap = document.createElement("div");
  docWrap.innerHTML = `
    <div class="doc-input-row">
      <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, aadhar, pan"/>
      <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
    </div>
    <div class="doc-chips" id="docChips"></div>
  `;
  docGrp.appendChild(docWrap);
  host.appendChild(docGrp);

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

  // Toggles Group
  const optGrp = createGroup("Toggles");
  optGrp.appendChild(createToggleRow(
    "PA Cover Section",
    "Include PA cover declaration block & reasons",
    !!s.paCoverSection,
    val => { s.paCoverSection = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Shortfall Payment Section",
    "Include shortfall amount & link statement",
    !!s.shortfallPayment,
    val => { s.shortfallPayment = val; renderControls(); updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Include TAT Line",
    "Include 10 days TAT statement",
    !!s.tat,
    val => { s.tat = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Endorsement Charges Info",
    "Include charges warning line",
    !!s.charges,
    val => { s.charges = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Vehicle Inspection Info",
    "Include vehicle inspection line",
    !!s.inspection,
    val => { s.inspection = val; updatePreview(); }
  ));
  optGrp.appendChild(createToggleRow(
    "Original Copy Warning Line",
    "Show keep endorsed copy recommendation",
    !!s.originalCopy,
    val => { s.originalCopy = val; updatePreview(); }
  ));
  host.appendChild(optGrp);

  // Shortfall payment inputs
  if (s.shortfallPayment) {
    const paymentGrp = createGroup("Payment Settings");

    const amtLbl = document.createElement("label");
    amtLbl.className = "ctrl-label";
    amtLbl.textContent = "Shortfall Amount (Rs.)";
    const amtInput = document.createElement("input");
    amtInput.type = "text";
    amtInput.className = "text-input";
    amtInput.placeholder = "e.g. 50";
    amtInput.value = appState.fieldValues.amount || "50";
    amtInput.addEventListener("input", () => {
      appState.fieldValues.amount = amtInput.value;
      updatePreview();
    });
    paymentGrp.appendChild(amtLbl);
    paymentGrp.appendChild(amtInput);

    const linkLbl = document.createElement("label");
    linkLbl.className = "ctrl-label";
    linkLbl.style.marginTop = "10px";
    linkLbl.textContent = "Payment Link";
    const linkInput = document.createElement("input");
    linkInput.type = "text";
    linkInput.className = "text-input";
    linkInput.placeholder = "e.g. https://pg.policybazaar.com/...";
    linkInput.value = appState.fieldValues.link || "";
    linkInput.addEventListener("input", () => {
      appState.fieldValues.link = linkInput.value;
      updatePreview();
    });
    paymentGrp.appendChild(linkLbl);
    paymentGrp.appendChild(linkInput);

    host.appendChild(paymentGrp);
  }
}

/* ---------- BANK STATEMENT Controls ---------- */
function renderBankStatementControls(host) {
  const s = appState.sectionSelections;

  // No inputs needed for date since we hardcode "payment date"

  // TAT Selection Group
  const tatGrp = createGroup("TAT Options");

  const options = [
    { value: "24-48hr", label: "24-48 Hours" },
    { value: "2wd", label: "2 Working Days" },
    { value: "5wd", label: "5 Working Days" },
    { value: "7wd", label: "7 Working Days" },
    { value: "custom", label: "Custom WD" }
  ];

  const selectWrap = document.createElement("div");
  selectWrap.className = "chip-select";
  selectWrap.style.marginTop = "8px";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-opt" + (s.tatType === opt.value ? " active" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      s.tatType = opt.value;
      renderControls();
      updatePreview();
    });
    selectWrap.appendChild(btn);
  });
  tatGrp.appendChild(selectWrap);

  if (s.tatType === "custom") {
    const customLbl = document.createElement("label");
    customLbl.className = "ctrl-label";
    customLbl.style.marginTop = "10px";
    customLbl.textContent = "Custom Working Days";
    const customInput = document.createElement("input");
    customInput.type = "number";
    customInput.min = "1";
    customInput.className = "text-input";
    customInput.placeholder = "e.g. 3";
    customInput.value = appState.fieldValues.statementCustomDays || "";
    customInput.addEventListener("input", () => {
      appState.fieldValues.statementCustomDays = customInput.value;
      updatePreview();
    });
    tatGrp.appendChild(customLbl);
    tatGrp.appendChild(customInput);
  }

  host.appendChild(tatGrp);
}

/* ---------- VAS VOUCHER Controls ---------- */
function renderVasVoucherControls(host) {
  const grp = createGroup("Info");
  const info = document.createElement("div");
  info.style.fontSize = "12.5px";
  info.style.color = "var(--text-soft)";
  info.textContent = "This template refers to the helpline number printed directly on the voucher.";
  grp.appendChild(info);
  host.appendChild(grp);
}

/* ---------- M PARIVAHAN MAIL Controls ---------- */
function renderMParivahanMailControls(host) {
  const s = appState.sectionSelections;

  // 1. Sections Group
  const grp1 = createGroup("Sections");
  grp1.appendChild(createToggleRow("Greeting", "Greetings from PolicyBazaar.com!", s.greeting !== false, val => { s.greeting = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Reference", "This is with reference to your request.", s.reference !== false, val => { s.reference = val; updatePreview(); }));
  grp1.appendChild(createToggleRow("Forwarded Line", "Forwarded request to insurer for M-Parivahan update", s.forwarded !== false, val => { s.forwarded = val; updatePreview(); }));
  host.appendChild(grp1);

  // 2. Documents Group
  const docGrp = createGroup("📄 Documents");
  docGrp.appendChild(createToggleRow("📄 Include Documents", "Adds document request block", !!s.documents, val => {
    s.documents = val;
    renderControls();
    updatePreview();
  }));
  if (s.documents) {
    const docWrap = document.createElement("div");
    docWrap.style.marginTop = "8px";
    docWrap.innerHTML = `
      <div class="doc-input-row">
        <input type="text" class="text-input" id="docInput" placeholder="Type document e.g. rc, pyp, tp"/>
        <button type="button" class="doc-add-btn" id="docAddBtn">Add</button>
      </div>
      <div class="doc-chips" id="docChips"></div>
    `;
    docGrp.appendChild(docWrap);

    setTimeout(() => {
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
    }, 0);
  }
  host.appendChild(docGrp);

  // 3. TAT Options Group
  const tatGrp = createGroup("TAT / Status Update Line");
  tatGrp.appendChild(createToggleRow(
    "Include TAT Line",
    "Request customer to allow time for status update",
    s.tat !== false,
    val => {
      s.tat = val;
      renderControls();
      updatePreview();
    }
  ));

  if (s.tat !== false) {
    const mode = appState.fieldValues.mParivahanTatMode || "10days";
    const chipSel = document.createElement("div");
    chipSel.className = "chip-select";
    chipSel.style.marginTop = "8px";

    [
      { value: "10days", label: "10 Days" },
      { value: "7wd", label: "7 Working Days" },
      { value: "custom", label: "Custom" }
    ].forEach(opt => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip-opt" + (mode === opt.value ? " active" : "");
      c.textContent = opt.label;
      c.addEventListener("click", () => {
        appState.fieldValues.mParivahanTatMode = opt.value;
        renderControls();
        updatePreview();
      });
      chipSel.appendChild(c);
    });
    tatGrp.appendChild(chipSel);

    if (mode === "10days") {
      const exactToggle = createToggleRow(
        "Show Exact Date",
        "Convert 10 days to exact calendar date (time till DD-Month-YYYY)",
        s.showExactDate !== false,
        val => {
          s.showExactDate = val;
          updatePreview();
        }
      );
      exactToggle.style.marginTop = "10px";
      tatGrp.appendChild(exactToggle);
    } else if (mode === "custom") {
      const customType = appState.fieldValues.mParivahanCustomType || "working";

      const typeLbl = document.createElement("label");
      typeLbl.className = "ctrl-label";
      typeLbl.style.marginTop = "10px";
      typeLbl.textContent = "Day Type";

      const typeWrap = document.createElement("div");
      typeWrap.className = "chip-select";
      typeWrap.style.marginTop = "4px";

      const optWorking = document.createElement("button");
      optWorking.type = "button";
      optWorking.className = "chip-opt" + (customType === "working" ? " active" : "");
      optWorking.textContent = "Working Days";
      optWorking.addEventListener("click", () => {
        appState.fieldValues.mParivahanCustomType = "working";
        renderControls();
        updatePreview();
      });

      const optNormal = document.createElement("button");
      optNormal.type = "button";
      optNormal.className = "chip-opt" + (customType === "normal" ? " active" : "");
      optNormal.textContent = "Normal Days";
      optNormal.addEventListener("click", () => {
        appState.fieldValues.mParivahanCustomType = "normal";
        renderControls();
        updatePreview();
      });

      typeWrap.appendChild(optWorking);
      typeWrap.appendChild(optNormal);
      tatGrp.appendChild(typeLbl);
      tatGrp.appendChild(typeWrap);

      const dayLbl = document.createElement("label");
      dayLbl.className = "ctrl-label";
      dayLbl.style.marginTop = "10px";
      dayLbl.textContent = customType === "normal" ? "Custom Normal Days" : "Custom Working Days";

      const dayInput = document.createElement("input");
      dayInput.type = "number";
      dayInput.min = "1";
      dayInput.max = "60";
      dayInput.className = "text-input";
      dayInput.placeholder = "e.g. 10";
      dayInput.value = appState.fieldValues.mParivahanCustomDays || "10";
      dayInput.addEventListener("input", () => {
        appState.fieldValues.mParivahanCustomDays = dayInput.value;
        updatePreview();
      });
      tatGrp.appendChild(dayLbl);
      tatGrp.appendChild(dayInput);

      if (customType === "normal") {
        const exactToggle = createToggleRow(
          "Show Exact Date",
          "Convert custom days to exact calendar date (time till DD-Month-YYYY)",
          !!s.showExactDate,
          val => {
            s.showExactDate = val;
            updatePreview();
          }
        );
        exactToggle.style.marginTop = "10px";
        tatGrp.appendChild(exactToggle);
      }
    }
  }

  host.appendChild(tatGrp);
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
   PREVIEW RENDERING (safe HTML; visual badges are not copied)
   ========================================================= */
function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPreviewBadges(line) {
  const lower = String(line || "").toLowerCase();
  if (lower.includes("charges and inspection applicable")) {
    return [
      { icon: "V", label: "Inspection" },
      { icon: "Rs", label: "Charges" }
    ];
  }
  return [];
}

function renderPreviewHTML(text) {
  const allowDelete = [
    "docs_only",
    "docs_required",
    "rf",
    "m_parivahan_mail",
    "ownership_transfer",
    "cancellation",
    "insured_person_change",
    "as_per_rc_no_correction",
    "sbi_ot"
  ].includes(appState.activeTemplateId);

  return String(text || "").split("\n").map(line => {
    const badges = getPreviewBadges(line);
    const badgeHTML = badges.map(b => (
      `<span class="preview-badge" title="${escapeHTML(b.label)}" aria-hidden="true">${escapeHTML(b.icon)}</span>`
    )).join("");
    const badgeWrap = badgeHTML ? `<span class="preview-badge-wrap">${badgeHTML}</span>` : "";
    const docLine = String(line || "").match(/^\u2022\s+(.+)$/);
    if (docLine) {
      if (allowDelete) {
        return `<span class="preview-doc-bullet" aria-hidden="true">&bull;</span>${escapeHTML(docLine[1])} <span class="delete-line-btn" data-line="${escapeHTML(line)}" title="Delete this line">&times;</span>`;
      } else {
        return `<span class="preview-doc-bullet" aria-hidden="true">&bull;</span>${escapeHTML(docLine[1])}`;
      }
    }
    return badgeWrap + escapeHTML(line);
  }).join("\n");
}

function updatePreview(isControlChange = true, scrollPreviewToBottom = false) {
  // If user is currently editing preview, don't overwrite
  if (appState.previewEditing) return;
  if (isControlChange) {
    appState.manualPreviewOverride = null;
  }
  const card = document.getElementById("previewCard");
  const text = buildPreview();
  card.innerHTML = renderPreviewHTML(text);
  if (scrollPreviewToBottom) {
    requestAnimationFrame(() => {
      card.scrollTop = card.scrollHeight;
    });
  }

  setCopyButtonsDisabled(!text.trim());
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
  appState.extraNoteActive = false;
  appState.extraNoteText = "";

  // Init section selections
  if (tpl.id === "rf") {
    appState.sectionSelections = {
      greeting: true, reference: true, forwarded: false,
      documents: false, updateDate: true, tat: true,
      charges: true, originalCopy: true, ncbNote: false
    };
  } else if (tpl.id === "tat_already_shared") {
    appState.sectionSelections = { ...tpl.defaultSelections };
  } else if (tpl.id === "m_parivahan_mail") {
    appState.sectionSelections = {
      greeting: true,
      reference: true,
       forwarded: false,
      documents: false,
      tat: true,
      showExactDate: true
    };
    appState.fieldValues.mParivahanTatMode = "10days";
    appState.documents = [];
  } else if (tpl.id === "ownership_transfer") {
    appState.sectionSelections = { clarification: false };
    appState.documents = [];
  } else if (tpl.id === "sbi_ot") {
    appState.sectionSelections = { ...tpl.defaultSelections };
    appState.documents = [
      "RC (REGISTRATION CERTIFICATE)",
      "AADHAAR CARD",
      "PAN CARD",
      "PROPOSAL FORM"
    ];
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

function getCopyButtons() {
  return ["copyBtn", "copyTopBtn"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
}

function setCopyButtonsDisabled(disabled) {
  getCopyButtons().forEach(btn => {
    btn.disabled = disabled;
  });
}

function setCopyButtonsCopied(copied) {
  getCopyButtons().forEach(btn => {
    btn.classList.toggle("copied", copied);
    btn.textContent = copied ? "Copied" : "Copy Mail";
  });
}
/* =========================================================
   COPY LOGIC
   ========================================================= */
async function copyMail() {
  const card = document.getElementById("previewCard");
  // Normal previews may include visual-only badges, so copy from the raw builder.
  let text = appState.previewEditing
    ? (card.textContent || "")
    : (appState.manualPreviewOverride !== null ? appState.manualPreviewOverride : buildPreview());
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

  if (success) {
    setCopyButtonsCopied(true);
    showToast("Mail copied to clipboard", "success");
    setTimeout(() => setCopyButtonsCopied(false), 1500);
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
    showToast("PiP not supported � using floating fallback", "success");
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
        // Cross-origin sheets � link them
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
    showToast("Could not open PiP � using floating mode", "error");
    toggleFloating();
  }
}

function closePiP() {
  if (pipWindow && !pipWindow.closed) {
    try { pipWindow.close(); } catch (e) { }
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
    try { header.releasePointerCapture(e.pointerId); } catch (err) { }
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
  } catch (e) { }

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
    try { mini.releasePointerCapture(e.pointerId); } catch (err) { }
    if (appState.miniPos) {
      try { sessionStorage.setItem("pbmh_mini_pos", JSON.stringify(appState.miniPos)); } catch (err) { }
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
    setCopyButtonsDisabled(true);
    document.getElementById("searchInput").focus();
    renderControls();
  });

  // Action buttons
  document.getElementById("resetBtn").addEventListener("click", resetTemplate);
  document.getElementById("resetTopBtn").addEventListener("click", resetTemplate);
  document.getElementById("copyBtn").addEventListener("click", copyMail);
  document.getElementById("copyTopBtn").addEventListener("click", copyMail);

  // Preview editing
  const card = document.getElementById("previewCard");
  card.addEventListener("dblclick", () => {
    if (!appState.activeTemplateId) return;
    if (appState.previewEditing) return;
    card.textContent = buildPreview();
    card.setAttribute("contenteditable", "true");
    appState.previewEditing = true;
    card.focus();
    showToast("Editing enabled  click outside to save", "success");
  });

  card.addEventListener("click", e => {
    const btn = e.target.closest(".delete-line-btn");
    if (btn) {
      e.stopPropagation();
      const lineToDelete = btn.getAttribute("data-line");
      let currentText = appState.manualPreviewOverride !== null ? appState.manualPreviewOverride : buildPreview();
      const lines = currentText.split("\n");
      const index = lines.indexOf(lineToDelete);
      if (index !== -1) {
        lines.splice(index, 1);
        appState.manualPreviewOverride = lines.join("\n");
        updatePreview(false);
        showToast("Line deleted from preview", "info");
      }
    }
  });
  card.addEventListener("blur", () => {
    if (appState.previewEditing) {
      appState.previewEditing = false;
      card.setAttribute("contenteditable", "false");
      appState.manualPreviewOverride = card.textContent;
      updatePreview(false);
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
  setCopyButtonsDisabled(true);
}

document.addEventListener("DOMContentLoaded", init);
