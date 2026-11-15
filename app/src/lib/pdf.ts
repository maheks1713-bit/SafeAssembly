import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br/>");

/** Simple branded HTML -> PDF. `sections` are [heading, html-safe body] pairs. */
export function pdfHtml(title: string, subtitle: string, sections: [string, string][], footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#10201E;padding:32px;font-size:13px;line-height:1.5}
    h1{font-size:26px;margin:0;color:#0E3B38} .sub{color:#4E5B58;margin:4px 0 20px}
    h2{font-size:15px;margin:22px 0 8px;color:#0E6B66;text-transform:uppercase;letter-spacing:.5px}
    table{border-collapse:collapse;width:100%} td{padding:6px 8px;border-bottom:1px solid #DDE2DF;vertical-align:top}
    td:first-child{color:#4E5B58;width:32%} .foot{margin-top:28px;padding:10px 12px;background:#FCE7B5;border-radius:8px}
  </style></head><body><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div>
  ${sections.map(([h, b]) => `<h2>${esc(h)}</h2>${b}`).join("")}
  <div class="foot">${esc(footer)}</div></body></html>`;
}
export const pdf = { esc, md };

export async function sharePdf(html: string) {
  if (Platform.OS === "web") return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  else await Print.printAsync({ uri });
}
