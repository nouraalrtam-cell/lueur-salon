const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const SALON_NUMBER = "96551168545";

const db = new sqlite3.Database("salon.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking
    ON bookings(date, time)
  `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const allSlots = [
  "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00"
];

app.get("/api/available-slots", (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "التاريخ مطلوب" });
  }

  db.all("SELECT time FROM bookings WHERE date = ?", [date], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "خطأ في جلب المواعيد" });
    }

    const booked = rows.map(row => row.time);
    const available = allSlots.filter(slot => !booked.includes(slot));

    res.json({
      date,
      allSlots,
      booked,
      available
    });
  });
});

app.post("/api/book", (req, res) => {
  const { name, phone, service, date, time, notes } = req.body;

  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: "يرجى تعبئة جميع الحقول المطلوبة" });
  }

  db.get(
    "SELECT id FROM bookings WHERE date = ? AND time = ?",
    [date, time],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: "خطأ في التحقق من الموعد" });
      }

      if (row) {
        return res.status(409).json({ error: "هذا الموعد محجوز بالفعل" });
      }

      db.run(
        `INSERT INTO bookings (name, phone, service, date, time, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, phone, service, date, time, notes || ""],
        function(insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: "تعذر حفظ الحجز" });
          }

          const whatsappMessage =
            `طلب حجز جديد:\n` +
            `الاسم: ${name}\n` +
            `رقم الهاتف: ${phone}\n` +
            `الخدمة: ${service}\n` +
            `التاريخ: ${date}\n` +
            `الوقت: ${time}\n` +
            `الملاحظات: ${notes || "لا توجد"}`;

          const whatsappUrl = `https://wa.me/${SALON_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

          res.json({
            success: true,
            message: "تم الحجز بنجاح",
            whatsappUrl
          });
        }
      );
    }
  );
});

app.get("/api/bookings", (req, res) => {
  db.all(
    "SELECT * FROM bookings ORDER BY date ASC, time ASC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "خطأ في جلب الحجوزات" });
      }

      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});