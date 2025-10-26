const path = require('path');
const fs = require('fs');

const holidaysPath = path.join(__dirname, '..', '..', 'Holidays.json');

function loadHolidays() {
  const raw = fs.readFileSync(holidaysPath, 'utf8');
  return JSON.parse(raw);
}

exports.getHolidays = (req, res) => {
  try {
    const holidays = loadHolidays();

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    const upcoming = holidays
      .filter(h => typeof h.date === 'string' && h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ status: true, today, upcoming });
  } catch (err) {
    console.error('Failed to load holidays:', err);
    return res.status(500).json({ status: false, error: 'Failed to load holidays' });
  }
};
