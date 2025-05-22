
import { sendList } from "../services/whatsapp.js";

export default async function sendTrekList(userId) {
  return sendList(userId, "Choose Trek/Expedition:", [
    {
      title: "Popular Treks",
      rows: [
        { id: "Kedarkantha", title: "Kedarkantha Trek" },
        { id: "Brahmatal", title: "Brahmatal Trek" },
        { id: "BaliPass", title: "Bali Pass Trek" },
        { id: "BlackPeak", title: "Black Peak Expedition" },
        { id: "BorasuPass", title: "Borasu Pass Trek" },
        { id: "DumdarkandiPass", title: "Dumdarkandi Pass Trek" },
        { id: "HarKiDun", title: "Har Ki Dun Trek" }
      ]
    }
  ], "🌄 Select a Trek/Expedition");
}

