"""
Bilim İlaç - Ceftinex E-Detailing Uygulaması
Flask Backend | Ziyaret & Etkileşim Loglama
"""

import os
import uuid
import sqlite3
import datetime
from flask import (
    Flask, render_template, request,
    jsonify, session, g, send_from_directory
)

# ---------------------------------------------------------------------------
# Uygulama yapılandırması
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "bilim-ilac-edetail-secret-2024")

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(BASE_DIR, "edetail_logs.db")


# ---------------------------------------------------------------------------
# Veritabanı yardımcıları
# ---------------------------------------------------------------------------
def get_db() -> sqlite3.Connection:
    """Her istek için tek bir bağlantı aç, uygulama bağlamına ekle."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Tablolar yoksa oluştur."""
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()

    # Ziyaret tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visits (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id    TEXT    NOT NULL,
            visit_time    TEXT    NOT NULL,
            device_type   TEXT    NOT NULL,
            user_agent    TEXT,
            duration_sec  REAL    DEFAULT NULL
        )
    """)

    # Tıklama / etkileşim tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interactions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id    TEXT    NOT NULL,
            element_id    TEXT    NOT NULL,
            element_label TEXT,
            event_time    TEXT    NOT NULL
        )
    """)

    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Yardımcı: cihaz tipi tespiti
# ---------------------------------------------------------------------------
def detect_device(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if any(kw in ua for kw in ("mobi", "android", "iphone", "ipad", "tablet")):
        return "mobile"
    return "desktop"


# ---------------------------------------------------------------------------
# Route'lar
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """
    Ana sayfa — her yüklenişte yeni (veya mevcut) session açılır,
    ziyaret SQLite'a loglanır.
    """
    # Oturum kimliği: tarayıcı oturumu boyunca aynı kalır
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())

    session_id  = session["session_id"]
    user_agent  = request.headers.get("User-Agent", "")
    device_type = detect_device(user_agent)
    visit_time  = datetime.datetime.utcnow().isoformat()

    db = get_db()
    db.execute(
        "INSERT INTO visits (session_id, visit_time, device_type, user_agent) "
        "VALUES (?, ?, ?, ?)",
        (session_id, visit_time, device_type, user_agent),
    )
    db.commit()

    return render_template(
        "index.html",
        session_id=session_id,
        device_type=device_type,
    )


@app.route("/api/log-interaction", methods=["POST"])
def log_interaction():
    """
    Buton / eleman tıklamalarını logla.
    Beklenen JSON gövdesi:
        { "session_id": "...", "element_id": "...", "element_label": "..." }
    """
    data        = request.get_json(silent=True) or {}
    session_id  = data.get("session_id") or session.get("session_id", "unknown")
    element_id  = data.get("element_id", "unknown")
    element_label = data.get("element_label", "")
    event_time  = datetime.datetime.utcnow().isoformat()

    if not session_id or not element_id:
        return jsonify({"status": "error", "message": "Eksik parametre"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO interactions (session_id, element_id, element_label, event_time) "
        "VALUES (?, ?, ?, ?)",
        (session_id, element_id, element_label, event_time),
    )
    db.commit()

    return jsonify({"status": "ok", "logged": True})


@app.route("/api/log-duration", methods=["POST"])
def log_duration():
    """
    Kullanıcının sayfada geçirdiği toplam süreyi (saniye) güncelle.
    Beklenen JSON gövdesi:
        { "session_id": "...", "duration_sec": 42.7 }
    """
    data        = request.get_json(silent=True) or {}
    session_id  = data.get("session_id") or session.get("session_id", "unknown")
    duration    = data.get("duration_sec")

    if session_id is None or duration is None:
        return jsonify({"status": "error", "message": "Eksik parametre"}), 400

    try:
        duration = float(duration)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Geçersiz süre değeri"}), 400

    db = get_db()
    # En son eklenen kaydı güncelle (aynı session_id için)
    db.execute(
        """
        UPDATE visits
        SET    duration_sec = ?
        WHERE  session_id   = ?
          AND  id = (
              SELECT id FROM visits
              WHERE  session_id = ?
              ORDER  BY id DESC
              LIMIT  1
          )
        """,
        (duration, session_id, session_id),
    )
    db.commit()

    return jsonify({"status": "ok", "duration_sec": duration})


# ---------------------------------------------------------------------------
# Basit Admin (opsiyonel) — logları görüntüle
# ---------------------------------------------------------------------------
@app.route("/admin/logs")
def admin_logs():
    """Son 50 ziyaret ve son 50 etkileşimi JSON olarak döndür."""
    db = get_db()
    visits = db.execute(
        "SELECT * FROM visits ORDER BY id DESC LIMIT 50"
    ).fetchall()
    interactions = db.execute(
        "SELECT * FROM interactions ORDER BY id DESC LIMIT 50"
    ).fetchall()

    return jsonify({
        "visits": [dict(v) for v in visits],
        "interactions": [dict(i) for i in interactions],
    })


@app.route("/static/<path:filename>")
def serve_static_file(filename):
    """
    PDF ve di\u011fer statik dosyalar\u0131 sun.
    /static/pdf/<dosya.pdf> yolundaki PDF'ler de bu route ile sunulur.
    """
    return send_from_directory(
        os.path.join(BASE_DIR, "static"),
        filename,
    )


# ---------------------------------------------------------------------------
# Başlatma
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
