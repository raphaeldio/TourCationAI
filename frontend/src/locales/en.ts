/**
 * Kamus Bahasa Inggris statis.
 *
 * Ditulis tangan, bukan hasil model: Inggris adalah bahasa kedua yang paling
 * sering dipakai turis di Danau Toba, jadi terjemahannya harus instan (tanpa
 * panggilan jaringan) dan pasti benar. Bahasa lain tetap lewat AI.
 *
 * Kunci = teks Bahasa Indonesia persis seperti yang ditulis di komponen.
 */
export const EN: Record<string, string> = {
  // Navbar & footer
  Home: "Home",
  Perjalanan: "Trip",
  Galeri: "Gallery",
  "AI Guide": "AI Guide",
  "Dampak UMKM": "Local Business Impact",
  "Ekspor PDF": "Export PDF",
  "Unduh rencana sebagai PDF": "Download the plan as PDF",
  "Plan Trip": "Plan Trip",
  "Ke beranda": "Go to home",
  "Dibuat untuk penjelajah modern": "Built for modern explorers",
  Bahasa: "Language",

  // Gallery section
  "Sekilas Danau Toba": "A Glimpse of Lake Toba",
  "Lihat Sendiri Keindahannya": "See Its Beauty For Yourself",
  "Kaldera vulkanik terbesar di dunia, danau sepanjang 100 kilometer, dan budaya Batak yang hidup di tepiannya.":
    "The world's largest volcanic caldera, a 100-kilometre lake, and the living Batak culture along its shores.",
  "Geser untuk menjelajah — klik kartu untuk melihat selengkapnya":
    "Drag to explore — click a card to see more",
  Sebelumnya: "Previous",
  Berikutnya: "Next",
  Putar: "Play",
  Tutup: "Close",
  "Pulau Samosir": "Samosir Island",
  "Pulau seluas Singapura di tengah danau":
    "An island the size of Singapore in the middle of the lake",
  "Bukit Holbung": "Holbung Hill",
  "Punggung bukit hijau menghadap perairan": "Green ridgelines overlooking the water",
  "Air Terjun Sipiso-piso": "Sipiso-piso Waterfall",
  "Terjunan 120 meter di ujung utara kaldera":
    "A 120-metre drop at the northern edge of the caldera",
  "Desa Tomok": "Tomok Village",
  "Rumah bolon dan makam batu raja Batak":
    "Bolon houses and the stone tombs of Batak kings",

  // Gallery detail page
  "Halaman ini masih disiapkan. Konten lengkapnya segera hadir.":
    "This page is still being prepared. Full content coming soon.",
  "Halaman tidak ditemukan": "Page not found",
  "Destinasi yang kamu cari tidak ada dalam galeri.":
    "The destination you are looking for is not in the gallery.",

  // Lodging picker
  "Pilihan penginapan": "Lodging options",
  "Lihat {n} hotel teratas lainnya": "See {n} more top hotels",
  "Sembunyikan hotel lain": "Hide other hotels",
  "rata-rata ke wisata": "avg. to attractions",
  "rencana saat ini": "current plan",
  total: "total",
  "Mengganti penginapan menyusun ulang seluruh rencana — wisata, urutan rute, dan biayanya ikut berubah.":
    "Changing lodging rebuilds the whole plan — attractions, route order, and cost all shift.",

  // Transport
  Transportasi: "Transport",
  "Angkutan umum": "Public transport",
  Dipakai: "In use",
  "Jalan kaki": "On foot",
  Motor: "Motorbike",
  Mobil: "Car",
  "Tarif per orang per hari dari data operator antarkota.":
    "Fare per person per day, based on intercity operator data.",
  "Tanpa biaya BBM. Feri dihitung tarif pejalan kaki.":
    "No fuel cost. Ferry charged at the pedestrian fare.",
  "Biaya BBM dihitung dari jarak rute dan ikut membatasi budget.":
    "Fuel cost is derived from route distance and counts against your budget.",
  Feri: "Ferry",
  "Jarak rencana ini terlalu jauh untuk moda tersebut":
    "This plan covers too much ground for that mode",
  "batas wajar": "reasonable limit",

  // Hero
  "Discover the Magic of": "Discover the Magic of",
  "Susun Perjalanan": "Plan Your Trip",
  Scroll: "Scroll",
  "Tanya AI soal Danau Toba…": "Ask AI about Lake Toba…",
  Salin: "Copy",
  Tersalin: "Copied",
  "Susun rencana agar jawabannya lebih spesifik.":
    "Build a plan to get more specific answers.",
  "AI menyusun perjalananmu di danau vulkanik terbesar Asia Tenggara — itinerari personal, rute harian yang efisien, dan pilihan kuliner yang berpihak pada UMKM lokal.":
    "AI builds your trip around Southeast Asia's largest volcanic lake — personalised itineraries, efficient daily routes, and dining picks that favour local small businesses.",

  // Trip settings panel
  "Atur Perjalanan": "Trip Settings",
  "Budget Total (Rp)": "Total Budget (Rp)",
  "Durasi (Hari)": "Duration (Days)",
  "Jumlah Orang": "Group Size",
  "Wisata Per Hari": "Attractions Per Day",
  "Minat Wisata": "Interests",
  "Gaya Pengalaman": "Experience Style",
  "Saran AI": "AI Suggestion",
  "Dipilihkan dari budget per hari": "Chosen from your daily budget",
  "Susun Rencana": "Build Plan",
  "AI menyusun rencana…": "AI is building your plan…",
  "Dijamin tidak melebihi budget": "Guaranteed to stay within budget",
  "Mendukung UMKM & wisata lokal": "Supports local businesses & tourism",
  Penginapan: "Accommodation",
  Termasuk: "Included",
  Tidak: "Not included",
  malam: "night",
  "tanpa menginap": "no overnight stay",
  "Gunakan lokasi saya": "Use my location",
  "Perbarui lokasi saya": "Update my location",
  "Hotel tidak dibiayai. Rute berangkat dari titik acuan pilihanmu.":
    "No lodging cost. Routes start from your chosen reference point.",
  "Tanpa lokasi, rute tetap berpangkal di hotel acuan terdekat.":
    "Without a location, routes still start from the nearest reference hotel.",
  "Meminta izin lokasi…": "Requesting location permission…",
  "Titik acuan: lokasi Anda saat ini.": "Reference point: your current location.",
  "Izin lokasi ditolak. Rute akan berpangkal di hotel acuan.":
    "Location denied. Routes will start from the reference hotel.",
  "Tips Lokal": "Local Tips",

  // Itinerary board
  "Perjalanan Dioptimalkan AI": "AI-Optimised Trip",
  Hari: "Day",
  Malam: "Nights",
  Orang: "People",
  Profil: "Profile",
  Umum: "General",
  "Estimasi Biaya": "Estimated Cost",
  "Sisa Budget": "Remaining Budget",
  "Total Jarak": "Total Distance",
  "Per Hari": "Per Day",
  "per orang": "per person",
  "dari budget": "of budget",
  "melebihi budget": "over budget",
  destinasi: "destinations",
  "Titik Keberangkatan": "Departure Point",
  "Titik rute harian": "Daily route anchor",
  "Tanpa penginapan": "No accommodation",
  "Titik acuan": "Reference point",
  "Koordinat tidak tersedia": "Coordinates unavailable",
  "Rute harian berangkat dan kembali ke titik ini. Tidak ada biaya penginapan.":
    "Daily routes depart from and return to this point. No lodging cost.",
  Wisata: "Attraction",
  Sarapan: "Breakfast",
  "Makan siang": "Lunch",
  "Makan malam": "Dinner",
  "pilihan sepadan": "comparable options",
  "rekomendasi AI": "AI pick",
  "Gratis masuk": "Free entry",
  "per grup": "per group",
  "Highly Rated": "Highly Rated",
  Kembalikan: "Reset",
  "AI sedang menyusun…": "AI is building…",
  "Siap menyusun rencana": "Ready to plan",
  "Mulai dari": "Start from",
  Alam: "Nature",
  Budaya: "Culture",
  Rohani: "Spiritual",
  Rekreasi: "Recreation",
  "Alam & Petualangan": "Nature & Adventure",
  "Budaya & Akar Tradisi": "Culture & Tradition",
  "Ziarah & Refleksi": "Pilgrimage & Reflection",
  "Rekreasi & Keluarga": "Recreation & Family",
  Eksplorasi: "Exploration",
  "Eksplorasi Campuran": "Mixed Exploration",

  // Map
  "Peta Rute": "Route Map",
  "Peta rute muncul setelah rencana disusun.":
    "The route map appears once a plan is built.",
  "Destinasi Terdekat": "Nearby Destinations",
  "Total Biaya Wisata": "Total Attraction Cost",
  "Total Biaya BBM": "Estimated Fuel Cost",
  "Perlu menyeberang": "Ferry crossing required",
  "Buka di Google Maps": "Open in Google Maps",
  "Titik berangkat": "Departure point",
  Perhentian: "Stop",
  "Singgahan tambahan": "Extra stop",
  "Cari lokasi": "Search location",
  "Gunakan lokasiku": "Use my location",
  "Kembali berangkat dari hotel": "Depart from the hotel again",
  "Lokasi Saya": "My Location",

  // AI analysis
  "Di balik layar": "Behind the scenes",
  Analisis: "Analysis",
  "Budget Solver": "Budget Solver",
  "Route Optimizer": "Route Optimizer",
  "Time-Aware Filter": "Time-Aware Filter",
  "Ferry Detector": "Ferry Detector",
  "UMKM Scorer": "Local Business Scorer",
  Modul: "Module",
  "Wisata terpilih": "Attractions selected",
  "Resto terpilih": "Restaurants selected",
  "Total agenda": "Total agenda items",
  "Ragam kuliner khas": "Signature dish variety",
  "Tanya AI": "Ask AI",
  "Tanpa feri": "No ferry needed",
  penyeberangan: "crossings",

  // Local impact
  "Dampak Ekonomi Lokal": "Local Economic Impact",
  Dampak: "Impact",
  "Usaha Lokal Otentik": "Authentic Local Businesses",
  "Ragam Kuliner Khas": "Signature Dish Variety",
  "Usaha Unik Dikunjungi": "Unique Businesses Visited",
  "Porsi kunjungan ke usaha lokal": "Share of visits to local businesses",
  "Kuliner khas Batak dalam rencana ini": "Batak signature dishes in this plan",
  "Belum ada rencana untuk diukur": "No plan to measure yet",

  // Translator
  "Penerjemah AI": "AI Translator",
  "Siap menerjemahkan": "Ready to translate",
  "Menerjemahkan…": "Translating…",
  "Ketik teks untuk diterjemahkan…": "Type text to translate…",
  "Hapus percakapan": "Clear conversation",
  "Tukar bahasa": "Swap languages",
  "Rekam suara": "Record voice",
  "Berhenti merekam": "Stop recording",
  "Mendengarkan…": "Listening…",
  Terjemahkan: "Translate",
  Dengarkan: "Listen",
  "Enter kirim · Shift+Enter baris baru": "Enter to send · Shift+Enter for a new line",
};
