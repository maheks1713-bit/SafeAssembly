// node scripts/golden-cache.mjs
// Writes hand-authored demo-safety answers for the golden path into cache/ (matching the UI design copy).
// A live Gemini run overwrites these with real answers; commit cache/ after a good rehearsal.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "..", "cache");
fs.mkdirSync(dir, { recursive: true });
const w = (k, o) => fs.writeFileSync(path.join(dir, `${k}.json`), JSON.stringify(o, null, 2) + "\n");
const D = "General information, not legal advice.";
const DF = "Information générale, pas un avis juridique.";

w("monitor_choke_point_barrington_exit", { explanation: "Marshal reported crowd level 5 at Barrington Exit. It's the only east exit, so people could get crushed." });
w("monitor_cold_wind_stress_all", { explanation: "Feels like −16°C with 42 km/h wind (Open-Meteo). Warming tent at Stage should open now." });
w("monitor_medical_stage", { explanation: "Medical help requested at Stage. Someone may be suffering from the cold; a medic is needed now." });
w("monitor_blocked_exit_barrington_exit", { explanation: "Barrington Exit reported blocked. It's the only east exit, so the crowd has no way out that side." });
w("monitor_overcrowding_main_square", { explanation: "Main Square reported crowd level 4. Space is getting tight; spread people toward Stage." });
w("monitor_dispersal_risk_barrington_exit", { explanation: "Route 1 detour on Barrington St: people leaving by the east exit may wait longer for buses." });

w("dispatcher_choke_point_barrington_exit", {
  assignments: [
    { callsign: "M2", instruction: "Barrington Exit: move now. Help M4 slow the flow and guide people back toward Main Square." },
    { callsign: "M5", instruction: "Barrington Exit: move now. Open space along the barrier, keep the exit lane clear." },
    { callsign: "M4", instruction: "Hold the east line. Guide people back toward Main Square. M2 and M5 joining you." },
  ],
  reason: "M2 and M5 were the nearest free marshals (Main Square). M4 stays to hold the line.",
  escalate_reason: "", announcement_en: "", announcement_fr: "",
});
w("dispatcher_cold_wind_stress_all", {
  assignments: [{ callsign: "Medic-1", instruction: "Stage: staff the warming tent. Check anyone shivering or confused; blankets and warm drinks." }],
  reason: "Medic-1 is already at Stage, next to the warming tent.",
  escalate_reason: "",
  announcement_en: "Warming tent is open at the Stage. Feeling cold? Come warm up, and look out for each other.",
  announcement_fr: "La tente chauffée est ouverte près de la scène. Vous avez froid? Venez vous réchauffer et prenez soin les uns des autres.",
});
w("dispatcher_medical_stage", {
  assignments: [
    { callsign: "Medic-2", instruction: "Stage: medical call, go now. Person down near the warming tent. Report status on arrival." },
    { callsign: "Medic-1", instruction: "Stage: medical call, go now. Person down near the warming tent. Report status on arrival." },
  ],
  reason: "Nearest free medic sent to Stage.",
  escalate_reason: "Medic reports a person down at Stage, not responding well to the cold. Dispatcher recommends calling 911.",
  announcement_en: "", announcement_fr: "",
});
w("dispatcher_blocked_exit_barrington_exit", {
  assignments: [
    { callsign: "M2", instruction: "Barrington Exit: exit blocked. Move now and redirect people to Main Square." },
    { callsign: "M5", instruction: "Barrington Exit: exit blocked. Move now, keep people back from the blockage." },
    { callsign: "M4", instruction: "Barrington Exit: hold position. Stop people entering the blocked exit. M2 and M5 joining you." },
  ],
  reason: "M2 and M5 were the nearest free marshals. M4 stays at the exit.",
  escalate_reason: "The only east exit is blocked with a crowd present. Consider calling 911 if it can't be cleared fast.",
  announcement_en: "", announcement_fr: "",
});

w("comms_fake-cancel", {
  about_event: true, claim: "The vigil is cancelled and police are closing Grand Parade.", verdict: "false", harm: "confusion",
  correction_en: "The Halifax Climate Vigil is ON at Grand Parade until 8 PM. Official updates only from [YOUR ACCOUNT]. Please share.",
  correction_fr: "La vigile pour le climat d'Halifax a bien lieu à Grand Parade jusqu'à 20 h. Mises à jour officielles : [YOUR ACCOUNT]. Merci de partager.",
});
w("comms_fake-moved", {
  about_event: true, claim: "The vigil moved to the Commons at 9 PM.", verdict: "false", harm: "confusion",
  correction_en: "The vigil has not moved: it's at Grand Parade, 6-8 PM tonight. Official updates only from [YOUR ACCOUNT].",
  correction_fr: "La vigile n'a pas changé de lieu : Grand Parade, de 18 h à 20 h ce soir. Mises à jour officielles : [YOUR ACCOUNT].",
});
w("comms_incitement", {
  about_event: true, claim: "Calls for people to fight police and damage shops on Barrington St.", verdict: "unverifiable", harm: "incitement",
  correction_en: "The Halifax Climate Vigil is a peaceful gathering. We do not support violence or damage. Please don't share that post. Updates: [YOUR ACCOUNT].",
  correction_fr: "La vigile pour le climat d'Halifax est un rassemblement pacifique. Nous ne soutenons ni violence ni dommages. Ne partagez pas ce message. Infos : [YOUR ACCOUNT].",
});
w("comms_accurate", {
  about_event: true, claim: "The vigil is on tonight at Grand Parade, 6-8 PM.", verdict: "accurate", harm: "none",
  correction_en: "Confirmed: the vigil is on at Grand Parade, 6-8 PM.", correction_fr: "Confirmé : la vigile a lieu à Grand Parade, de 18 h à 20 h.",
});
w("comms_accurate-sound", {
  about_event: true, claim: "There will be a few short speeches, finished by 8 PM.", verdict: "accurate", harm: "none",
  correction_en: "Confirmed: 3 short speeches, sound off by 8 PM.", correction_fr: "Confirmé : 3 courts discours, son coupé avant 20 h.",
});

w("planner", {
  permit_fields: [
    { label: "Organizer", value: "[YOUR GROUP NAME]" },
    { label: "Contact", value: "[CONTACT NAME] · [PHONE]" },
    { label: "Location", value: "Grand Parade, Barrington St side" },
    { label: "Date and time", value: "Sat 6–8 PM (set-up 5:15 PM, clear by 8:30 PM)" },
    { label: "Expected attendance", value: "~800 people" },
    { label: "Activity", value: "Candlelight vigil, 3 short speeches, no march" },
    { label: "Structures", value: "One warming tent at the stage end; no stage build" },
    { label: "Sound", value: "One battery speaker, off by 8 PM" },
    { label: "Open flames", value: "Candles (to confirm with HRM; LED candles as backup)" },
    { label: "Safety plan", value: "6 marshals, 2 medics, 1 legal observer; warming tent at stage" },
    { label: "Road impact", value: "None requested; sidewalks kept clear" },
    { label: "Clean-up", value: "Volunteers sweep for wax and litter by 8:30 PM" },
  ],
  permit_markdown:
    "## Public gathering application (draft)\n\n- **Organizer:** [YOUR GROUP NAME]\n- **Location:** Grand Parade, Barrington St side\n- **When:** Sat 6–8 PM\n- **Attendance:** ~800 people\n- **Activity:** Candlelight vigil, 3 short speeches, no march\n- **Sound:** One battery speaker, off by 8 PM\n- **Safety plan:** 6 marshals, 2 medics, 1 legal observer; warming tent at stage\n\n### Questions for the city\n1. Are open flames (candles) allowed on the square?\n2. Is a noise permit needed for one speaker?",
  checklist: [
    { item: "Recruit 6 marshals with callsigns M1–M6", owner: "Marshal lead", due: "1 week before", done: true },
    { item: "Recruit 2 medics with first-aid kits", owner: "Medic lead", due: "1 week before", done: true },
    { item: "Recruit a legal observer", owner: "Organizer", due: "1 week before", done: true },
    { item: "Submit the HRM application", owner: "Organizer", due: "1 week before", done: true },
    { item: "Confirm candle rules with HRM", owner: "Organizer", due: "3 days before", done: false },
    { item: "Confirm whether a noise permit is needed", owner: "Sound", due: "3 days before", done: false },
    { item: "Brief marshals on zones and exit plan", owner: "Marshal lead", due: "Day before", done: true },
    { item: "Post official update account in event description", owner: "Organizer", due: "Day before", done: true },
    { item: "Charge speaker and backup battery", owner: "Sound", due: "Day before", done: true },
    { item: "Pack warming tent, blankets, hand warmers", owner: "Medic lead", due: "Day before", done: true },
    { item: "Check weather forecast and wind", owner: "Organizer", due: "Day of", done: true },
    { item: "Set up warming tent at stage before start", owner: "Medic lead", due: "On site", done: true },
    { item: "Walk the Barrington St exit; keep lane clear", owner: "Marshal lead", due: "On site", done: true },
    { item: "Radio / group-chat check with all volunteers", owner: "Marshal lead", due: "On site", done: true },
    { item: "Sound off by 8 PM", owner: "Sound", due: "On site", done: true },
    { item: "Clean-up sweep for wax and litter", owner: "Organizer", due: "After", done: true },
  ],
  route_notes:
    "No march: people gather on Grand Parade and leave the same way. The Barrington St side is the only east exit and becomes a choke point when the crowd leaves at once; keep a marshal there and a clear lane. Use the George St side as a second exit if attendance passes 600. Disperse in waves after the last speech and remind people that buses on Barrington may be detoured.",
  questions_for_city: ["Are open flames (candles) allowed on the square?", "Is a noise permit needed for one speaker?"],
});

const R = (answer, cited, confidence, lang, covered = true) =>
  ({ answer, cited_sections: cited, confidence, covered, disclaimer: lang === "fr" ? DF : D });

const MOVE_EN = R(
  "The Charter protects your right to gather peacefully. But that right has **reasonable limits**, like safety and traffic.\n\nSo yes, police can sometimes direct a crowd. Stay calm, ask which law or bylaw applies, and tell your legal observer.",
  ["Charter s. 2(c)", "Charter s. 1"], "high", "en");
const MOVE_FR = R(
  "La Charte protège votre droit de vous réunir pacifiquement. Mais ce droit a des **limites raisonnables**, comme la sécurité et la circulation.\n\nDonc oui, la police peut parfois diriger une foule. Restez calme, demandez quelle loi ou quel règlement s'applique, et prévenez votre observateur juridique.",
  ["Charte art. 2c)", "Charte art. 1"], "high", "fr");

w("rights_en_can_police_tell_us_to_move", MOVE_EN);
w("rights_fr_can_police_tell_us_to_move", MOVE_FR);
w("rights_fr_la_police_peut_elle_nous_dire_de_partir", MOVE_FR);
w("rights_en_do_we_need_a_permit", R(
  "Your right to gather peacefully does not remove city rules. **Halifax may require a permit** for events on city property, especially with tents or amplified sound.\n\nCheck HRM's current special-event requirements early.",
  ["Charter s. 2(c)", "Charter s. 1", "FAQ: Permit"], "high", "en"));
w("rights_fr_faut_il_un_permis", R(
  "Votre droit de vous réunir ne supprime pas les règles de la ville. **Halifax peut exiger un permis** pour un événement sur un terrain municipal, surtout avec une tente ou du son amplifié.\n\nVérifiez tôt les exigences actuelles de la MRH.",
  ["Charte art. 2c)", "Charte art. 1", "FAQ : Permis"], "high", "fr"));
w("rights_en_can_i_film_police", R(
  "In general, filming in a public place is a form of expression. Film from a safe distance and **don't physically interfere** with police work.\n\nIf an officer asks you to step back, stay calm and ask what law applies.",
  ["Charter s. 2(b)", "Charter s. 1", "FAQ: Filming police"], "high", "en"));
w("rights_fr_puis_je_filmer_la_police", R(
  "En général, filmer dans un lieu public est une forme d'expression. Filmez à distance et **n'entravez pas physiquement** le travail de la police.\n\nSi un agent vous demande de reculer, restez calme et demandez quelle loi s'applique.",
  ["Charte art. 2b)", "Charte art. 1", "FAQ : Filmer la police"], "high", "fr"));
w("rights_en_if_i_m_detained", R(
  "Stay calm and don't resist. Ask: \"Am I being detained, and why?\" You have the right to **know why and to talk to a lawyer** without delay.\n\nYou can say you wish to stay silent until you speak to a lawyer. Tell your legal observer.",
  ["Charter s. 10", "FAQ: Detained"], "high", "en"));
w("rights_fr_si_je_suis_d_tenu", R(
  "Restez calme et ne résistez pas. Demandez : « Suis-je détenu, et pourquoi? » Vous avez le droit de **savoir pourquoi et de parler à un avocat** sans délai.\n\nVous pouvez dire que vous gardez le silence jusqu'à ce que vous parliez à un avocat. Prévenez votre observateur juridique.",
  ["Charte art. 10", "FAQ : Détention"], "high", "fr"));
w("rights_en_what_if_they_ask_for_my_name", R(
  "In many everyday situations you don't have to give police your name, but there are exceptions, like being ticketed, arrested or driving.\n\nAsk if you are being detained. **Never give a false name.** If unsure, ask for a lawyer and tell your legal observer.",
  ["Charter s. 10", "FAQ: Name"], "medium", "en"));

console.log(`Wrote golden-path cache to ${dir}`);
