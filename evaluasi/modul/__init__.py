"""Modul evaluasi terpisah untuk tiap komponen sistem itinerary Danau Toba.

Setiap modul HANYA memanggil engine apa adanya (tidak mengubah logika optimasi)
dan mengukur kontribusi/kinerja satu komponen:

    ferry.py        -> BAGIAN 3: Ferry Detector (accuracy/precision/recall/F1)
    rute.py         -> BAGIAN 4: Route Optimizer (distance & travel-time reduction)
    time_filter.py  -> BAGIAN 5: Time-Aware Filter (invalid attraction reduction)
    umkm.py         -> BAGIAN 6: UMKM Scorer (exposure & selection increase)
    ablation.py     -> BAGIAN 7: Ablation Study (kontribusi tiap modul)

Semua modul memakai jarak haversine (use_osrm=False) supaya konsisten dengan
`evaluate.py` dan tidak bergantung pada server OSRM.
"""
